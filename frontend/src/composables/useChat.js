/**
 * src/composables/useChat.js
 * 對話核心邏輯 (Chat Core Composable)
 * 職責：管理對話狀態、處理訊息解析(Parser)、打字機效果(Typer)與後端通訊。
 */

import { ref, nextTick, computed, onMounted } from 'vue';

/**
 * @param {string} defaultConversationId - 預設的對話 ID
 * @param {Ref} chatMode - 當前聊天模式 ('demon'|'angel'|'group')
 * @param {Ref} currentSpeaker - 當前正在發話的角色 (用於 UI 顯示)
 * @param {Ref} emotion - 情緒狀態物件
 */
export function useChat(defaultConversationId, chatMode, currentSpeaker, emotion) {
  
  // ============================================================
  // 1. State Definitions
  // ============================================================
  
  const userInput = ref('');
  const messageHistory = ref([]); 
  const displayedText = ref(''); 
  
  const isTyping = ref(false);
  const isThinking = ref(false);
  
  const chatContainer = ref(null);
  const currentConversationId = ref(defaultConversationId);

  // ============================================================
  // 2. Identity Management (身份識別)
  // ============================================================

  /**
   * 初始化身份識別
   * 優先順序: URL Query (?cid=...) > 預設值
   */
  const initIdentity = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCid = urlParams.get('cid');

    if (urlCid) {
        // URL 強制覆蓋
        currentConversationId.value = urlCid;
        console.log(`[useChat] Identity Mode: URL Override (${urlCid})`);
    }
    // 無論 ID 來源為何，最後都載入歷史紀錄
    await loadHistory();
  };

  // ============================================================
  // 3. Helper Functions (UI & Parsing)
  // ============================================================

  /**
   * 滾動到底部
   */
  const scrollToBottom = () => {
    nextTick(() => { 
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight + 100; 
      }
    });
  };

  /**
   * 頻道過濾邏輯
   * 根據當前 chatMode 過濾顯示的訊息 (實現 Demon/Angel 的獨立視角)
   */
  const filteredHistory = computed(() => {
    const currentMode = chatMode.value;
    return messageHistory.value.filter(msg => {
      // 系統訊息總是顯示
      if (msg.role === 'system') return true;

      // 判斷訊息歸屬 (Target or Speaker)
      let msgTarget = 'demon';
      if (msg.role === 'user') {
        msgTarget = msg.meta?.target || 'demon';
      } else {
        msgTarget = msg.meta?.speaker || 'demon';
      }

      // Group 模式顯示所有訊息，否則只顯示對應人格的訊息
      if (currentMode === 'group') return true;
      return msgTarget === currentMode;
    });
  });

  /**
   * 分鏡解析器 (Segment Parser)
   * 將原始文本拆解為 場景[Scene]、動作(Action) 與 對話(Text)
   */
  const parseResponseToSegments = (text) => {
    // Regex: 匹配 [中括號] 或 (圓括號) 或 換行
    const rawSegments = text.split(/(\[.*?\]|\(.*?\))|\n+/g);
    const results = [];
    
    for (const seg of rawSegments) {
      if (!seg || !seg.trim()) continue;
      const content = seg.trim();

      // [Firewall] 簡單的內容防火牆：防止 Demon 模式看到 Angel 的獨白 (反之亦然)
      // 雖然 filteredHistory 已經過濾了訊息物件，但這是針對單一訊息內的混合內容過濾
      if (chatMode.value === 'demon' && (content.startsWith('Angel:') || content.includes('[Angel]'))) continue;
      if (chatMode.value === 'angel' && (content.startsWith('Demon:') || content.includes('[Lilith]'))) continue;

      if (content.startsWith('[') && content.endsWith(']')) {
        results.push({ type: 'scene', content });
      } else if (content.startsWith('(') && content.endsWith(')')) {
        results.push({ type: 'action', content });
      } else {
        results.push({ type: 'text', content });
      }
    }
    return results;
  };

  /**
   * 內容處理與人格識別 (Speaker Routing)
   * 處理 [SPEAKER:xxx] 標籤，將單一回應拆分為多個角色的發言
   */
  const processContentAndPush = (rawContent, defaultSpeaker) => {
    const resultQueue = [];
    const speakerRegex = /\[SPEAKER:(.*?)\]([\s\S]*?)(?=\[SPEAKER:|$)/g;

    // 如果包含 SPEAKER 標籤，進行拆分
    if (rawContent.includes('[SPEAKER:')) {
        // 1. 處理標籤前的內容 (歸屬給預設講者)
        const firstTagIndex = rawContent.indexOf('[SPEAKER:');
        if (firstTagIndex > 0) {
            const preText = rawContent.substring(0, firstTagIndex).trim();
            if (preText) {
                resultQueue.push({ 
                    speaker: defaultSpeaker, 
                    segments: parseResponseToSegments(preText) 
                });
            }
        }

        // 2. 處理各個標籤後的內容
        let match;
        while ((match = speakerRegex.exec(rawContent)) !== null) {
            const name = match[1].toLowerCase().trim(); // e.g., 'angel', 'demon'
            const text = match[2].trim();
            if (text) {
                resultQueue.push({ 
                    speaker: name, 
                    segments: parseResponseToSegments(text) 
                });
            }
        }
        return resultQueue;
    }

    // 否則全部歸屬給預設講者
    return [{ 
        speaker: defaultSpeaker, 
        segments: parseResponseToSegments(rawContent) 
    }];
  };

  // ============================================================
  // 4. Typing Effect (Visuals)
  // ============================================================

  /**
   * 打字機效果執行器
   */
  const typeSegments = async (segments, speaker, metaMode) => {
    isTyping.value = true;
    currentSpeaker.value = speaker;

    for (const seg of segments) {
      // 場景描述打字快一點，對話慢一點
      const speed = seg.type === 'text' ? 30 : 10; 
      
      // 建立新訊息物件
      const newMessage = {
        role: 'assistant',
        speaker: speaker,
        meta: { speaker: metaMode },
        speakerName: 'Lilith',
        contentType: seg.type,
        content: ''
      };
      
      messageHistory.value.push(newMessage);
      scrollToBottom();

      // 逐字輸出
      const fullText = seg.content;
      for (let i = 0; i < fullText.length; i++) {
        newMessage.content += fullText[i];
        
        // 每兩個字捲動一次，降低 DOM 操作頻率
        if (i % 2 === 0) scrollToBottom(); 
        await new Promise(r => setTimeout(r, speed));
      }
      
      // 段落間停頓
      await new Promise(r => setTimeout(r, 400));
    }
    isTyping.value = false;
  };

  // ============================================================
  // 5. API Interactions
  // ============================================================

  /**
   * 載入歷史紀錄
   */
  const loadHistory = async () => {
    try {
      const targetId = currentConversationId.value;
      const res = await fetch(`/api/history?conversationId=${targetId}`);
      if (!res.ok) return;
      
      const data = await res.json();
      const history = data.history || [];

      messageHistory.value = [];

      for (const msg of history) {
        // User Message (直接推入)
        if (msg.role === 'user') {
          messageHistory.value.push({
            role: 'user',
            content: msg.content,
            contentType: 'text',
            attachments: msg.attachments || [], // 支援顯示歷史附件
            meta: msg.meta || { target: 'demon' }
          });
          continue;
        }

        // Assistant Message (需解析結構)
        if (msg.role === 'assistant') {
          let metaMode = msg.meta?.speaker || 'demon';
          let defaultSpeaker = (metaMode === 'angel') ? 'angel' : 'demon';

          const queue = processContentAndPush(msg.content, defaultSpeaker);

          queue.forEach(item => {
              item.segments.forEach(seg => {
                  messageHistory.value.push({
                      role: 'assistant',
                      speaker: item.speaker,
                      meta: { speaker: metaMode },
                      speakerName: 'Lilith',
                      contentType: seg.type,
                      content: seg.content
                  });
              });
          });
        }
      }
      scrollToBottom();
    } catch (e) {
      console.error("[useChat] Load history failed:", e);
    }
  };

  /**
   * 發送訊息 (包含附件)
   * @param {Array} attachments - 附件列表 [{name, mimeType, data(base64)}]
   */
  const sendMessage = async (attachments = []) => {
    // 防呆：沒有文字也沒有附件，或是正在思考中，則不發送
    if ((!userInput.value.trim() && attachments.length === 0) || isThinking.value) return;
    
    const text = userInput.value;
    const currentMode = chatMode.value; 
    const targetId = currentConversationId.value;

    // 1. 推入 User 訊息到前端畫面
    messageHistory.value.push({ 
      role: 'user', 
      content: text,
      contentType: 'text',
      attachments: attachments, // 顯示預覽
      meta: { target: currentMode } 
    });
    
    userInput.value = '';
    scrollToBottom();
    isThinking.value = true;

    try {
      // 2. 發送 API 請求
      const res = await fetch('/api/chat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: text, 
            attachments: attachments, // [Fix] 傳遞附件至後端
            mode: currentMode, 
            conversationId: targetId 
        })
      });
      const data = await res.json();
      
      // 3. 更新情緒狀態
      if (data.emotion) emotion.value = { ...emotion.value, ...data.emotion };
      
      isThinking.value = false;
      const messages = data.messages || [];
      
      // 4. 解析並打字輸出 AI 回應
      for (const rawMsg of messages) {
        let defaultSpeaker = (currentMode === 'angel') ? 'angel' : 'demon';
        let metaMode = (currentMode === 'group') ? 'group' : defaultSpeaker;

        const queue = processContentAndPush(rawMsg, defaultSpeaker);

        for (const item of queue) {
            await typeSegments(item.segments, item.speaker, metaMode);
        }

        // 多則訊息間的停頓
        if (messages.length > 1) {
            await new Promise(r => setTimeout(r, 800));
        }
      }

    } catch (e) {
      console.error(e);
      messageHistory.value.push({ 
        role: 'system', 
        content: "⚠️ System Offline: 連線失敗或核心無回應。", 
        contentType: 'scene', 
        meta: { speaker: currentMode } 
      });
      isThinking.value = false;
    }
  };

  /**
   * 重置資料庫
   */
  const resetDB = async () => {
      if(!confirm("確定要清除所有對話紀錄與短期記憶嗎？(長期記憶將保留)")) return;
      
      await fetch('/api/history/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: currentConversationId.value })
      });
      location.reload();
  };

  // ============================================================
  // 6. Lifecycle
  // ============================================================

  onMounted(() => {
    initIdentity();
  });

  return {
    userInput,
    messageHistory,
    filteredHistory,
    displayedText,
    isTyping,
    isThinking,
    chatContainer,
    sendMessage,
    resetDB,
    currentConversationId
  };
}
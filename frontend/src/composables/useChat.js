import { ref, nextTick, computed, onMounted } from 'vue';

export function useChat(conversationId, chatMode, currentSpeaker, emotion) {
  const userInput = ref('');
  const messageHistory = ref([]); 
  const displayedText = ref(''); 
  const isTyping = ref(false);
  const isThinking = ref(false);
  const chatContainer = ref(null);

  /**
   * [Filter] 頻道過濾邏輯
   * Group: 只顯示 Group 相關訊息 (內部對話、群組發言)
   * Demon/Angel: 只顯示各自的私聊
   */
  const filteredHistory = computed(() => {
    const currentMode = chatMode.value;
    return messageHistory.value.filter(msg => {
      // 1. 系統訊息永遠顯示
      if (msg.role === 'system') return true;

      // 2. 判斷訊息歸屬
      let msgTarget = 'demon';
      if (msg.role === 'user') {
        msgTarget = msg.meta?.target || 'demon';
      } else {
        // [關鍵] 如果是 assistant 訊息，優先看它被標記在哪個頻道
        msgTarget = msg.meta?.speaker || 'demon';
      }

      // 3. 嚴格匹配
      return msgTarget === currentMode;
    });
  });

  const scrollToBottom = () => {
    nextTick(() => { 
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight + 100; 
      }
    });
  };

  /**
   * [Parser] 將文字拆解為分鏡 (場景/動作/對話)
   */
  const parseResponseToSegments = (text) => {
    const rawSegments = text.split(/(\[.*?\]|\(.*?\))|\n+/g);
    const results = [];
    for (const seg of rawSegments) {
      if (!seg || !seg.trim()) continue;
      const content = seg.trim();

      // [Firewall] 防火牆
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
   * [Core Logic] 處理內容並推入歷史 (核心解析函式)
   * 負責識別 [SPEAKER:...] 或 (Angel:...) 並拆分訊息
   */
  const processContentAndPush = (rawContent, defaultSpeaker, metaMode, isHistoryLoad = false) => {
    // 策略 A: 處理 [SPEAKER:name] 格式 (新版 Group Chat / Background Chat)
    if (rawContent.includes('[SPEAKER:')) {
        const parts = rawContent.split(/\[SPEAKER:(.*?)\]/s).filter(p => p && p.trim());
        const resultQueue = [];

        // parts 結構: [speaker1, text1, speaker2, text2...]
        for (let i = 0; i < parts.length; i += 2) {
            const speakerName = parts[i]?.toLowerCase() || 'demon'; 
            const text = parts[i+1];
            if (!text) continue;

            const segments = parseResponseToSegments(text);
            resultQueue.push({ speaker: speakerName, segments });
        }
        return resultQueue;
    }

    // 策略 B: 處理 (Angel: ...) 混合格式 (舊版 Group Chat)
    // 這種格式通常是: "Demon text... \n (Angel: Angel text...)"
    if (rawContent.includes('(Angel:') || rawContent.startsWith('[Angel]')) {
        const resultQueue = [];
        // 使用 Regex 切割出 Angel 的部分
        const parts = rawContent.split(/(\(Angel:[\s\S]*?\)|\[Angel\][\s\S]*)/g);

        for (const p of parts) {
            if (!p.trim()) continue;
            
            let currentPartSpeaker = defaultSpeaker; // 預設跟隨主發言者 (通常是 Demon)
            let text = p;

            // 偵測 Angel 標記
            if (p.startsWith('(Angel:') || p.startsWith('[Angel]')) {
                currentPartSpeaker = 'angel';
                text = p.replace(/^\(Angel:|\[Angel\]/, '').replace(/\)$/, '').trim();
            }

            const segments = parseResponseToSegments(text);
            resultQueue.push({ speaker: currentPartSpeaker, segments });
        }
        return resultQueue;
    }

    // 策略 C: 一般訊息 (無特殊標記)
    return [{ speaker: defaultSpeaker, segments: parseResponseToSegments(rawContent) }];
  };

  /**
   * [Typer] 打字機效果
   */
  const typeSegments = async (segments, speaker, metaMode) => {
    isTyping.value = true;
    currentSpeaker.value = speaker;

    for (const seg of segments) {
      const speed = seg.type === 'text' ? 30 : 10; 
      
      const newMessage = {
        role: 'assistant',
        speaker: speaker, // UI 用：決定頭像顏色 (angel/demon)
        meta: { speaker: metaMode }, // Filter 用：決定在哪個頻道顯示
        speakerName: 'Lilith',
        contentType: seg.type,
        content: ''
      };
      
      messageHistory.value.push(newMessage);
      scrollToBottom();

      const fullText = seg.content;
      for (let i = 0; i < fullText.length; i++) {
        newMessage.content += fullText[i];
        if (i % 2 === 0) scrollToBottom(); 
        await new Promise(r => setTimeout(r, speed));
      }
      await new Promise(r => setTimeout(r, 400));
    }
    isTyping.value = false;
  };

  /**
   * [Loader] 載入歷史紀錄
   */
  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/history?conversationId=${conversationId}`);
      if (!res.ok) return;
      
      const data = await res.json();
      const history = data.history || [];

      messageHistory.value = [];

      for (const msg of history) {
        // A. User 訊息
        if (msg.role === 'user') {
          messageHistory.value.push({
            role: 'user',
            content: msg.content,
            contentType: 'text',
            meta: msg.meta || { target: 'demon' }
          });
          continue;
        }

        // B. Assistant 訊息
        if (msg.role === 'assistant') {
          // 決定預設的 speaker 與 metaMode
          let defaultSpeaker = 'demon';
          let metaMode = 'demon';

          if (msg.meta && msg.meta.speaker) {
              metaMode = msg.meta.speaker;
              // 如果是 Group 模式，預設視覺 Speaker 設為 Demon (稍後會被解析器覆蓋)
              defaultSpeaker = (metaMode === 'group' || metaMode === 'demon') ? 'demon' : 'angel';
          } else if (msg.content.includes('(Angel:') || msg.content.startsWith('[Angel]')) {
              // 舊資料 fallback
              metaMode = 'angel';
              defaultSpeaker = 'angel';
          }

          // 透過統一解析器處理 (這裡會正確拆分 Demon 與 Angel 的發言)
          const queue = processContentAndPush(msg.content, defaultSpeaker, metaMode, true);

          // 將解析結果推入歷史 (無動畫)
          queue.forEach(item => {
              item.segments.forEach(seg => {
                  messageHistory.value.push({
                      role: 'assistant',
                      speaker: item.speaker, // 這裡會是正確的 'demon' 或 'angel'
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
   * [Sender] 發送訊息
   */
  const sendMessage = async () => {
    if (!userInput.value.trim() || isThinking.value) return;
    const text = userInput.value;
    const currentMode = chatMode.value; 

    messageHistory.value.push({ 
      role: 'user', 
      content: text,
      contentType: 'text',
      meta: { target: currentMode } 
    });
    
    userInput.value = '';
    scrollToBottom();
    isThinking.value = true;

    try {
      const res = await fetch('/api/chat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: currentMode, conversationId })
      });
      const data = await res.json();
      
      if (data.emotion) emotion.value = { ...emotion.value, ...data.emotion };
      isThinking.value = false;
      
      const messages = data.messages || [];
      
      // 處理每一則回傳訊息
      for (const rawMsg of messages) {
        // 預設參數
        let defaultSpeaker = currentMode === 'angel' ? 'angel' : 'demon';
        let metaMode = currentMode === 'group' ? 'group' : defaultSpeaker;

        // 使用統一解析器
        const queue = processContentAndPush(rawMsg, defaultSpeaker, metaMode);

        // 依序演繹 (打字機動畫)
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
        content: "⚠️ System Offline: 連線失敗", 
        contentType: 'scene', 
        meta: { speaker: currentMode } 
      });
      isThinking.value = false;
    }
  };

  onMounted(() => {
    loadHistory();
  });

  return {
    userInput,
    messageHistory,
    filteredHistory,
    displayedText,
    isTyping,
    isThinking,
    chatContainer,
    sendMessage
  };
}
import { ref, nextTick, computed, onMounted } from 'vue';

export function useChat(conversationId, chatMode, currentSpeaker, emotion) {
  const userInput = ref('');
  const messageHistory = ref([]); 
  const displayedText = ref(''); 
  const isTyping = ref(false);
  const isThinking = ref(false);
  const chatContainer = ref(null);

  /**
   * [Filter] 頻道過濾邏輯 (嚴格分流)
   * 只有當訊息的 meta.speaker 與當前 chatMode 完全一致時才顯示。
   */
  const filteredHistory = computed(() => {
    const currentMode = chatMode.value;
    return messageHistory.value.filter(msg => {
      if (msg.role === 'system') return true;

      // 判斷訊息歸屬
      let msgTarget = 'demon';
      if (msg.role === 'user') {
        msgTarget = msg.meta?.target || 'demon';
      } else {
        msgTarget = msg.meta?.speaker || 'demon';
      }

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
   * [Parser] 分鏡解析器 (場景/動作/對話)
   */
  const parseResponseToSegments = (text) => {
    const rawSegments = text.split(/(\[.*?\]|\(.*?\))|\n+/g);
    const results = [];
    for (const seg of rawSegments) {
      if (!seg || !seg.trim()) continue;
      const content = seg.trim();

      // [Firewall] 防火牆：確保單人模式下不會出現另一個人格的名字
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
   * [Core Logic] 內容處理與人格識別 (潔淨版)
   * 僅依賴 [SPEAKER:...] 標籤與預設值，不再進行模糊猜測
   */
  const processContentAndPush = (rawContent, defaultSpeaker) => {
    const resultQueue = [];
    
    // Regex: 嚴格抓取 [SPEAKER:name]
    const speakerRegex = /\[SPEAKER:(.*?)\]([\s\S]*?)(?=\[SPEAKER:|$)/g;

    // --- 策略 A: 含有明確標記 (Group Mode / Background Chat) ---
    if (rawContent.includes('[SPEAKER:')) {
        // 1. 處理標籤前的遺留文字 (通常是無)
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

        // 2. 循環解析標籤
        let match;
        while ((match = speakerRegex.exec(rawContent)) !== null) {
            const name = match[1].toLowerCase().trim(); // 'demon' or 'angel'
            const text = match[2].trim();
            if (text) {
                resultQueue.push({ 
                    speaker: name, // 這裡決定了頭像顏色 (紅/藍)
                    segments: parseResponseToSegments(text) 
                });
            }
        }
        
        return resultQueue;
    }

    // --- 策略 B: 無標記 (單人模式或預設) ---
    // 直接使用傳入的 defaultSpeaker
    return [{ 
        speaker: defaultSpeaker, 
        segments: parseResponseToSegments(rawContent) 
    }];
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
        speaker: speaker, // UI: 頭像顏色
        meta: { speaker: metaMode }, // Filter: 頻道歸屬
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
   * [Loader] 載入歷史紀錄 (嚴格模式)
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
          // 1. 讀取頻道歸屬 (meta.speaker)
          // 乾淨的資料庫中，這必定是 'demon', 'angel', 或 'group'
          let metaMode = msg.meta?.speaker || 'demon';
          
          // 2. 決定預設視覺 (Default Speaker)
          // Angel 頻道 -> 必定是 Angel (藍)
          // Demon 頻道 -> 必定是 Demon (紅)
          // Group 頻道 -> 預設 Demon (紅)，但會透過 processContentAndPush 解析 [SPEAKER:angel] 轉藍
          let defaultSpeaker = (metaMode === 'angel') ? 'angel' : 'demon';

          // 3. 解析內容
          const queue = processContentAndPush(msg.content, defaultSpeaker);

          // 4. 推入歷史
          queue.forEach(item => {
              item.segments.forEach(seg => {
                  messageHistory.value.push({
                      role: 'assistant',
                      speaker: item.speaker, // 這是最終確定的視覺效果
                      meta: { speaker: metaMode }, // 這是頻道歸屬
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

    // User 訊息推入
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
      
      // 處理回傳
      for (const rawMsg of messages) {
        // 發送時的預設邏輯與 loadHistory 一致
        let defaultSpeaker = (currentMode === 'angel') ? 'angel' : 'demon';
        let metaMode = (currentMode === 'group') ? 'group' : defaultSpeaker;

        // 解析
        const queue = processContentAndPush(rawMsg, defaultSpeaker);

        // 演繹
        for (const item of queue) {
            await typeSegments(item.segments, item.speaker, metaMode);
        }

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

  // [New] 暴露一個 reset 方法給 console 用 (方便開發測試)
  const resetDB = async () => {
      await fetch('/api/history/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId })
      });
      location.reload();
  };

  return {
    userInput,
    messageHistory,
    filteredHistory,
    displayedText,
    isTyping,
    isThinking,
    chatContainer,
    sendMessage,
    resetDB // 可在 Vue DevTools 或按鈕中呼叫
  };
}
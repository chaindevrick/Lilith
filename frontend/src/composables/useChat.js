import { ref, nextTick, computed } from 'vue';

export function useChat(conversationId, chatMode, currentSpeaker, emotion) {
  const userInput = ref('');
  const messageHistory = ref([]); 
  const displayedText = ref(''); 
  const isTyping = ref(false);
  const isThinking = ref(false);
  const chatContainer = ref(null);

  /**
   * [Filter] 頻道過濾邏輯
   * 根據當前 chatMode ('demon' | 'angel' | 'group') 篩選顯示的訊息
   */
  const filteredHistory = computed(() => {
    const currentMode = chatMode.value;
    return messageHistory.value.filter(msg => {
      // 1. 系統訊息永遠顯示
      if (msg.role === 'system') return true;
      
      // 2. Group 模式顯示所有訊息
      if (currentMode === 'group') return true;

      // 3. 單人模式下的過濾
      let msgTarget = msg.meta?.target || msg.meta?.speaker || 'demon';
      
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
   * [Parser] 核心解析器：將長字串拆解為分鏡片段
   * 識別 [...] 為場景，(...) 為動作，其餘為對話
   */
  const parseResponseToSegments = (text) => {
    // Regex: 捕獲 [...] 或 (...)，並以換行符分割
    const rawSegments = text.split(/(\[.*?\]|\(.*?\))|\n+/g);
    
    const results = [];
    for (const seg of rawSegments) {
      if (!seg || !seg.trim()) continue;
      const content = seg.trim();

      // [Firewall] 人格防火牆：防止跨人格內容洩漏
      // 只有在單人模式下才開啟防火牆，Group 模式不過濾
      if (chatMode.value === 'demon' && (content.startsWith('Angel:') || content.includes('[Angel]'))) continue;
      if (chatMode.value === 'angel' && (content.startsWith('Demon:') || content.includes('[Lilith]'))) continue;

      // 分類
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
   * [Typer] 逐段輸入效果
   */
  const typeSegments = async (segments, speaker, metaMode) => {
    isTyping.value = true;
    currentSpeaker.value = speaker;

    for (const seg of segments) {
      // 根據類型決定打字速度 (場景/動作快一點，對話慢一點)
      const speed = seg.type === 'text' ? 30 : 10; 
      
      // 建立新的訊息物件
      const newMessage = {
        role: 'assistant',
        speaker: speaker,
        meta: { speaker: metaMode },
        speakerName: 'Lilith',
        contentType: seg.type, // 'scene' | 'action' | 'text'
        content: ''
      };
      
      // 推入歷史陣列
      messageHistory.value.push(newMessage);
      scrollToBottom();

      // 執行打字機效果
      const fullText = seg.content;
      for (let i = 0; i < fullText.length; i++) {
        newMessage.content += fullText[i];
        // 降低 DOM 操作頻率，每 2 字捲動一次
        if (i % 2 === 0) scrollToBottom(); 
        await new Promise(r => setTimeout(r, speed));
      }
      
      // 段落間停頓，讓閱讀更有節奏感
      await new Promise(r => setTimeout(r, 400));
    }

    isTyping.value = false;
  };

  const sendMessage = async () => {
    if (!userInput.value.trim() || isThinking.value) return;
    const text = userInput.value;
    const currentMode = chatMode.value; // 鎖定發送當下的模式

    // 推入 User 訊息
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
      
      // 更新數值
      if (data.emotion) emotion.value = { ...emotion.value, ...data.emotion };
      isThinking.value = false;
      
      // [Update] 處理後端回傳的多條訊息 (支援 Speaker Tag)
      const messages = data.messages || [];
      
      for (const rawMsg of messages) {
        let speaker = currentMode === 'angel' ? 'angel' : 'demon'; // 預設值
        let content = rawMsg;
        
        // 1. 解析 Speaker Tag: [SPEAKER:angel]...
        const match = rawMsg.match(/^\[SPEAKER:(.*?)\](.*)/s);
        if (match) {
          speaker = match[1].toLowerCase(); // 'demon' or 'angel'
          content = match[2];
        } 

        // 2. 解析分鏡 (場景/動作/對話)
        const segments = parseResponseToSegments(content);
        
        // 3. 執行打字演繹
        // metaMode 使用 'group' 或當前模式，確保在 group 模式下訊息不會被過濾掉
        const metaMode = currentMode === 'group' ? 'group' : speaker;
        await typeSegments(segments, speaker, metaMode);
        
        // 4. 多人對話間的停頓 (讓兩人對話有間隔感)
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
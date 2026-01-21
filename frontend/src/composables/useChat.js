import { ref, nextTick, computed } from 'vue';

export function useChat(conversationId, chatMode, currentSpeaker, emotion) {
  const userInput = ref('');
  const messageHistory = ref([]); // 原始完整歷史
  const displayedText = ref('');
  const isTyping = ref(false);
  const isThinking = ref(false);
  const chatContainer = ref(null);

  /**
   * 嚴格的對話串過濾邏輯
   */
  const filteredHistory = computed(() => {
    const currentMode = chatMode.value; // 'demon' | 'angel' | 'group'

    return messageHistory.value.filter(msg => {
      if (msg.role === 'system') return true;
      
      let msgMode = 'demon';
      if (msg.role === 'user') {
        msgMode = msg.meta?.target || 'demon';
      } else {
        msgMode = msg.meta?.speaker || 'demon';
      }

      return msgMode === currentMode;
    });
  });

  const scrollToBottom = () => {
    nextTick(() => { if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight; });
  };

  const typeText = async (fullText, speaker, metaMode) => {
    isTyping.value = true;
    currentSpeaker.value = speaker;
    displayedText.value = '';
    
    for (let i = 0; i < fullText.length; i++) {
      displayedText.value += fullText[i];
      scrollToBottom();
      if (['，', '。', '...'].includes(fullText[i])) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 20));
    }
    
    messageHistory.value.push({
      role: 'assistant',
      speaker: speaker,
      meta: { speaker: metaMode }, 
      speakerName: speaker === 'angel' ? 'Angel' : 'Lilith',
      content: fullText
    });
    
    displayedText.value = '';
    isTyping.value = false;
    scrollToBottom();
  };

  // [Update] 支援 attachments
  const sendMessage = async (attachments = []) => {
    const text = userInput.value;
    // 允許僅發送附件 (文字為空)
    if ((!text.trim() && attachments.length === 0) || isThinking.value) return;
    
    const currentMode = chatMode.value;

    // 1. 推入 User 訊息
    messageHistory.value.push({ 
      role: 'user', 
      content: text,
      attachments: attachments, // 儲存預覽用
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
          attachments: attachments, // 傳遞給後端
          mode: currentMode, 
          conversationId 
        })
      });
      const data = await res.json();
      
      if (data.emotion) emotion.value = { ...emotion.value, ...data.emotion };
      isThinking.value = false;
      
      // 3. 處理回傳訊息
      for (const msg of data.messages) {
        let speaker = 'demon';
        let content = msg;
        
        if (msg.includes('(Angel:') || msg.startsWith('[Angel]')) {
          speaker = 'angel';
          content = msg.replace(/\(Angel:|\[Angel\]/g, '').replace(/\)/g, '').trim();
        } else if (currentMode === 'angel') {
          speaker = 'angel';
        }

        await typeText(content, speaker, currentMode);
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.error(e);
      messageHistory.value.push({ role: 'system', content: "⚠️ System Offline", meta: { speaker: currentMode } });
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
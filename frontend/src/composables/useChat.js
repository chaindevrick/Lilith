import { ref, nextTick, computed, onMounted } from 'vue';

export function useChat(defaultConversationId, chatMode, currentSpeaker, emotion) {
  const userInput = ref('');
  const messageHistory = ref([]); 
  const displayedText = ref(''); 
  const isTyping = ref(false);
  const isThinking = ref(false);
  const chatContainer = ref(null);
  const currentConversationId = ref(defaultConversationId);

  /**
   * [Init] 初始化身份識別
   * 優先順序: URL (?cid=...) > 後端設定 (DISCORD_OWNER_ID) > 預設值
   */
  const initIdentity = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCid = urlParams.get('cid');

    if (urlCid) {
        // 1. 如果網址有指定，優先使用
        currentConversationId.value = urlCid;
        console.log(`[useChat] Identity Mode: URL Override (${urlCid})`);
        await loadHistory();
    } else {
        try {
            // 2. 嘗試從後端獲取設定
            const res = await fetch('/api/settings');
            if (res.ok) {
                const settings = await res.json();
                if (settings.DISCORD_OWNER_ID) {
                    currentConversationId.value = settings.DISCORD_OWNER_ID;
                    console.log(`[useChat] Identity Mode: Owner Synced (${settings.DISCORD_OWNER_ID})`);
                } else {
                    console.log(`[useChat] Identity Mode: Default (No Owner ID found)`);
                }
            }
        } catch (e) {
            console.warn("[useChat] Failed to fetch settings, using default ID.");
        }
        // 無論有無抓到設定，最後都載入歷史
        await loadHistory();
    }
  };

  /**
   * [Filter] 頻道過濾邏輯
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
   * [Parser] 分鏡解析器
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
   * [Core Logic] 內容處理與人格識別
   */
  const processContentAndPush = (rawContent, defaultSpeaker) => {
    const resultQueue = [];
    const speakerRegex = /\[SPEAKER:(.*?)\]([\s\S]*?)(?=\[SPEAKER:|$)/g;

    if (rawContent.includes('[SPEAKER:')) {
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

        let match;
        while ((match = speakerRegex.exec(rawContent)) !== null) {
            const name = match[1].toLowerCase().trim();
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
        speaker: speaker,
        meta: { speaker: metaMode },
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
      // [Update] 使用動態決定的 ID
      const targetId = currentConversationId.value;
      const res = await fetch(`/api/history?conversationId=${targetId}`);
      if (!res.ok) return;
      
      const data = await res.json();
      const history = data.history || [];

      messageHistory.value = [];

      for (const msg of history) {
        if (msg.role === 'user') {
          messageHistory.value.push({
            role: 'user',
            content: msg.content,
            contentType: 'text',
            meta: msg.meta || { target: 'demon' }
          });
          continue;
        }

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
   * [Sender] 發送訊息
   */
  const sendMessage = async () => {
    if (!userInput.value.trim() || isThinking.value) return;
    const text = userInput.value;
    const currentMode = chatMode.value; 
    const targetId = currentConversationId.value; // [Update]

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
      // [Update] 傳送正確的 ID
      const res = await fetch('/api/chat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: currentMode, conversationId: targetId })
      });
      const data = await res.json();
      
      if (data.emotion) emotion.value = { ...emotion.value, ...data.emotion };
      isThinking.value = false;
      
      const messages = data.messages || [];
      
      for (const rawMsg of messages) {
        let defaultSpeaker = (currentMode === 'angel') ? 'angel' : 'demon';
        let metaMode = (currentMode === 'group') ? 'group' : defaultSpeaker;

        const queue = processContentAndPush(rawMsg, defaultSpeaker);

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
    initIdentity();
  });

  const resetDB = async () => {
      await fetch('/api/history/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: currentConversationId.value })
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
    resetDB,
    currentConversationId
  };
}
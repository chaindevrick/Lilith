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
   */
  const filteredHistory = computed(() => {
    const currentMode = chatMode.value;
    
    // 1. 如果是 Group 模式，顯示「所有」訊息 (上帝視角)
    if (currentMode === 'group') {
      return messageHistory.value;
    }

    // 2. 單人模式 (Demon / Angel)：只顯示屬於該人格的訊息
    return messageHistory.value.filter(msg => {
      // 系統訊息例外，永遠顯示 (例如連線失敗)
      if (msg.role === 'system') return true;

      // 判斷目標對象
      let target = 'demon'; // 預設歸屬

      if (msg.role === 'user') {
        // User 的訊息看 meta.target
        target = msg.meta?.target || 'demon';
      } else {
        // Assistant 的訊息看 meta.speaker
        target = msg.meta?.speaker || 'demon';
      }

      // 嚴格比對：只有當訊息的歸屬 = 當前模式時才顯示
      // (這意味著 Group 模式產生的訊息，若標記為 'group'，在單人模式下會被隱藏，這是正確的)
      return target === currentMode;
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
   * [Parser] 核心解析器
   */
  const parseResponseToSegments = (text) => {
    const rawSegments = text.split(/(\[.*?\]|\(.*?\))|\n+/g);
    const results = [];
    for (const seg of rawSegments) {
      if (!seg || !seg.trim()) continue;
      const content = seg.trim();

      // [Firewall] 防火牆：在單人模式過濾掉不該出現的台詞
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
        meta: { speaker: metaMode }, // 確保 meta 被正確寫入
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
   * [Loader] 載入歷史紀錄 (修正 meta 判斷)
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
            // 如果是舊紀錄沒有 meta，預設為 demon；否則使用紀錄中的 target
            meta: msg.meta || { target: 'demon' }
          });
          continue;
        }

        // B. Assistant 訊息
        if (msg.role === 'assistant') {
          const rawContent = msg.content;
          
          // --- 情況 1: 含有 [SPEAKER:xxx] 標記 (群組對話) ---
          if (rawContent.includes('[SPEAKER:')) {
             const parts = rawContent.split(/\[SPEAKER:(.*?)\]/s).filter(p => p && p.trim());
             
             // 格式: [speaker, content, speaker, content...]
             for (let i = 0; i < parts.length; i += 2) {
                const speakerName = parts[i]?.toLowerCase() || 'demon'; 
                const text = parts[i+1];
                
                if (!text) continue;

                // 這裡很關鍵：我們將解析出來的 speaker 直接作為 meta
                // 這樣 Angel 的話就會被標記為 angel，Demon 模式下就會隱藏
                const segments = parseResponseToSegments(text);
                segments.forEach(seg => {
                   messageHistory.value.push({
                      role: 'assistant',
                      speaker: speakerName,
                      meta: { speaker: speakerName }, // <--- 強制寫入正確的人格標籤
                      speakerName: 'Lilith',
                      contentType: seg.type,
                      content: seg.content
                   });
                });
             }
          } 
          // --- 情況 2: 一般訊息 ---
          else {
             // 嘗試還原正確的 meta
             let speaker = 'demon';
             let metaMode = 'demon';

             // 1. 先看 DB 有沒有存 meta
             if (msg.meta && msg.meta.speaker) {
                 speaker = msg.meta.speaker;
                 metaMode = msg.meta.speaker;
             }
             // 2. 若沒存 meta (舊紀錄)，嘗試從內容判斷 Angel
             else if (rawContent.includes('(Angel:') || rawContent.startsWith('[Angel]')) {
                 speaker = 'angel';
                 metaMode = 'angel';
             }

             // 清理舊格式 (可選)
             let cleanContent = rawContent.replace(/^\(Angel:/, '').replace(/\)$/, '').trim();

             const segments = parseResponseToSegments(cleanContent);
             segments.forEach(seg => {
                messageHistory.value.push({
                   role: 'assistant',
                   speaker: speaker,
                   meta: { speaker: metaMode }, // <--- 確保使用偵測到的人格
                   speakerName: 'Lilith',
                   contentType: seg.type,
                   content: seg.content
                });
             });
          }
        }
      }
      
      scrollToBottom();
    } catch (e) {
      console.error("[useChat] Load history failed:", e);
    }
  };

  const sendMessage = async () => {
    if (!userInput.value.trim() || isThinking.value) return;
    const text = userInput.value;
    const currentMode = chatMode.value; 

    // 發送時，明確寫入 target 為當前模式
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
      
      for (const rawMsg of messages) {
        let speaker = currentMode === 'angel' ? 'angel' : 'demon'; 
        let content = rawMsg;
        
        // 解析 Speaker Tag
        const match = rawMsg.match(/^\[SPEAKER:(.*?)\](.*)/s);
        if (match) {
          speaker = match[1].toLowerCase(); 
          content = match[2];
        } 

        const segments = parseResponseToSegments(content);
        
        const metaMode = speaker; 

        await typeSegments(segments, speaker, metaMode);
        
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
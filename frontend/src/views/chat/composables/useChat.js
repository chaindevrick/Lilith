// src/composables/useChat.js
import { ref, nextTick } from 'vue';
import { useChatStore } from '../../../stores/chatStore'; // 引入你的 Store 以便同步資料

export function useChat(defaultConversationId, updateStatsCallback) {
    const userInput = ref('');
    const messageHistory = ref([]);
    const isTyping = ref(false);
    const isThinking = ref(false);
    const totalTokens = ref(0); // 🌟 新增：管理當前對話的總 Token 消耗
    const currentConversationId = ref(defaultConversationId || 'web_user');

    const savedUserName = localStorage.getItem('lilith_user_name') || 'User';
    const chatStore = useChatStore(); // 🌟 初始化 Store

    const parseMessage = (rawContent) => {
        if (!rawContent) return [];
        const segments = [];
        const imgRegex = /<lilith-img\s+src="([^"]+)"\s*><\/lilith-img>/g;
        let lastIndex = 0;
        let match;

        while ((match = imgRegex.exec(rawContent)) !== null) {
            if (match.index > lastIndex) {
                segments.push({ type: 'text', content: rawContent.substring(lastIndex, match.index) });
            }
            segments.push({ type: 'image', url: match[1] });
            lastIndex = imgRegex.lastIndex;
        }

        if (lastIndex < rawContent.length) {
            segments.push({ type: 'text', content: rawContent.substring(lastIndex) });
        }
        return segments.length > 0 ? segments : [{ type: 'text', content: rawContent }];
    };

    const loadHistory = async () => {
        try {
            const res = await fetch(`/api/history?conversationId=${currentConversationId.value}`);
            const data = await res.json();
            
            messageHistory.value = (data.history || []).map(msg => ({
                role: msg.role,
                segments: parseMessage(msg.content),
                rawContent: msg.content
            }));

            // 🌟 讀取歷史時，同步更新 Token 總數
            if (data.totalTokens !== undefined) {
                totalTokens.value = data.totalTokens;
                chatStore.totalTokens = data.totalTokens; // 同步至 Store 給其他元件使用
            }
            
            nextTick(() => { /* 觸發滾動邏輯 */ });
        } catch (e) {
            console.error("Load history failed", e);
        }
    };

    const sendMessage = async (text, attachments = []) => {
        if (!text.trim() && attachments.length === 0) return;

        const processedAttachments = await Promise.all(attachments.map(async (file) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve({
                    name: file.name,
                    type: file.type,
                    base64: reader.result.split(',')[1]
                });
            });
        }));

        const userMsg = { 
            role: 'user', 
            segments: [{ type: 'text', content: text }], 
            rawContent: text, 
            attachments: processedAttachments 
        };
        
        messageHistory.value.push(userMsg);
        userInput.value = '';
        isThinking.value = true;

        try {
            const payload = {
                message: text,
                attachments: processedAttachments,
                conversationId: currentConversationId.value,
                userName: savedUserName
            };

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            if (data.emotion && updateStatsCallback) {
                updateStatsCallback(data.emotion);
            }

            if (data.totalTokens !== undefined) {
                totalTokens.value = data.totalTokens;
                chatStore.totalTokens = data.totalTokens; // 同步至 Store
            }

            if (data.messages && data.messages.length > 0) {
                for (const msgContent of data.messages) {
                    const cleanContent = msgContent.replace(/\[SPEAKER:(demon|angel|group)\]/g, '').trim();
                    messageHistory.value.push({
                        role: 'assistant',
                        segments: parseMessage(cleanContent),
                        rawContent: cleanContent
                    });
                }
            }
        } catch (e) {
            messageHistory.value.push({ 
                role: 'assistant', 
                segments: [{ type: 'text', content: "⚠️ 系統連線異常或伺服器無回應。" }] 
            });
        } finally {
            isThinking.value = false;
        }
    };

    const resetHistory = async () => {
        try {
            await fetch('/api/history/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId: currentConversationId.value })
            });
            messageHistory.value = [];
            totalTokens.value = 0; // 重置 Token
            chatStore.totalTokens = 0;
        } catch (e) {
            console.error("Reset history failed", e);
        }
    };

    return { 
        userInput, 
        messageHistory, 
        isTyping, 
        isThinking, 
        currentConversationId, 
        totalTokens,
        sendMessage, 
        loadHistory,
        resetHistory
    };
}
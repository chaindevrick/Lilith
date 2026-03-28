import { appLogger } from '../../src/core/services/logger.js';

const getHistory = async (channelId, limit, token) => {
    try {
        appLogger.info(`[Discord Skill] Fetching last ${limit} messages for channel: ${channelId}`);
        
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorData}`);
        }

        const messages = await response.json();
        
        // Discord API 預設回傳是由新到舊，我們將其反轉，讓大腦從舊讀到新
        const formattedMessages = messages.reverse().map(msg => {
            const time = new Date(msg.timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
            const author = msg.author.username + (msg.author.bot ? ' [BOT]' : '');
            let content = msg.content || '(無文字內容)';
            
            if (msg.attachments && msg.attachments.length > 0) {
                content += ` [附件: ${msg.attachments.map(a => a.filename).join(', ')}]`;
            }
            
            return `[${time}] ${author}: ${content}`;
        });

        return formattedMessages.length > 0 
            ? `以下是頻道 ${channelId} 的最新 ${formattedMessages.length} 則歷史訊息：\n\n` + formattedMessages.join('\n')
            : `頻道 ${channelId} 目前沒有任何歷史訊息。`;
            
    } catch (error) {
        appLogger.error('[Discord Skill] Fetch History Error:', error.message);
        return `[Error] 獲取 Discord 歷史訊息失敗: ${error.message}`;
    }
};

export default {
    run: async (args, config, entryConfig) => {
        const { action, channelId, limit = 30 } = args;

        appLogger.info(`[Discord Skill] 收到執行請求: action=${action}, channelId=${channelId}`);

        // 讀取全域設定中的 Discord Token
        const token = config.DISCORD_BOT_TOKEN;
        if (!token) {
            return "[Error] 系統尚未設定 DISCORD_BOT_TOKEN，無法呼叫 Discord API。";
        }

        if (action === 'get_history') {
            if (!channelId) return "[Error] 缺少必需參數: channelId";
            
            // 防呆：限制獲取數量在 1~100 之間
            const safeLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 100);
            return await getHistory(channelId, safeLimit, token);
        }

        return `[Error] 未知的 Discord 工具動作: ${action}`;
    }
};
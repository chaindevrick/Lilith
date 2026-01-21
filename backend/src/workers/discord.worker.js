/**
 * src/workers/discord.worker.js
 * 感官模組 (Discord Client)
 */

import { parentPort } from 'worker_threads';
import { Client, GatewayIntentBits, Partials, ChannelType, ActivityType } from 'discord.js';
import { appLogger } from '../config/logger.js';

// ============================================================
// 1. 常數與配置
// ============================================================

const MAX_MSG_LENGTH = 1950; // 保留一些緩衝區 (Discord 上限 2000)
const SUPPORTED_MIME_TYPES = [
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf', 'text/plain', 'text/javascript', 'application/json', 
    'text/x-python', 'text/html', 'text/css'
];

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel] 
});

// ============================================================
// 2. 輔助工具
// ============================================================

/**
 * 智慧切分長訊息
 * @param {string} text - 原始訊息
 * @returns {string[]} 切分後的訊息陣列
 */
const smartSplitMessage = (text) => {
    if (text.length <= MAX_MSG_LENGTH) return [text];
    
    const chunks = [];
    let currentChunk = '';
    
    // 簡單按行切分，若單行過長則強制切分
    const lines = text.split('\n');
    
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > MAX_MSG_LENGTH) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        
        // 如果單行本身就超長 (極少見)，強制切斷
        if (line.length > MAX_MSG_LENGTH) {
            const subChunks = line.match(new RegExp(`.{1,${MAX_MSG_LENGTH}}`, 'g'));
            subChunks.forEach(sub => chunks.push(sub));
        } else {
            currentChunk += (currentChunk ? '\n' : '') + line;
        }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
};

/**
 * 模擬閱讀/打字延遲
 * @param {number} ms 
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// 3. 事件監聽 (Input)
// ============================================================

client.once('ready', () => {
    appLogger.info(`👂 [Discord] 感官模組已連線: ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: "前輩的代碼", type: ActivityType.Watching }], 
        status: 'online'
    });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 判斷是否需要回應 (提及 或 私訊)
    const isMentioned = message.mentions.has(client.user.id);
    const isDM = message.channel.type === ChannelType.DM;

    if (!isMentioned && !isDM) return;

    // 顯示「正在輸入...」
    await message.channel.sendTyping();

    // 1. 處理文字內容 (移除 @Bot)
    let content = message.content.replace(new RegExp(`<@!?${client.user.id}>`), '').trim();
    
    // 2. 處理附件
    const attachments = [];
    if (message.attachments.size > 0) {
        message.attachments.forEach(att => {
            const mime = att.contentType ? att.contentType.split(';')[0].trim() : '';
            if (SUPPORTED_MIME_TYPES.includes(mime) || mime.startsWith('text/')) {
                attachments.push({
                    url: att.url,
                    mimeType: mime,
                    name: att.name
                });
            }
        });
        
        // 若只有圖片沒文字，補充說明
        if (!content && attachments.length > 0) {
            content = "(使用者傳送了檔案)";
        }
    }

    if (!content && attachments.length === 0) return;

    // 3. 傳送至中樞 (Main)
    parentPort.postMessage({
        type: 'USER_INPUT',
        payload: {
            conversationId: message.author.id, // 綁定使用者 ID (建立私人連結)
            channelId: message.channel.id,     // 回應用頻道 ID
            authorName: message.author.username,
            content: content,
            attachments: attachments,
            mode: 'demon' // [Unified] 統一使用惡魔人格回應
        }
    });
});

// ============================================================
// 4. 回應處理 (Output)
// ============================================================

parentPort.on('message', async (msg) => {
    if (msg.type === 'AI_RESPONSE') {
        // payload: { channelId, messages, emotion }
        const { channelId: targetId, messages } = msg.payload; 
        
        // 防呆：確保 messages 是陣列
        const msgList = Array.isArray(messages) ? messages : [messages];
        if (!msgList || msgList.length === 0) return;

        try {
            // --- 1. 目標解析 (Channel or User) ---
            let target = null;

            // A. 嘗試取得頻道
            try {
                target = await client.channels.fetch(targetId);
            } catch (e) { /* Ignore */ }

            // B. 若非頻道，嘗試取得用戶 (主動私訊用)
            if (!target) {
                try {
                    const user = await client.users.fetch(targetId);
                    if (user) target = user; 
                } catch (e) {
                    appLogger.error(`[Discord] 無法解析目標 ID: ${targetId}`);
                    return;
                }
            }

            if (!target) return;

            // --- 2. 訊息發送迴圈 ---
            for (const rawText of msgList) {
                if (!rawText) continue;

                // 切分長訊息 (2000字限制)
                const chunks = smartSplitMessage(rawText);

                for (const chunk of chunks) {
                    // 模擬打字狀態
                    if (target.sendTyping) await target.sendTyping();

                    // 計算閱讀時間 (每字 20ms，最短 1秒，最長 3秒)
                    const typeTime = Math.max(1000, Math.min(3000, chunk.length * 20));
                    await wait(typeTime);

                    try {
                        await target.send(chunk);
                    } catch (sendError) {
                        appLogger.error(`[Discord] 發送失敗:`, sendError);
                    }
                }
            }

        } catch (error) {
            appLogger.error(`[Discord] 處理回應失敗:`, error);
        }
    }
});

// ============================================================
// 5. 啟動程序
// ============================================================

if (!process.env.DISCORD_TOKEN) {
    appLogger.error("❌ [Discord] 缺少 DISCORD_TOKEN");
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
    appLogger.error("❌ [Discord] 登入失敗:", err);
    process.exit(1);
});
/**
 * src/workers/discord.worker.js
 * 感官模組 (Discord Client) - Galgame Cinematic Edition
 */

import { parentPort } from 'worker_threads';
import { Client, GatewayIntentBits, Partials, ChannelType, ActivityType } from 'discord.js';
import { appLogger } from '../config/logger.js';

// ============================================================
// 1. 常數與配置
// ============================================================

const MAX_MSG_LENGTH = 1950; // Discord 上限 2000，保留緩衝
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
// 2. 輔助工具 (Utils)
// ============================================================

/**
 * 模擬延遲 (Promise based wait)
 */
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * [Fallback] 傳統長訊息切分 (針對單一段落過長的情況)
 */
const simpleSplit = (text) => {
    if (text.length <= MAX_MSG_LENGTH) return [text];
    const chunks = [];
    let currentChunk = '';
    const lines = text.split('\n');
    for (const line of lines) {
        if (currentChunk.length + line.length + 1 > MAX_MSG_LENGTH) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
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
 * [Cinematic Sender] 分鏡訊息發送器
 * 解析 LLM 回應，拆解場景與動作，並依序發送
 * @param {Object} channel - Discord Channel 或 User 物件
 * @param {String} fullText - 完整回應內容
 */
const sendCinematicResponse = async (channel, fullText) => {
    // 1. [Parser] 正則拆分：[場景]、(動作)、或 換行
    const rawSegments = fullText.split(/(\[.*?\]|\(.*?\))|\n+/g);
    
    const segments = [];
    const currentMode = 'demon'; // Discord 端預設主要以 Demon 視角回應

    // 2. [Filter & Classify] 過濾與分類
    for (const seg of rawSegments) {
        if (!seg || !seg.trim()) continue;
        const content = seg.trim();

        // [Firewall] 簡易人格防火牆：防止 Demon 模式下洩漏 Angel 的台詞
        if (currentMode === 'demon' && (content.startsWith('Angel:') || content.includes('[Angel]'))) continue;

        // 分類片段
        if (content.startsWith('[') && content.endsWith(']')) {
            segments.push({ type: 'scene', content });
        } else if (content.startsWith('(') && content.endsWith(')')) {
            segments.push({ type: 'action', content });
        } else {
            segments.push({ type: 'text', content });
        }
    }

    // 3. [Sender] 依序演繹發送
    for (const seg of segments) {
        // 模擬正在輸入... (增加沉浸感)
        if (channel.sendTyping) await channel.sendTyping();

        // 計算閱讀節奏 (場景快，對話慢)
        // 基礎延遲: 500ms, 文字每字 +30ms, 上限 3秒
        let delay = 500; 
        if (seg.type === 'text') {
            delay = 800 + (seg.content.length * 30);
        }
        delay = Math.min(delay, 3000); 

        await wait(delay);

        // [Formatter] Discord Markdown 樣式渲染
        let messagePayload = '';
        
        switch (seg.type) {
            case 'scene':
                // 場景使用引用區塊 (Blockquote) -> > [系統警告]
                messagePayload = `> ${seg.content}`; 
                break;
            case 'action':
                // 動作使用斜體 (Italics) -> * (尾巴晃動) *
                messagePayload = `*${seg.content}*`; 
                break;
            case 'text':
            default:
                // 對話保持原樣
                messagePayload = seg.content;
                break;
        }

        try {
            // 防呆：如果單一片段還是太長 (雖然 Galgame 模式很少見)，做最後的切分
            if (messagePayload.length > MAX_MSG_LENGTH) {
                const subChunks = simpleSplit(messagePayload);
                for (const sub of subChunks) await channel.send(sub);
            } else {
                await channel.send(messagePayload);
            }
        } catch (sendError) {
            appLogger.error(`[Discord] Segment send failed:`, sendError);
        }
    }
};

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
        
        if (!content && attachments.length > 0) {
            content = "(使用者傳送了檔案)";
        }
    }

    if (!content && attachments.length === 0) return;

    // 3. 傳送至中樞 (Main)
    parentPort.postMessage({
        type: 'USER_INPUT',
        payload: {
            conversationId: message.author.id, // 綁定使用者 ID
            channelId: message.channel.id,     // 回應用頻道 ID
            authorName: message.author.username,
            content: content,
            attachments: attachments,
            mode: 'demon' // Discord 固定為 Demon 模式
        }
    });
});

// ============================================================
// 4. 回應處理 (Output)
// ============================================================

parentPort.on('message', async (msg) => {
    if (msg.type === 'AI_RESPONSE') {
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

            // --- 2. 執行分鏡發送 ---
            for (const rawText of msgList) {
                if (!rawText) continue;
                // 使用新的分鏡發送器，取代舊的 smartSplitMessage
                await sendCinematicResponse(target, rawText);
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
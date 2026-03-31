/**
 * src/workers/discord.worker.js
 * Discord 監聽節點與斜線指令處理
 */

import { parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Partials, GatewayIntentBits } from 'discord.js';
import { initializeDatabase } from '../db/sqlite.js';
import { LilithRepository } from '../db/repository.js';
import { appLogger } from '../agents/core/services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, '../configs/config.json');

let client;
let repo;

const initDiscord = async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
        appLogger.warn(`⚠️ [Discord] 找不到配置文件: ${CONFIG_PATH}，請確保已正確設置。`);
        return;
    }
    
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    
    // 🌟 讀取 config.bots 陣列，尋找 Discord 設定
    const bots = config.bots || [];
    const discordConfig = bots.find(b => b.platform === 'discord' || b.id === 'discord');

    // 如果找不到設定，或是 enabled 為 false，直接 return 休眠
    if (!discordConfig || discordConfig.enabled !== true) {
        appLogger.info('ℹ️ [Discord] 社群載體未啟用 (enabled: false)，Discord 節點進入休眠。');
        return;
    }

    const token = discordConfig.apiKey;

    // 如果 enabled 為 true 但沒有填寫 Token
    if (!token) {
        appLogger.warn('⚠️ [Discord] 已啟用但未設定 apiKey，跳過啟動。請至控制台填寫 Token。');
        return;
    }

    try {
        const db = await initializeDatabase();
        repo = new LilithRepository(db);
    } catch (e) {
        appLogger.error('❌ [Discord] 資料庫連線失敗:', e);
        return;
    }

    // 處理不同 discord.js 版本的 Intents 寫法相容性
    let clientIntents;
    try {
        clientIntents = [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMessages, 
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ];
    } catch (e) {
        // 舊版 discord.js 降級處理
        clientIntents = [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.DIRECT_MESSAGES
        ];
    }

    const clientPartials = Partials ? [Partials.Channel] : ['CHANNEL'];

    client = new Client({
        intents: clientIntents,
        partials: clientPartials
    });

    client.once('ready', async () => {
        appLogger.info(`🎮 [Discord] 機器人已成功上線 (${client.user.tag})`);
        
        try {
            await client.application.commands.set([
                {
                    name: 'bind',
                    description: '綁定你的網頁版對話 ID，讓 AI 共享你的記憶與設定。',
                    options: [
                        {
                            name: 'id',
                            description: '網頁版的對話 ID (例如: user_a1b2c3)',
                            type: 3, 
                            required: true
                        },
                        {
                            name: 'name',
                            description: '網頁版的使用者名稱 (例如: user)',
                            type: 3, 
                            required: true
                        }
                    ]
                }
            ]);
            appLogger.info('✅ [Discord] 斜線指令 (/bind) 已成功註冊');
        } catch (e) {
            appLogger.error('❌ [Discord] 註冊斜線指令失敗:', e);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'bind') {
            const conId = interaction.options.getString('id');
            const name = interaction.options.getString('name');
            const discordId = interaction.user.id;

            await repo.savePlatformUser('discord', discordId, conId, name);

            await interaction.reply({ 
                content: `✅ 綁定成功！\n系統已將您的 Discord 帳號與 ID \`${conId}\` 連結，未來將以 **${name}** 稱呼您。`, 
                ephemeral: true 
            });
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const isMentioned = message.mentions.has(client.user);
        const isDM = message.channel.isDMBased();

        if (!isMentioned && !isDM) return;

        let conversationId = `discord_${message.author.id}`;
        let userName = message.author.username;

        const mapping = await repo.getPlatformUser('discord', message.author.id);
        if (mapping) {
            conversationId = mapping.conversation_id;
            userName = mapping.user_name;
        }

        const content = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();        
        const channelId = message.channel.id;
        const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const attachments = [];
        for (const [id, att] of message.attachments) {
            if (att.contentType && att.contentType.startsWith('image/')) {
                try {
                    const res = await fetch(att.url);
                    const buffer = await res.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    attachments.push({ name: att.name, type: att.contentType, base64: base64 });
                } catch (e) { appLogger.error('[Discord] 圖片下載失敗', e); }
            }
        }

        message.channel.sendTyping();

        parentPort.postMessage({
            type: 'DISCORD_CHAT_REQUEST',
            requestId,
            payload: { conversationId, userName, content, attachments, channelId }
        });
    });

    client.login(token).catch(e => {
        appLogger.error('❌ [Discord] 登入失敗:', e);
    });
};

parentPort.on('message', async (msg) => {
    if (msg.type === 'DISCORD_CHAT_RESPONSE') {
        const { channelId, messages } = msg.response;
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                for (const text of messages) {
                    if (text.trim()) {
                        const chunks = text.match(/[\s\S]{1,1900}/g) || [];
                        for (const chunk of chunks) await channel.send(chunk);
                    }
                }
            }
        } catch (e) {
            appLogger.error('[Discord] 回覆發送失敗:', e);
        }
    }
});

// 啟動函式
initDiscord();
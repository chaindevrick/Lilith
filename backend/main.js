/**
 * main.js
 * 系統中樞 (System Hub)
 * 職責：管理 Worker 生命周期、訊息路由 (Switchboard)、處理進程訊號
 */

import dotenv from 'dotenv';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

// ============================================================
// 1. 環境配置
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let discordWorker = null;
let brainWorker = null;
let serverWorker = null;

const WORKER_PATHS = {
    DISCORD: path.join(__dirname, './src/workers/discord.worker.js'),
    BRAIN: path.join(__dirname, './src/workers/brain.worker.js'),
    SERVER: path.join(__dirname, './src/workers/server.worker.js')
};

// ============================================================
// 2. Worker 管理與路由邏輯
// ============================================================

const startDiscordWorker = () => {
    if (!process.env.DISCORD_TOKEN) {
        console.warn('⚠️ [Main] DISCORD_TOKEN 未設定，跳過啟動 Discord Worker。');
        return;
    }

    console.log('🔵 [Main] Starting Discord Worker...');
    discordWorker = new Worker(WORKER_PATHS.DISCORD);

    discordWorker.on('message', (msg) => {
        if (msg.type === 'USER_INPUT' && brainWorker) {
            brainWorker.postMessage(msg);
        }
    });

    discordWorker.on('error', (err) => console.error('🔴 [Discord] Error:', err));
    discordWorker.on('exit', (code) => {
        if (code !== 0) console.error(`🔴 [Discord] Stopped with exit code ${code}`);
    });
};

const startServerWorker = () => {
    console.log('🟢 [Main] Starting Server Worker...');
    serverWorker = new Worker(WORKER_PATHS.SERVER);

    serverWorker.on('message', (msg) => {
        // [路由] Web -> Brain
        if (msg.type === 'WEB_CHAT_REQUEST') {
            const { requestId, payload } = msg;
            if (brainWorker) {
                brainWorker.postMessage({
                    type: 'USER_INPUT',
                    payload: {
                        conversationId: payload.conversationId,
                        channelId: `WEB_REQ::${requestId}`, 
                        authorName: 'WebUser',
                        content: payload.content,
                        attachments: payload.attachments, // [Update] 透傳附件
                        mode: payload.mode, 
                        source: 'web'
                    }
                });
            } else {
                serverWorker.postMessage({
                    type: 'WEB_CHAT_RESPONSE',
                    requestId,
                    response: { messages: ["(系統核心啟動中，請稍後再試...)"] }
                });
            }
        } else if (msg.type === 'CMD_RESTART_BRAIN') {
            console.warn('🔄 [Main] Received RESTART command from Web. Rebooting Brain...');

            dotenv.config({ override: true });

            if (brainWorker) {
                brainWorker.terminate().then(() => {
                    brainWorker = null;
                    setTimeout(startBrainWorker, 500); // 冷卻一下再重啟
                });
            } else {
                startBrainWorker();
            }

            if(discordWorker) {
                discordWorker.terminate().then(() => {
                    discordWorker = null;
                    setTimeout(startDiscordWorker, 500); 
                });
            } else {
                startDiscordWorker();
            }
        }
    });

    serverWorker.on('error', (err) => console.error('🔴 [Server] Error:', err));
};

const startBrainWorker = () => {
    if (!process.env.GEMINI_API_KEY || !process.env.LTM_GEMINI_API_KEY || !process.env.RELATIONSHIP_GEMINI_API_KEY) {
        console.error('🔴 [Main] API_KEY 未設定，無法啟動核心。');
        return;
    }
    console.log('🧠 [Main] Starting Brain Worker...');
    brainWorker = new Worker(WORKER_PATHS.BRAIN);

    brainWorker.on('message', (msg) => {
        if (msg.type === 'AI_RESPONSE') {
            const { channelId } = msg.payload;

            if (channelId && channelId.startsWith('WEB_REQ::')) {
                const requestId = channelId.split('::')[1];
                if (serverWorker) {
                    serverWorker.postMessage({
                        type: 'WEB_CHAT_RESPONSE',
                        requestId,
                        response: msg.payload 
                    });
                }
            } 
            else if (discordWorker) {
                discordWorker.postMessage(msg);
            }
        }
        else if (msg.type === 'RESTART_BRAIN') {
            console.warn('🔄 [Main] Brain requested restart. Rebooting core...');
            brainWorker.terminate().then(() => {
                brainWorker = null;
                setTimeout(startBrainWorker, 1000); 
            });
        }
    });

    brainWorker.on('error', (err) => console.error('🔴 [Brain] Error:', err));
    brainWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`🔴 [Brain] Crashed with code ${code}. Restarting...`);
            setTimeout(startBrainWorker, 3000); 
        }
    });
};

// ============================================================
// 3. 系統啟動入口
// ============================================================

const main = () => {
    console.log('🚀 [Main] System Booting...');
    
    startBrainWorker();   
    startServerWorker();  
    startDiscordWorker(); 

    process.on('uncaughtException', (err) => {
        console.error('💥 [Main] Uncaught Exception:', err);
    });
};

main();
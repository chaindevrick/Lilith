/**
 * main.js
 * 系統中樞 (System Hub)
 * 職責：管理 Worker 生命周期、訊息路由 (Switchboard)、處理進程訊號。
 * 這是 Node.js 的主要入口點，負責啟動 Brain 與 Server 線程。
 */

import dotenv from 'dotenv';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

// 載入環境變數
dotenv.config();

// ============================================================
// 1. 環境配置
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Worker 實例參照
let brainWorker = null;
let serverWorker = null;
let discordWorker = null; // 保留給未來擴充 Discord Bot 使用

const WORKER_PATHS = {
    BRAIN: path.join(__dirname, './src/workers/brain.worker.js'),
    SERVER: path.join(__dirname, './src/workers/server.worker.js')
    // DISCORD: path.join(__dirname, './src/workers/discord.worker.js') 
};

// ============================================================
// 2. Worker 啟動與管理邏輯
// ============================================================

/**
 * 啟動 API Server Worker
 */
const startServerWorker = () => {
    console.log('🟢 [Main] Starting Server Worker...');
    serverWorker = new Worker(WORKER_PATHS.SERVER);

    serverWorker.on('message', (msg) => {
        
        // [Route: Web -> Brain] 來自 Web 的對話請求
        if (msg.type === 'WEB_CHAT_REQUEST') {
            const { requestId, payload } = msg;
            
            if (brainWorker) {
                brainWorker.postMessage({
                    type: 'USER_INPUT',
                    payload: {
                        conversationId: payload.conversationId,
                        channelId: `WEB_REQ::${requestId}`, // 特殊標記，用於回傳路由
                        authorName: 'WebUser',
                        content: payload.content,
                        attachments: payload.attachments,
                        mode: payload.mode, 
                        source: 'web'
                    }
                });
            } else {
                // 若大腦尚未就緒，直接回傳系統訊息
                serverWorker.postMessage({
                    type: 'WEB_CHAT_RESPONSE',
                    requestId,
                    response: { messages: ["(系統核心啟動中，請稍後再試...)"] }
                });
            }
        } 
        
        // [Command] 重啟大腦指令 (來自 Web Settings)
        else if (msg.type === 'CMD_RESTART_BRAIN') {
            console.warn('🔄 [Main] Received RESTART command from Web. Rebooting Brain...');
            
            // 重新讀取 .env (以應用新的 API Key 設定)
            dotenv.config({ override: true });

            if (brainWorker) {
                brainWorker.terminate().then(() => {
                    brainWorker = null;
                    setTimeout(startBrainWorker, 500); // 冷卻後重啟
                });
            } else {
                startBrainWorker();
            }
        }
    });

    serverWorker.on('error', (err) => console.error('🔴 [Server] Error:', err));
    serverWorker.on('exit', (code) => {
        if (code !== 0) console.error(`🔴 [Server] Stopped with exit code ${code}`);
    });
};

/**
 * 啟動 Brain Worker (核心)
 */
const startBrainWorker = () => {
    // 基礎檢查
    if (!process.env.GEMINI_API_KEY) {
        console.error('🔴 [Main] Critical: GEMINI_API_KEY not found. Brain cannot start.');
        return;
    }

    console.log('🧠 [Main] Starting Brain Worker...');
    brainWorker = new Worker(WORKER_PATHS.BRAIN);

    brainWorker.on('message', (msg) => {
        
        // [Route: Brain -> Output] AI 回應路由
        if (msg.type === 'AI_RESPONSE') {
            const { channelId } = msg.payload;

            // 1. 若是 Web 請求 (格式: WEB_REQ::requestId)
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
            // 2. 若是 Discord 請求 (未來擴充)
            else if (discordWorker) {
                discordWorker.postMessage(msg);
            }
        }
        
        // [Command] 大腦自我重啟請求 (來自 evolution.js)
        else if (msg.type === 'RESTART_BRAIN') {
            console.warn('🔄 [Main] Brain requested restart (Self-Evolution). Rebooting core...');
            brainWorker.terminate().then(() => {
                brainWorker = null;
                setTimeout(startBrainWorker, 1000); 
            });
        }
    });

    brainWorker.on('error', (err) => console.error('🔴 [Brain] Error:', err));
    
    // 自動重啟機制 (守護進程)
    brainWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`🔴 [Brain] Crashed with code ${code}. Restarting in 3s...`);
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

    // 全局異常捕捉，防止主進程意外退出
    process.on('uncaughtException', (err) => {
        console.error('💥 [Main] Uncaught Exception:', err);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 [Main] Unhandled Rejection at:', promise, 'reason:', reason);
    });
};

main();
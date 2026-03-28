/**
 * main.js
 * 系統中樞 (System Hub)
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from './src/core/services/logger.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let brainWorker = null;
let serverWorker = null;
let discordWorker = null; 

const WORKER_PATHS = {
    BRAIN: path.join(__dirname, './src/workers/brain.worker.js'),
    SERVER: path.join(__dirname, './src/workers/server.worker.js'),
    DISCORD: path.join(__dirname, './src/workers/discord.worker.js') 
};

const startServerWorker = () => {
    appLogger.info('🟢 [Main] Starting Server Worker...');
    serverWorker = new Worker(WORKER_PATHS.SERVER);

    serverWorker.on('message', (msg) => {
        if (msg.type === 'WEB_CHAT_REQUEST') {
            if (brainWorker) {
                brainWorker.postMessage(msg); 
            } else {
                serverWorker.postMessage({
                    type: 'WEB_CHAT_RESPONSE',
                    requestId: msg.requestId,
                    response: { messages: ["(系統核心啟動中，請稍後再試...)"], emotion: {} }
                });
            }
        } 
        else if (msg.type === 'CMD_RESTART_BRAIN') {
            appLogger.warn('🔄 [Main] Received RESTART command from Web. Rebooting System...');

            // 🌟 拔除急救監聽器，避免引發假性崩潰重啟
            if (discordWorker) {
                discordWorker.removeAllListeners('exit'); 
                discordWorker.terminate().then(() => {
                    discordWorker = null;
                    setTimeout(startDiscordWorker, 500);
                });
            } else {
                startDiscordWorker();
            }

            if (brainWorker) {
                brainWorker.removeAllListeners('exit');
                brainWorker.terminate().then(() => {
                    brainWorker = null;
                    setTimeout(startBrainWorker, 500); 
                });
            } else {
                startBrainWorker();
            }
        }
    });

    serverWorker.on('error', (err) => appLogger.error('🔴 [Server] Error:', err));
    serverWorker.on('exit', (code) => {
        if (code !== 0) appLogger.error(`🔴 [Server] Stopped with exit code ${code}`);
    });
};

const startDiscordWorker = () => {
    appLogger.info('🟣 [Main] Starting Discord Worker...');
    discordWorker = new Worker(WORKER_PATHS.DISCORD);

    discordWorker.on('message', (msg) => {
        if (msg.type === 'DISCORD_CHAT_REQUEST') {
            if (brainWorker) {
                brainWorker.postMessage(msg); 
            } else {
                appLogger.warn('⚠️ [Main] Received Discord request but Brain is not ready.');
            }
        }
    });

    discordWorker.on('error', (err) => appLogger.error('🔴 [Discord] Error:', err));
    
    discordWorker.on('exit', (code) => {
        if (code !== 0) {
            appLogger.error(`🔴 [Discord] Crashed with code ${code}. Restarting in 3s...`);
            discordWorker = null;
            setTimeout(startDiscordWorker, 3000);
        }
    });
};

const startBrainWorker = () => {
    appLogger.info('🧠 [Main] Starting Brain Worker...');
    brainWorker = new Worker(WORKER_PATHS.BRAIN);

    brainWorker.on('message', (msg) => {
        if (msg.type === 'WEB_CHAT_RESPONSE' || msg.type === 'HISTORY_LOADED') {
            if (serverWorker) serverWorker.postMessage(msg);
        } 
        else if (msg.type === 'DISCORD_CHAT_RESPONSE') {
            if (discordWorker) discordWorker.postMessage(msg);
        }
        else if (msg.type === 'RESTART_BRAIN') {
            appLogger.warn('🔄 [Main] Brain requested restart. Rebooting core...');
            brainWorker.removeAllListeners('exit'); // 🌟 同樣拔除
            brainWorker.terminate().then(() => {
                brainWorker = null;
                setTimeout(startBrainWorker, 1000); 
            });
        }
    });

    brainWorker.on('error', (err) => appLogger.error('🔴 [Brain] Error:', err));
    brainWorker.on('exit', (code) => {
        if (code !== 0) {
            appLogger.error(`🔴 [Brain] Crashed with code ${code}. Restarting in 3s...`);
            setTimeout(startBrainWorker, 3000); 
        }
    });
};

const main = () => {
    appLogger.info('🚀 [Main] System Booting...');
    
    startBrainWorker();   
    startServerWorker();  
    startDiscordWorker(); 

    process.on('uncaughtException', (err) => {
        appLogger.error('💥 [Main] Uncaught Exception:', err);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        appLogger.error('💥 [Main] Unhandled Rejection at:', promise, 'reason:', reason);
    });
};

main();
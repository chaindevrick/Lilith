/**
 * src/workers/brain.worker.js
 * 核心大腦容器 (Brain Container)
 * 職責：整合認知模組、處理平台路由，並將平台專屬資訊解耦轉換為文字情境。
 */

import { parentPort } from 'worker_threads';
import { EventEmitter } from 'events';
import { appLogger } from '../core/services/logger.js';
import { initializeDatabase, closeDatabase } from '../db/sqlite.js';

import { CognitionModule } from '../core/modules/Cognition.js';
import { EmotionModule } from '../core/modules/Emotion.js';
import { ReflexEngine } from '../core/modules/ReflexEngine.js';
import { ProactiveScheduler } from '../core/instincts/scheduler.js';
import { LilithRepository } from '../db/repository.js';
import { skillRegistry } from '../core/services/SkillRegistry.js';

import { memoryVortex } from '../core/services/MemoryVortex.js';
import { systemEmbedder } from '../core/services/embedder.js';
import { localVectorDB } from '../db/vectorDb.js';

let db = null;
let repo = null;
let emotion = null;
let cognition = null;
let reflexEngine = null;
let scheduler = null;

const brainBus = new EventEmitter();
const RESTART_TRIGGER_KEY = 'SYSTEM_RESTART_TRIGGER';

await skillRegistry.loadAllSkills();

const initBrain = async () => {
    try {
        db = await initializeDatabase();
        repo = new LilithRepository(db);
        scheduler = new ProactiveScheduler(brainBus);
        reflexEngine = new ReflexEngine(repo);
        emotion = new EmotionModule(repo);
        await localVectorDB.init();
        memoryVortex.init(localVectorDB, systemEmbedder); // 注入依賴
        await memoryVortex.syncKnowledgeBaseToVectorDB();

        // 🌟 終極組裝：將 repo, emotion 以及 reflexEngine 注入給大腦皮層
        cognition = new CognitionModule(repo, emotion, reflexEngine);
        scheduler.start();
        appLogger.info('[Brain] Neural Network Online (Dual-Process Activated).');
    } catch (error) {
        appLogger.error('[Brain] Init Critical Failure:', error);
        throw error;
    }
};

const handleEvolutionRestart = async () => {
    appLogger.warn('[Evolution] System Restart Initiated...');
    if (scheduler) scheduler.stop();
    await closeDatabase();
    parentPort.postMessage({ type: 'RESTART_BRAIN' });
    process.exit(0);
};

const sendResponse = async (result) => {
    if (!result || !result.messages) return;

    const hasRestartSignal = result.messages.some(msg => msg.includes(RESTART_TRIGGER_KEY));
    const shouldRestart = result.shouldRestart || hasRestartSignal;

    if (result.messages.length > 0) {
        const responseType = result.source === 'DISCORD' ? 'DISCORD_CHAT_RESPONSE' : 'WEB_CHAT_RESPONSE';
        
        parentPort.postMessage({
            type: responseType,
            requestId: result.requestId,
            response: {
                channelId: result.channelId,
                messages: result.messages,
                emotion: result.emotion
            }
        });
    }

    if (shouldRestart) {
        setTimeout(async () => {
            await handleEvolutionRestart();
        }, 500);
    }
};

parentPort.on('message', async (msg) => {
    if (!repo) await initBrain();

    // 🌟 統一處理來自不同平台的請求
    if (msg.type === 'WEB_CHAT_REQUEST' || msg.type === 'DISCORD_CHAT_REQUEST') {
        const { conversationId, userName, content, attachments, channelId } = msg.payload;
        const requestId = msg.requestId;
        
        // 判斷來源
        const source = msg.type === 'WEB_CHAT_REQUEST' ? 'WEB' : 'DISCORD';
        const targetChannelId = source === 'DISCORD' ? channelId : requestId;
        
        // 🌟 讀取外部 Markdown 知識作為「核心記憶體」
        const coreKnowledge = await repo.getCoreKnowledge();

        // 🌟 核心解耦：在此將平台專屬資訊與核心記憶組裝為給 AI 看的純文字情境
        let platformContext = `${coreKnowledge}\n\n[系統當前連接狀態]\nPlatform: ${source}`;
        if (source === 'DISCORD') {
            platformContext += `\n- Discord Channel ID: ${channelId} (如需獲取群組歷史訊息，請使用此 ID 呼叫 discordToolkit)`;
        }

        try {
            const result = await cognition.processInput({
                conversationId,
                channelId: targetChannelId, 
                userName,
                userText: content,
                attachments,
                platformContext // 🌟 傳遞包含 Markdown 知識的巨大 Context 給大腦
            });

            const currentTotalTokens = await repo.getTotalTokens(conversationId);

            result.source = source;
            result.requestId = requestId;
            result.totalTokens = currentTotalTokens;

            await sendResponse(result);
        } catch (error) {
            appLogger.error('[Brain] Cognition Process Failed:', error);
            const responseType = source === 'DISCORD' ? 'DISCORD_CHAT_RESPONSE' : 'WEB_CHAT_RESPONSE';
            parentPort.postMessage({
                type: responseType,
                requestId: requestId,
                response: { 
                    channelId: targetChannelId, 
                    messages: ["(系統核心發生未預期的認知錯誤，請檢查日誌)"],
                    emotion: {}
                }
            });
        }
    }
    
    // 🌟 完整保留前端歷史紀錄請求
    if (msg.type === 'GET_SESSION_HISTORY') {
        const { conversationId } = msg.payload;
        // 確保 cognition.getSessionHistoryForFrontend 這個方法你有實作在 CognitionModule 內
        const history = cognition.getSessionHistoryForFrontend ? cognition.getSessionHistoryForFrontend(conversationId) : [];
        parentPort.postMessage({
            type: 'HISTORY_LOADED',
            requestId: msg.requestId,
            history: history
        });
    }
});

brainBus.on('INTERNAL_IMPULSE', async (impulse) => {
    if (!db || !cognition) return;
    try {
        const result = await cognition.handleInternalImpulse(impulse);
        if (result) {
            result.source = 'WEB'; // 內部衝動預設回傳至 WEB 端
            await sendResponse(result);
        }
    } catch (e) {
        appLogger.error('[Brain] Instinct Process Failed:', e);
    }
});
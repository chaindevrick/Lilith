/**
 * src/workers/brain.worker.js
 * 核心大腦容器 (Brain Container)
 * 職責：整合認知、情感、人格、記憶與本能模組，並處理進化重啟與訊息路由。
 */

import { parentPort } from 'worker_threads';
import { EventEmitter } from 'events';
import { appLogger } from '../config/logger.js';
import { initializeDatabase, closeDatabase } from '../db/sqlite.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 環境變數設定 ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../../.env');
dotenv.config({ path: ENV_PATH, override: true });

// --- 核心模組引入 ---
import { CognitionModule } from '../core/modules/Cognition.js';
import { EmotionModule } from '../core/modules/Emotion.js';
import { PersonaModule } from '../core/modules/Persona.js';
import { ProactiveScheduler } from '../core/instincts/scheduler.js';
import { LongTermMemory } from '../core/modules/LongTermMemory.js';
import { LilithRepository } from '../db/repository.js';

// --- 狀態變數 ---
let db = null;
let cognition = null;
let emotion = null;
let persona = null;
let scheduler = null;
let longTermMemory = null;
// --- 內部神經網路 (Event Bus) ---
// 用於模組間的非同步通訊 (例如 Scheduler 觸發 Cognition)
const brainBus = new EventEmitter();

// 特殊指令字串，當 AI 回應包含此字串時觸發重啟
const RESTART_TRIGGER_KEY = 'SYSTEM_RESTART_TRIGGER';

/**
 * ============================================================
 * 1. 大腦初始化 (Assembly)
 * ============================================================
 */
const initBrain = async () => {
    try {
        appLogger.info('[Brain] Initializing Neural Network...');
        
        // 1. 連結記憶庫 (SQLite)
        db = await initializeDatabase();
        const repo = new LilithRepository(db);

        // 2. 初始化 本能循環 (Scheduler)
        // 注入 EventBus 以便發送脈衝
        scheduler = new ProactiveScheduler(brainBus);

        // 3. 初始化 情感模組 (Limbic System)
        emotion = new EmotionModule(repo);

        // 4. 初始化 人格模組 (Facts & Style)
        persona = new PersonaModule(repo);

        // 5. 初始化 長期記憶模組 (LTM)
        longTermMemory = new LongTermMemory(repo);

        // . 初始化 認知模組 (Prefrontal Cortex)
        // 這是邏輯處理的核心，整合了上述所有模組
        cognition = new CognitionModule(repo, emotion, persona, longTermMemory);
        // . 啟動潛意識循環
        scheduler.start();

        appLogger.info('[Brain] Neural Network Online. Consciousness Active.');

    } catch (error) {
        appLogger.error('🔥 [Brain] Init Critical Failure:', error);
        throw error; // 拋出錯誤讓 Main Process 決定是否重啟 Worker
    }
};

/**
 * ============================================================
 * 2. 優雅重啟處理 (Graceful Shutdown)
 * 防止直接 terminate 導致 SQLite 資料庫鎖死或毀損
 * ============================================================
 */
const handleEvolutionRestart = async () => {
    appLogger.warn('✨ [Evolution] System Restart Initiated...');
    
    // 1. 停止本能循環 (防止在關閉過程中觸發新事件)
    if (scheduler) scheduler.stop();

    // 2. 安全關閉資料庫 (關鍵步驟)
    await closeDatabase();

    // 3. 通知中樞 (Main) 銷毀此 Worker 並重生
    parentPort.postMessage({ type: 'RESTART_BRAIN' });
    
    // 4. 結束當前進程
    process.exit(0);
};

/**
 * ============================================================
 * 3. 輸出處理 (Output Handler)
 * 將思考結果發送回 Main Process
 * ============================================================
 */
const sendResponse = async (result) => {
    // result 結構: { channelId, messages, emotion, mode, shouldRestart }

    if (!result || !result.messages) return;

    // 檢查是否包含重啟觸發訊號 (來自 evolution.js 工具的回傳)
    const hasRestartSignal = result.messages.some(msg => msg.includes(RESTART_TRIGGER_KEY));
    const shouldRestart = result.shouldRestart || hasRestartSignal;

    // 1. 優先發送回應 (讓使用者知道指令已接收)
    if (result.messages.length > 0) {
        // 過濾掉重啟訊號字串，避免顯示給使用者看 (可選，視需求而定)
        // 這裡選擇保留，讓使用者看到系統回傳的確認訊息
        
        parentPort.postMessage({
            type: 'AI_RESPONSE',
            payload: {
                channelId: result.channelId,
                messages: result.messages,
                emotion: result.emotion, // 回傳數值供前端 UI 更新
                mode: result.mode        // 回傳當前人格模式
            }
        });
    }

    // 2. 若需要重啟，執行優雅關閉流程
    if (shouldRestart) {
        // 稍微延遲以確保訊息發送完成
        setTimeout(async () => {
            await handleEvolutionRestart();
        }, 500);
    }
};

/**
 * ============================================================
 * 4. 外部訊號處理 (Input Handler)
 * 接收來自 Main Process (Discord/Web) 的訊息
 * ============================================================
 */
parentPort.on('message', async (msg) => {
    // Lazy Init: 確保大腦已初始化
    if (!repo) await initBrain();

    // --- 處理使用者輸入 ---
    if (msg.type === 'USER_INPUT') {
        const { conversationId, channelId, content, authorName, attachments, mode } = msg.payload;

        try {
            // 交給認知模組進行邏輯運算
            const result = await cognition.processInput({
                conversationId,
                channelId,
                userText: content,
                authorName,
                attachments,
                mode: mode || 'demon' // 預設為惡魔模式
            });

            await sendResponse(result);

        } catch (error) {
            appLogger.error('[Brain] Cognition Process Failed:', error);
            
            // 發生錯誤時的回退回應
            parentPort.postMessage({
                type: 'AI_RESPONSE',
                payload: { 
                    channelId, 
                    messages: ["(系統核心發生未預期的認知錯誤，請檢查日誌...)"],
                    emotion: {}
                }
            });
        }
    }
});

/**
 * ============================================================
 * 5. 內部衝動處理 (Internal Impulse Handler)
 * 接收來自 Scheduler 的定時事件
 * ============================================================
 */
brainBus.on('INTERNAL_IMPULSE', async (impulse) => {
    if (!db || !cognition) return;

    try {
        // 交給認知模組處理潛意識衝動 (如：是否要主動發話？是否要反思？)
        const result = await cognition.handleInternalImpulse(impulse);
        
        // 如果衝動產生了需要對外發送的內容 (例如後台小劇場)
        if (result) {
            await sendResponse(result);
        }
    } catch (e) {
        appLogger.error('[Brain] Instinct Process Failed:', e);
    }
});
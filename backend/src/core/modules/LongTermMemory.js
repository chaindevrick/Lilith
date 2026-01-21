/**
 * src/core/modules/LongTermMemory.js
 * 長期記憶模組 (LTM) - v4.0 (Hybrid Bridge)
 */

import { appLogger } from '../../config/logger.js';
import { memoryVortex } from '../tools/memoryVortex.js';

// 設定自動向量化的門檻 (0.0 ~ 1.0)
const RAG_INDEXING_THRESHOLD = 0.8; 

export class LongTermMemory {
    /**
     * @param {Object} repo - LilithRepository 實例
     */
    constructor(repo) {
        if (!repo) throw new Error('[LTM] Repository is required');
        this.repo = repo;
        appLogger.info('[LTM] Long Term Memory Core initialized (with RAG Bridge).');
    }

    /**
     * 銘刻記憶 (核心方法)
     * 1. 寫入 SQLite (結構化紀錄)
     * 2. 若重要性夠高，同步寫入 MemoryVortex (向量化檢索)
     */
    async record(memory) {
        const { type, trigger, action, result, importance_score = 0.5 } = memory;
        const timestamp = new Date().toISOString();

        try {
            // 1. 寫入 SQLite (作為主要儲存)
            const memoryId = await this.repo.createMemory({
                type, trigger, action, result, importance_score
            });

            if (!memoryId) return null;

            // 2. 判斷是否需要同步到向量庫
            // 只有「重要」且「有內容」的記憶才值得佔用向量空間
            if (importance_score >= RAG_INDEXING_THRESHOLD) {
                this._syncToVortex(memoryId, memory).catch(err => {
                    appLogger.warn(`[LTM] RAG Sync failed (ID: ${memoryId}):`, err);
                });
            }

            return { id: memoryId, timestamp, ...memory };
        } catch (error) {
            appLogger.error(`[LTM] Record failed: ${error.message}`);
            return null;
        }
    }

    /**
     * [Private] 將 LTM 記憶轉化為自然語言並銘刻到 Vortex
     */
    async _syncToVortex(sqlId, memory) {
        const { type, trigger, action, result } = memory;
        
        // 將結構化數據轉為自然語言描述，讓 Embedding 效果更好
        let textToVectorize = "";
        
        if (type === 'experience') {
            // 針對經驗/反思的優化格式
            // 嘗試解析 result JSON 以取得更好的描述
            try {
                const resObj = JSON.parse(result);
                const feedback = resObj.feedback || "";
                const refined = resObj.refined_output || result;
                textToVectorize = `[經驗回顧] 當遇到 "${trigger}" 時，我使用了 "${action}"。反饋顯示 "${feedback}"，修正後的做法是：${refined}`;
            } catch (e) {
                textToVectorize = `[經驗回顧] 事件: ${trigger} -> 行動: ${action} -> 結果: ${result}`;
            }
        } else if (type === 'tool_use') {
            textToVectorize = `[工具記憶] 我使用了工具 ${action} 來處理 "${trigger}"，結果為: ${result}`;
        } else {
            textToVectorize = `[記憶片段] ${trigger} -> ${result}`;
        }

        // 呼叫 Vortex 進行銘刻，並在 metadata 關聯 SQL ID
        await memoryVortex.memorize(textToVectorize, {
            source: 'LTM_AUTO_SYNC',
            original_type: type,
            sql_id: sqlId // 建立關聯，未來檢索到時可以查回 SQL
        });
        
        appLogger.info(`[LTM] Memory #${sqlId} synced to RAG (High Importance)`);
    }

    /**
     * 儲存經驗 (Self-Refine 專用)
     * [Note] importance_score 設為 0.9，保證會被同步到 RAG
     */
    async storeExperience({ interactionContext, lilithOutput, feedback, refinedOutput }) {
        try {
            const trigger = interactionContext.userText || "System Event";
            
            const resultData = JSON.stringify({
                original_output: lilithOutput,
                feedback: feedback,
                refined_output: refinedOutput,
                context: interactionContext
            });

            await this.record({
                type: 'experience',
                trigger: trigger,
                action: 'Self-Refine Process',
                result: resultData,
                importance_score: 0.9 // <--- 這會觸發 _syncToVortex
            });

            return { success: true, message: 'Experience stored and indexed.' };
        } catch (error) {
            appLogger.error('[LTM] Store experience failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    async retrieve(criteria = {}, limit = 10) {
        try {
            return await this.repo.getMemories({ type: criteria.type, limit });
        } catch (error) {
            appLogger.error(`[LTM] Retrieve failed: ${error.message}`);
            return [];
        }
    }

    async addReflection(memoryId, reflectionText) {
        try {
            await this.repo.updateReflection(memoryId, reflectionText);
            
            // [Optional] 反思也是極其重要的，也可以選擇將反思內容同步到 RAG
            // 這裡視您的需求決定是否實作
            
            return { id: memoryId, reflection: reflectionText };
        } catch (error) {
            appLogger.error(`[LTM] Add reflection failed: ${error.message}`);
            throw error;
        }
    }
}
/**
 * src/core/modules/LongTermMemory.js
 * 長期記憶模組 (LTM)
 * 負責將記憶寫入資料庫 (SQLite)，並將高重要性的記憶同步至向量庫 (Vortex) 以供 RAG 檢索。
 */

import { appLogger } from '../../config/logger.js';
import { memoryVortex } from '../tools/memoryVortex.js';

// 自動向量化門檻 (0.0 ~ 1.0) - 只有重要性高於此值的記憶才會被寫入向量庫
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
     * 銘刻記憶 (Record Memory)
     * 1. 寫入 SQLite (結構化紀錄)
     * 2. 若重要性高於門檻，同步寫入 MemoryVortex (向量化)
     * @param {Object} memory - { type, trigger, action, result, importance_score }
     */
    async record(memory) {
        const { type, trigger, action, result, importance_score = 0.5 } = memory;
        const timestamp = new Date().toISOString();

        try {
            // 1. 寫入 SQLite
            const memoryId = await this.repo.createMemory({
                type, trigger, action, result, importance_score
            });

            if (!memoryId) return null;

            // 2. 判斷是否需要同步到 RAG
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
     * [Private] 同步記憶至向量庫
     * 將結構化數據轉化為自然語言描述，以提升 Embedding 效果。
     * @private
     */
    async _syncToVortex(sqlId, memory) {
        const { type, trigger, action, result } = memory;
        
        let textToVectorize = "";
        
        // 根據記憶類型優化文本格式
        if (type === 'experience') {
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

        // 呼叫 Vortex 進行銘刻，並關聯 SQL ID
        await memoryVortex.memorize(textToVectorize, {
            source: 'LTM_AUTO_SYNC',
            original_type: type,
            sql_id: sqlId
        });
        
        appLogger.info(`[LTM] Memory #${sqlId} synced to RAG (High Importance)`);
    }

    /**
     * 儲存經驗 (Self-Refine 專用)
     * 強制設定高重要性以觸發 RAG 同步。
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
                importance_score: 0.9 
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
            return { id: memoryId, reflection: reflectionText };
        } catch (error) {
            appLogger.error(`[LTM] Add reflection failed: ${error.message}`);
            throw error;
        }
    }
}
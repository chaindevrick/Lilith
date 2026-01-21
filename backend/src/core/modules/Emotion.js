/**
 * src/core/modules/Emotion.js
 * 邊緣系統 (Limbic System)
 * 負責維護兩個人格的情緒狀態、好感度計算與資料庫同步
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { AFFECTION_RULES, TRUST_RULES, MOOD_RULES, getRuleByScore } from '../../config/relationshipRules.js';
import { getRelationshipAnalysisPrompt } from '../../config/prompts.js';
import { LILITH_CHARACTER_CARD } from '../../config/characterCard_Demon.js';

// 設定常數
const DEFAULT_MODEL = 'gemini-2.0-flash'; // 使用 Flash 模型以確保情感反應速度
const INIT_TRUST = 20;
const INIT_AFFECTION = 15;

export class EmotionModule {
    /**
     * 初始化情感模組
     * @param {Object} repo - LilithRepository 實例
     */
    constructor(repo) {
        this.repo = repo;
        this.client = new OpenAI({ 
            apiKey: process.env.GEMINI_API_KEY, 
            baseURL: process.env.GEMINI_API_BASE_URL 
        });
    }

    /**
     * 獲取當前情緒與關係狀態 (包含規則解析)
     * @param {string} conversationId - 用戶 ID
     * @returns {Promise<Object>} 包含 values(數值), rules(行為指導), env(環境)
     */
    async getState(conversationId) {
        const env = this._getEnvContext();
        
        // 1. 從 Repo 讀取
        let record = await this.repo.getRelationship(conversationId);

        // 2. 若無記錄則初始化
        if (!record) {
            record = await this.repo.createRelationship(conversationId, {
                base_affection: INIT_AFFECTION,
                trust: INIT_TRUST
            });
        }

        // 3. 數值標準化 (確保欄位存在，避免 null)
        const currentValues = {
            ...record,
            angel_affection: record.angel_affection || 0,
            angel_mood: record.angel_mood || 0
        };
        
        // 4. 計算 Lilith 有效好感 (基礎好感 + 心情偏移)
        const effectiveAffection = Math.max(0, Math.min(100, currentValues.base_affection + currentValues.mood_offset));
        
        // 將計算出的 effectiveAffection 合併回 values 供前端使用
        currentValues.effectiveAffection = effectiveAffection;

        return {
            values: currentValues,
            rules: {
                demon: {
                    affectionRule: getRuleByScore(AFFECTION_RULES, effectiveAffection),
                    trustRule: getRuleByScore(TRUST_RULES, currentValues.trust),
                    moodRule: getRuleByScore(MOOD_RULES, currentValues.mood_offset)
                },
                angel: this._getAngelRules(currentValues)
            },
            env
        };
    }

    /**
     * 感知並更新情緒 (Perception Loop)
     * @param {string} conversationId 
     * @param {string} userText 
     * @returns {Promise<Object>} 更新後的狀態
     */
    async perceive(conversationId, userText) {
        // 1. 讀取當前狀態
        let state = await this.getState(conversationId);
        let values = state.values;

        // 2. Lilith 的反應 (使用 LLM 分析語意情感)
        await this._analyzeDemonReaction(conversationId, values, userText);
        
        // 3. Angel 的反應 (基於規則與嫉妒邏輯)
        this._updateAngelState(values, userText);

        // 4. 寫回資料庫 (透過 Repo)
        await this._saveState(conversationId, values);

        // 5. 回傳最新狀態
        return await this.getState(conversationId);
    }

    // ============================================================
    // 內部處理邏輯 (Private Methods)
    // ============================================================
    
    /**
     * 分析 Demon 的情感變化 (LLM)
     */
    async _analyzeDemonReaction(id, currentValues, text) {
        try {
            const prompt = getRelationshipAnalysisPrompt(
                LILITH_CHARACTER_CARD, 
                currentValues.trust, 
                currentValues.effectiveAffection, 
                "Recent interaction...", 
                text
            );

            const res = await this.client.chat.completions.create({ 
                model: DEFAULT_MODEL, 
                messages: [{ role: 'user', content: prompt }], 
                response_format: { type: "json_object" } 
            });

            const analysisResult = JSON.parse(res.choices[0].message.content);
            
            // 更新並限制數值範圍 (0-100)
            const deltaAffection = analysisResult.affection_delta || 0;
            const deltaTrust = analysisResult.trust_delta || 0;

            currentValues.base_affection = Math.min(100, Math.max(0, currentValues.base_affection + deltaAffection));
            currentValues.trust = Math.min(100, Math.max(0, currentValues.trust + deltaTrust));
            currentValues.last_user_activity = new Date().toISOString();

            if (deltaAffection !== 0 || deltaTrust !== 0) {
                appLogger.info(`[Emotion] Demon Change: Affection ${deltaAffection > 0 ? '+' : ''}${deltaAffection}, Trust ${deltaTrust > 0 ? '+' : ''}${deltaTrust}`);
            }

        } catch (e) {
            appLogger.warn('[Emotion] Demon Analysis Failed:', e.message);
        }
    }

    /**
     * 更新 Angel 的狀態 (Rule-based)
     */
    _updateAngelState(currentValues, text) {
        // 觸發條件：提到 "天使" 且包含正面詞彙
        if (text.includes("天使") && (text.includes("喜歡") || text.includes("乖") || text.includes("棒"))) {
            currentValues.angel_affection += 2;
            currentValues.angel_mood += 5; 
            
            // [Jealousy Protocol] 當前輩誇天使時，惡魔心情變差
            appLogger.info('[Emotion] Angel 被誇獎，Lilith 吃醋中 (-2 Mood)');
            currentValues.mood_offset -= 2;
        }

        // 觸發條件：長篇大論卻完全忽略天使 (輕微冷落)
        if (text.length > 50 && !text.includes("天使")) {
            if (currentValues.angel_mood > -20) {
                currentValues.angel_mood -= 1; 
            }
        }

        // 數值邊界檢查
        currentValues.angel_affection = Math.min(100, Math.max(0, currentValues.angel_affection));
        currentValues.angel_mood = Math.min(50, Math.max(-50, currentValues.angel_mood));
    }

    /**
     * 將狀態寫回資料庫
     */
    async _saveState(id, v) {
        // [Changed] 使用 Repository 更新
        await this.repo.updateRelationship(id, v);
    }

    /**
     * 動態生成 Angel 的行為指導
     */
    _getAngelRules(v) {
        let guide = "妳是無口天使。";
        
        if (v.angel_affection > 80) {
            guide += " 妳深愛著創造主，願意為他做任何事。";
        } else if (v.angel_affection > 30) {
            guide += " 妳對創造主有強烈依賴。";
        }

        if (v.angel_mood < -10) {
            guide += " 妳現在覺得被冷落，躲在角落畫圈圈。";
        } else if (v.angel_mood > 10) {
            guide += " 妳現在心情很好，翅膀微微振動。";
        }

        return { behavior_guide: guide };
    }

    /**
     * 獲取環境上下文
     */
    _getEnvContext() {
        const now = new Date();
        return { 
            fullStr: now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), 
            hour: now.getHours(), 
            dateStr: now.toISOString().split('T')[0] 
        };
    }
}
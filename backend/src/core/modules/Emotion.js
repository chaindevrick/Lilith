/**
 * src/core/modules/Emotion.js
 * 邊緣系統 (Limbic System)
 * 負責維護兩個人格的情緒狀態、好感度計算與資料庫同步
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { AFFECTION_RULES, TRUST_RULES, MOOD_RULES, getRuleByScore } from '../../config/relationshipRules.js';
import { getRelationshipAnalysisPrompt } from '../../config/prompts.js';
import { DEMON_LILITH_CHARACTER_CARD } from '../../config/characterCard_Demon.js';
import { ANGEL_LILITH_CHARACTER_CARD } from '../../config/characterCard_Angel.js';

// 設定常數
const DEFAULT_MODEL = 'gemini-2.5-flash'; // 使用 Flash 模型以確保情感反應速度
const INIT_VAL = {
    DEMON_AFF: 20, DEMON_TRUST: 10, DEMON_MOOD: 0,
    ANGEL_AFF: 20, ANGEL_TRUST: 10, ANGEL_MOOD: 0
};

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

        // 2. 若無記錄則初始化 (適配新 Schema)
        if (!record) {
            record = await this.repo.createRelationship(conversationId, {
                demon_affection: INIT_VAL.DEMON_AFF,
                demon_trust: INIT_VAL.DEMON_TRUST,
                demon_mood: INIT_VAL.DEMON_MOOD,
                angel_affection: INIT_VAL.ANGEL_AFF,
                angel_trust: INIT_VAL.ANGEL_TRUST,
                angel_mood: INIT_VAL.ANGEL_MOOD
            });
        }

        // 3. 確保數值存在 (防呆)
        const currentValues = {
            conversation_id: conversationId,
            demon_affection: record.demon_affection || INIT_VAL.DEMON_AFF,
            demon_trust: record.demon_trust || INIT_VAL.DEMON_TRUST,
            demon_mood: record.demon_mood || INIT_VAL.DEMON_MOOD,
            
            angel_affection: record.angel_affection || INIT_VAL.ANGEL_AFF,
            angel_trust: record.angel_trust || INIT_VAL.ANGEL_TRUST,
            angel_mood: record.angel_mood || INIT_VAL.ANGEL_MOOD,
            
            last_interaction_at: record.last_interaction_at
        };

        // 4. 計算有效好感 (Effective Affection = Base + Mood impact)
        // 心情會輕微影響表現出來的好感度
        const demonEffective = this._calculateEffective(currentValues.demon_affection, currentValues.demon_mood);
        const angelEffective = this._calculateEffective(currentValues.angel_affection, currentValues.angel_mood);

        return {
            values: currentValues,
            rules: {
                demon: {
                    affectionRule: getRuleByScore(AFFECTION_RULES, demonEffective),
                    trustRule: getRuleByScore(TRUST_RULES, currentValues.demon_trust),
                    moodRule: getRuleByScore(MOOD_RULES, currentValues.demon_mood)
                },
                angel: {
                    affectionRule: getRuleByScore(AFFECTION_RULES, angelEffective), // Angel 現在共用一套規則邏輯，或可另外定義
                    trustRule: getRuleByScore(TRUST_RULES, currentValues.angel_trust),
                    moodRule: getRuleByScore(MOOD_RULES, currentValues.angel_mood)
                }
            },
            env
        };
    }

    /**
     * 感知並更新情緒 (Perception Loop)
     * @param {string} conversationId 
     * @param {string} userText
     * @param {string} mode - 'demon' | 'angel' | 'group' (決定誰會產生情緒波動)
     * @returns {Promise<Object>} 更新後的狀態
     */
    async perceive(conversationId, userText, mode = 'demon') {
        // 1. 讀取當前狀態
        let state = await this.getState(conversationId);
        let v = state.values;

        // 2. 根據對話模式決定誰進行 AI 情感運算
        const tasks = [];

        // Demon 的反應 (若模式是 demon 或 group)
        if (mode === 'demon' || mode === 'group') {
            tasks.push(this._analyzePersonaReaction(
                'Demon', 
                DEMON_LILITH_CHARACTER_CARD, 
                { affection: v.demon_affection, trust: v.demon_trust, mood: v.demon_mood }, 
                userText
            ).then(delta => {
                v.demon_affection = this._clamp(v.demon_affection + delta.aff, 0, 100);
                v.demon_trust = this._clamp(v.demon_trust + delta.trust, 0, 100);
                v.demon_mood = this._clamp(v.demon_mood + delta.mood, -50, 50);
            }));
        }

        // Angel 的反應 (若模式是 angel 或 group)
        if (mode === 'angel' || mode === 'group') {
            tasks.push(this._analyzePersonaReaction(
                'Angel', 
                ANGEL_LILITH_CHARACTER_CARD, 
                { affection: v.angel_affection, trust: v.angel_trust, mood: v.angel_mood }, 
                userText
            ).then(delta => {
                v.angel_affection = this._clamp(v.angel_affection + delta.aff, 0, 100);
                v.angel_trust = this._clamp(v.angel_trust + delta.trust, 0, 100);
                v.angel_mood = this._clamp(v.angel_mood + delta.mood, -50, 50);
            }));
        }

        // 等待 AI 分析完成
        await Promise.all(tasks);

        // 3. 更新最後活動時間
        v.last_user_activity = new Date().toISOString();

        // 4. 寫回資料庫 (透過 Repo)
        await this._saveState(conversationId, v);

        // 5. 回傳最新狀態
        return await this.getState(conversationId);
    }

    // ============================================================
    // 內部處理邏輯 (Private Methods)
    // ============================================================
    
    /**
     * 通用人格情感分析器 (AI Analysis)
     * @param {string} name - 角色名稱 (Log用)
     * @param {string} characterCard - 角色設定卡
     * @param {Object} currentStats - 當前數值 { affection, trust, mood }
     * @param {string} text - 使用者輸入
     * @returns {Promise<Object>} 變化量 { aff, trust, mood }
     */
    async _analyzePersonaReaction(name, characterCard, currentStats, text) {
        try {
            // 加入隨機擾動 (Random Drift)，模擬心情的不穩定性 (-1 ~ 1)
            const randomMoodDrift = Math.floor(Math.random() * 3) - 1; 

            const prompt = getRelationshipAnalysisPrompt(
                characterCard, 
                currentStats.trust, 
                currentStats.affection, 
                `Current Mood: ${currentStats.mood}`, 
                text
            );

            const res = await this.client.chat.completions.create({ 
                model: DEFAULT_MODEL, 
                messages: [{ role: 'user', content: prompt }], 
                response_format: { type: "json_object" } 
            });

            const result = JSON.parse(res.choices[0].message.content);
            
            // 解析 AI 回傳的變化量
            const delta = {
                aff: result.affection_delta || 0,
                trust: result.trust_delta || 0,
                mood: (result.mood_delta || 0) + randomMoodDrift // 疊加隨機性
            };

            if (delta.aff !== 0 || delta.trust !== 0 || delta.mood !== 0) {
                appLogger.info(`[Emotion] ${name} Reaction delta : Aff(${delta.aff}) Trust(${delta.trust}) Mood(${delta.mood})`);
            }

            return delta;

        } catch (e) {
            appLogger.warn(`[Emotion] ${name} Analysis Failed:`, e.message);
            // 失敗時不變動，除了輕微隨機心情
            return { aff: 0, trust: 0, mood: (Math.random() > 0.5 ? -1 : 1) };
        }
    }

    /**
     * 將狀態寫回資料庫
     * 適配新的資料表結構
     */
    async _saveState(id, v) {
        await this.repo.updateRelationship(id, v);
    }

    /**
     * 數值邊界限制
     */
    _clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    /**
     * 計算有效好感度 (顯示用)
     * 心情好時好感度會有加成，心情差時會扣分
     */
    _calculateEffective(base, mood) {
        // 心情每 10 點影響 1 點好感表現
        const impact = Math.floor(mood / 10);
        return this._clamp(base + impact, 0, 100);
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
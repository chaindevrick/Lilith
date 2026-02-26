/**
 * src/core/modules/Emotion.js
 * 邊緣系統 (Limbic System)
 * 負責維護兩個人格的情緒狀態、好感度計算與資料庫同步。
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { AFFECTION_RULES, TRUST_RULES, MOOD_RULES, getRuleByScore } from '../../config/relationshipRules.js';
import { getRelationshipAnalysisPrompt } from '../../config/prompts.js';
import { DEMON_LILITH_CHARACTER_CARD } from '../../config/characterCard_Demon.js';
import { ANGEL_LILITH_CHARACTER_CARD } from '../../config/characterCard_Angel.js';

// 使用 Flash 模型以確保情感反應速度 (Low Latency)
const DEFAULT_MODEL = 'gemini-3-flash-preview';

const INIT_VAL = {
    DEMON_AFF: 20, DEMON_TRUST: 10, DEMON_MOOD: 0,
    ANGEL_AFF: 20, ANGEL_TRUST: 10, ANGEL_MOOD: 0
};

export class EmotionModule {
    /**
     * @param {Object} repo - 資料倉儲實例
     */
    constructor(repo) {
        this.repo = repo;
        this.client = new OpenAI({ 
            apiKey: process.env.GEMINI_API_KEY, 
            baseURL: process.env.GEMINI_API_BASE_URL 
        });
    }

    /**
     * 獲取當前情緒與關係狀態
     * 包含數值 (Values) 與根據數值解析出的行為規則 (Rules)。
     */
    async getState(conversationId) {
        const env = this._getEnvContext();
        
        // 1. 從 Repo 讀取
        let record = await this.repo.getRelationship(conversationId);

        // 2. 若無記錄則初始化
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

        // 3. 建構數值物件
        const currentValues = {
            conversation_id: conversationId,
            demon_affection: record.demon_affection || INIT_VAL.DEMON_AFF,
            demon_trust: record.demon_trust || INIT_VAL.DEMON_TRUST,
            demon_mood: record.demon_mood || INIT_VAL.DEMON_MOOD,
            
            angel_affection: record.angel_affection || INIT_VAL.ANGEL_AFF,
            angel_trust: record.angel_trust || INIT_VAL.ANGEL_TRUST,
            angel_mood: record.angel_mood || INIT_VAL.ANGEL_MOOD,
            
            last_user_activity: record.last_user_activity
        };

        // 4. 計算有效好感 (Mood 影響 Affection 表現)
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
                    affectionRule: getRuleByScore(AFFECTION_RULES, angelEffective),
                    trustRule: getRuleByScore(TRUST_RULES, currentValues.angel_trust),
                    moodRule: getRuleByScore(MOOD_RULES, currentValues.angel_mood)
                }
            },
            env
        };
    }

    /**
     * 感知循環 (Perception Loop)
     * 分析 User 輸入，更新對應人格的情緒狀態。
     * @param {string} mode - 'demon' | 'angel' | 'group'
     */
    async perceive(conversationId, userText, mode = 'demon') {
        // 1. 讀取當前狀態
        let state = await this.getState(conversationId);
        let v = state.values;

        // 2. 根據模式並行處理情緒反應
        const tasks = [];

        // Demon 反應
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

        // Angel 反應
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

        await Promise.all(tasks);

        // 3. 更新最後活動時間並存檔
        v.last_user_activity = new Date().toISOString();
        await this._saveState(conversationId, v);

        return await this.getState(conversationId);
    }

    // ============================================================
    // Private Helpers
    // ============================================================
    
    /**
     * AI 情感分析器
     * 呼叫 LLM 分析輸入語句對信任、好感與心情的影響。
     */
    async _analyzePersonaReaction(name, characterCard, currentStats, text) {
        try {
            // 加入隨機擾動 (-1 ~ 1) 模擬心情不穩定性
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
            
            const delta = {
                aff: result.affection_delta || 0,
                trust: result.trust_delta || 0,
                mood: (result.mood_delta || 0) + randomMoodDrift
            };

            if (delta.aff !== 0 || delta.trust !== 0 || delta.mood !== 0) {
                appLogger.info(`[Emotion] ${name} Reaction: Aff(${delta.aff}) Trust(${delta.trust}) Mood(${delta.mood})`);
            }

            return delta;

        } catch (e) {
            appLogger.warn(`[Emotion] ${name} Analysis Failed:`, e.message);
            // 失敗時僅保留隨機心情波動
            return { aff: 0, trust: 0, mood: (Math.random() > 0.5 ? -1 : 1) };
        }
    }

    async _saveState(id, v) {
        await this.repo.updateRelationship(id, v);
    }

    _clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    _calculateEffective(base, mood) {
        // 心情每 10 點影響 1 點好感表現
        const impact = Math.floor(mood / 10);
        return this._clamp(base + impact, 0, 100);
    }

    _getEnvContext() {
        const now = new Date();
        return { 
            fullStr: now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), 
            hour: now.getHours(), 
            dateStr: now.toISOString().split('T')[0] 
        };
    }
}
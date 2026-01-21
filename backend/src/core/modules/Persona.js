/**
 * src/core/modules/Persona.js
 * 人格模組
 * 負責管理「關於使用者與代理」的長期事實記憶 (Facts)
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { getFactExtractionPrompt } from '../../config/prompts.js';

// 使用較快速的模型進行背景記憶提取，節省成本與時間
const MEMORY_MODEL = 'gemini-2.0-flash';

export class PersonaModule {
    /**
     * 初始化人格記憶模組
     * @param {Object} repo - LilithRepository 實例
     */
    constructor(repo) {
        if (!repo) throw new Error('[Persona] Repository is required');
        this.repo = repo; // [Changed] 使用 Repository 替代直接 DB 連接
        
        // 初始化 OpenAI 客戶端
        this.client = new OpenAI({
            apiKey: process.env.LTM_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
            baseURL: process.env.GEMINI_API_BASE_URL,
        });
    }

    /**
     * [核心功能] 回憶 (Recall)
     * 讀取所有關於該對話的已知事實，並格式化為 Prompt Context
     * @param {string} conversationId 
     * @returns {Promise<Object>} { facts: Array, factsText: string }
     */
    async recall(conversationId) {
        // [Changed] 透過 Repo 讀取
        const facts = await this.repo.getFacts(conversationId);
        const factsContextStr = this._formatFacts(facts);
        
        return {
            facts: facts,
            factsText: factsContextStr
        };
    }

    /**
     * [核心功能] 記憶 (Memorize)
     * 使用 LLM 在背景分析對話，提取新的事實並寫入資料庫
     * @param {string} conversationId 
     * @param {string} userText - 使用者說的話
     * @param {string} aiResponse - (可選) AI 的回應，用於輔助上下文
     */
    async memorize(conversationId, userText, aiResponse) {
        try {
            // 1. 讀取現有記憶以避免重複
            const existingFacts = await this.repo.getFacts(conversationId);
            const contextStr = this._formatFacts(existingFacts);
            
            // 2. 構建提取指令
            const prompt = getFactExtractionPrompt(userText, contextStr);
            const fullPrompt = `${prompt}\n\n**[特別指令]**：這段話是 **前輩 (使用者)** 說的。Key 必須統一用 **"前輩的..."** 或 **"莉莉絲的..."** 開頭。`;

            // 3. 呼叫 LLM 進行提取
            const response = await this.client.chat.completions.create({
                model: MEMORY_MODEL,
                messages: [{ role: "user", content: fullPrompt }],
                response_format: { type: "json_object" }
            });

            const resultText = response.choices[0].message.content || "{}";
            
            let factData = {};
            try {
                factData = JSON.parse(resultText.trim());
            } catch (e) {
                // 若模型吐出非 JSON 格式，視為無新記憶
                return;
            }

            // 4. 若有提取到有效事實，寫入資料庫
            if (factData.fact_key && factData.fact_detail) {
                const scope = factData.scope || 'user';
                
                // [Changed] 透過 Repo 寫入 (Upsert)
                await this.repo.saveFact(conversationId, factData.fact_key, factData.fact_detail, scope);
                
                appLogger.info(`📝 [Persona] Fact Memorized: [${scope}] ${factData.fact_key}: ${factData.fact_detail}`);
            }
        } catch (e) {
            // 背景任務失敗僅記錄 Debug Log，不影響主流程
            appLogger.debug('[Persona] Memorize task failed (non-critical):', e.message);
        }
    }

    // ============================================================
    // Private Helpers
    // ============================================================

    /**
     * 將事實陣列格式化為易讀的文本字串
     */
    _formatFacts(rows) {
        if (!rows || rows.length === 0) return "（目前沒有關於前輩的特殊記憶）";
        
        const byScope = { user: [], agent: [], us: [] };
        
        for (const r of rows) {
            // 確保 scope 合法，預設為 user
            const s = ['user', 'agent', 'us'].includes(r.scope) ? r.scope : 'user';
            byScope[s].push(`${r.fact_key}: ${r.fact_detail}`);
        }

        const section = (items) => items.length ? `- ${items.join('\n- ')}` : '（無）';
        
        return [
            '[前輩相關記憶]', section(byScope.user),
            '',
            '[莉莉絲相關記憶]', section(byScope.agent),
            '',
            '[我們的共同記憶]', section(byScope.us),
        ].join('\n');
    }
}
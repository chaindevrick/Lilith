/**
 * src/core/modules/Persona.js
 * 人格模組 (Persona Module)
 * 負責管理長期事實記憶 (Facts)，並透過 LLM 提取對話中的關鍵資訊。
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { getFactExtractionPrompt } from '../../config/prompts.js';

// 使用較快速的模型進行背景記憶提取，節省成本與時間
const MEMORY_MODEL = 'gemini-3-flash-preview';

export class PersonaModule {
    /**
     * @param {Object} repo - 資料倉儲實例
     */
    constructor(repo) {
        if (!repo) throw new Error('[Persona] Repository is required');
        this.repo = repo; 
        
        this.client = new OpenAI({
            apiKey: process.env.LTM_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
            baseURL: process.env.GEMINI_API_BASE_URL,
        });
    }

    /**
     * 回憶 (Recall)
     * 讀取並格式化關於該用戶的所有事實記憶。
     * @returns {Promise<Object>} { facts: Array, factsText: string }
     */
    async recall(conversationId) {
        const facts = await this.repo.getFacts(conversationId);
        const factsContextStr = this._formatFacts(facts);
        
        return {
            facts: facts,
            factsText: factsContextStr
        };
    }

    /**
     * 記憶 (Memorize)
     * 分析對話內容，提取新的事實並寫入資料庫。
     * 支援多重人格視角 (Angel/Demon) 的記憶簽名。
     * * @param {string} mode - 當前對話模式 (angel/demon/group)
     */
    async memorize(conversationId, userText, aiResponse = "", mode = 'demon') {
        try {
            // 1. 決定記憶視角 (Target Persona)
            let targetPersona = mode;
            if (mode === 'group') {
                // 群組模式下，隨機由其中一位人格進行紀錄
                targetPersona = Math.random() > 0.5 ? 'demon' : 'angel';
            }

            // 2. 準備上下文
            const existingFacts = await this.repo.getFacts(conversationId);
            const contextStr = this._formatFacts(existingFacts);
            const safeResponse = aiResponse || "(無回應)";

            // 3. 構建提取 Prompt
            const prompt = getFactExtractionPrompt(userText, safeResponse, contextStr, targetPersona);
            const fullPrompt = `${prompt}\n\n**[Instruction]** If the subject is User, key starts with "User...". If AI, key starts with "Lilith...".`;

            // 4. 呼叫 LLM 進行提取
            const response = await this.client.chat.completions.create({
                model: MEMORY_MODEL,
                messages: [{ role: "user", content: fullPrompt }],
                response_format: { type: "json_object" }
            });

            const resultText = response.choices[0].message.content || "{}";
            let factData = {};
            try {
                factData = JSON.parse(resultText.trim());
            } catch (jsonErr) {
                return; // 解析失敗或無新記憶，直接返回
            }

            // 5. 存檔與簽名 (Soul Signature)
            if (factData.fact_key && factData.fact_detail) {
                const scope = factData.scope || 'user';
                
                // 根據人格加上簽名前綴，增加記憶的沈浸感
                let signature = 'System';
                if (targetPersona === 'angel') signature = 'Angel';
                else if (targetPersona === 'demon') signature = 'Demon';
                
                const signedDetail = `[${signature}] ${factData.fact_detail}`;

                await this.repo.saveFact(conversationId, factData.fact_key, signedDetail, scope);
                
                appLogger.info(`📝 [Persona] Fact Memorized (${targetPersona}): [${scope}] ${factData.fact_key}: ${signedDetail}`);
            }
        } catch (e) {
            appLogger.error('[Persona] Memorize task failed:', e);
        }
    }

    /**
     * 格式化事實記憶為文本
     * @private
     */
    _formatFacts(rows) {
        if (!rows || rows.length === 0) return "（目前沒有關於前輩的特殊記憶）";
        
        const byScope = { user: [], agent: [], us: [] };
        
        for (const r of rows) {
            const s = ['user', 'agent', 'us'].includes(r.scope) ? r.scope : 'user';
            byScope[s].push(`${r.fact_key}: ${r.fact_detail}`);
        }

        const section = (items) => items.length ? `- ${items.join('\n- ')}` : '（無）';
        
        return [
            '[User Facts]', section(byScope.user),
            '',
            '[Lilith Facts]', section(byScope.agent),
            '',
            '[Shared Memories]', section(byScope.us),
        ].join('\n');
    }
}
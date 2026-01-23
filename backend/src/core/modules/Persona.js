/**
 * src/core/modules/Persona.js
 * 人格模組
 * 負責管理長期事實記憶 (Facts)
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { getFactExtractionPrompt } from '../../config/prompts.js';

// 使用較快速的模型進行背景記憶提取，節省成本與時間
const MEMORY_MODEL = 'gemini-2.5-flash';

export class PersonaModule {
    constructor(repo) {
        if (!repo) throw new Error('[Persona] Repository is required');
        this.repo = repo; 
        
        this.client = new OpenAI({
            apiKey: process.env.LTM_GEMINI_API_KEY || process.env.GEMINI_API_KEY,
            baseURL: process.env.GEMINI_API_BASE_URL,
        });
    }

    async recall(conversationId) {
        const facts = await this.repo.getFacts(conversationId);
        const factsContextStr = this._formatFacts(facts);
        
        return {
            facts: facts,
            factsText: factsContextStr
        };
    }

    /**
     * [核心功能] 記憶 (Memorize)
     * @param {string} mode - 當前對話模式 (angel/demon/group)
     */
    async memorize(conversationId, userText, aiResponse = "", mode = 'demon') {
        try {
            // ==========================================
            // 1. 決策：這篇日記由誰來寫？ (Target Persona)
            // ==========================================
            let targetPersona = mode;
            if (mode === 'group') {
                // 如果是群組模式，隨機指派一個人格來記錄
                targetPersona = Math.random() > 0.5 ? 'demon' : 'angel';
            }

            // ==========================================
            // 2. 準備上下文
            // ==========================================
            const existingFacts = await this.repo.getFacts(conversationId);
            const contextStr = this._formatFacts(existingFacts);
            
            // [Safety] 確保 aiResponse 是字串
            const safeResponse = aiResponse || "(無回應)";

            // ==========================================
            // 3. 構建提取指令
            // ==========================================
            const prompt = getFactExtractionPrompt(userText, safeResponse, contextStr, targetPersona);
            const fullPrompt = `${prompt}\n\n**[特別指令]**：事實的主詞如果是使用者，Key 請用 "前輩..." 開頭；如果是 AI，請用 "Lilith..." 開頭。`;

            // ==========================================
            // 4. 呼叫 LLM
            // ==========================================
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
                // JSON 解析失敗通常代表 LLM 拒絕生成或格式錯誤，直接忽略即可
                return;
            }

            // ==========================================
            // 5. 存檔與簽名 (Soul Signature)
            // ==========================================
            if (factData.fact_key && factData.fact_detail) {
                const scope = factData.scope || 'user';
                
                // 簽名邏輯
                let signature = 'System';
                if (targetPersona === 'angel') signature = 'Angel';
                else if (targetPersona === 'demon') signature = 'Demon';
                
                // 組合最終記憶內容
                const signedDetail = `[${signature}] ${factData.fact_detail}`;

                await this.repo.saveFact(conversationId, factData.fact_key, signedDetail, scope);
                
                appLogger.info(`📝 [Persona] Fact Memorized (${targetPersona}): [${scope}] ${factData.fact_key}: ${signedDetail}`);
            }
        } catch (e) {
            // [Fix] 印出完整錯誤物件，方便 Debug (可能是 API Key 權限、Model 名稱錯誤等)
            appLogger.error('[Persona] Memorize task failed:', e);
        }
    }

    _formatFacts(rows) {
        if (!rows || rows.length === 0) return "（目前沒有關於前輩的特殊記憶）";
        
        const byScope = { user: [], agent: [], us: [] };
        
        for (const r of rows) {
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
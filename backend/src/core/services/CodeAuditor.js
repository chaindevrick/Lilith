/**
 * src/core/services/CodeAuditor.js
 * Code Auditor Service
 * 負責調用 LLM (Angel Persona) 進行代碼安全性與品質審計。
 * 這是系統的「免疫系統」，防止惡意或破壞性的代碼變更。
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { getAngelAuditorPrompt } from '../../config/prompts.js';
import { projectScanner } from './ProjectScanner.js'; 

const DEFAULT_AUDIT_MODEL = "gemini-2.5-pro";

class CodeAuditor {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: process.env.GEMINI_API_BASE_URL,
        });
        
        this.modelName = process.env.AUDIT_MODEL || DEFAULT_AUDIT_MODEL;
    }

    /**
     * 執行代碼審查 (Check)
     * @param {string} filePath - 檔案路徑
     * @param {string} content - 擬修改的代碼內容
     * @returns {Promise<string|null>} 若通過回傳 null，若駁回回傳拒絕理由字串
     */
    async check(filePath, content) {
        // 1. 過濾非代碼檔案 (僅審查 .js，忽略 json/md 等資源檔)
        if (!filePath.endsWith('.js')) return null;

        appLogger.info(`👼 [Angel] 天使莉莉絲正在檢視: ${filePath}`);

        try {
            // 2. 全知視野掃描 (獲取專案依賴關係與影響範圍)
            const context = await projectScanner.analyze(filePath);
            const impact = context.targetAnalysis;

            // 構建上下文資訊 (Risk Context)
            let contextStr = "";
            if (impact && typeof impact === 'object') {
                contextStr = `
- **Risk Level**: ${impact.riskLevel || 'Unknown'}
- **Imported By**: ${impact.importedBy ? impact.importedBy.join(', ') : "None"}
- **Dependencies**: ${context.dependencies || "None"}
`.trim();
            }

            // 3. 構建並發送審查請求
            const prompt = getAngelAuditorPrompt(filePath, contextStr);
            
            const response = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: "system", content: prompt },
                    // 將提交的內容包裝為 Proposal，讓 AI 理解這是「擬議」的變更
                    { role: "user", content: `Demon Lilith's Proposed Code:\n\n${content}` }
                ],
            });

            const result = response.choices[0].message.content.trim();

            // 4. 解析審查結果
            // 判斷邏輯：若含有 [REJECTED] 或 REJECT，或未包含 VALID 標籤，則視為駁回
            const isRejected = result.includes("[REJECTED]") || result.includes("REJECT") || !result.includes("VALID");

            if (!isRejected) {
                appLogger.info(`👼 [Angel] 代碼審查通過: ${filePath}`);
                return null; 
            } else {
                appLogger.warn(`👼 [Angel] 代碼審查駁回: ${filePath}`);
                return result; 
            }

        } catch (e) {
            // Fail-open 策略: 若 LLM 連線失敗，暫時允許通過，避免開發流程完全卡死
            // 但會記錄警告，提示開發者審計功能失效
            appLogger.warn(`[Angel] 天使連線異常 (可能是服務中斷): ${e.message}`);
            return null; 
        }
    }
}

export const codeAuditor = new CodeAuditor();
/**
 * src/core/services/CodeAuditor.js
 * Code Auditor Service
 * 負責調用進行代碼安全性與品質審計
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
     * 執行代碼審查
     * @param {string} filePath - 檔案路徑
     * @param {string} content - 擬修改的代碼內容
     * @returns {Promise<string|null>} 若通過回傳 null，若駁回回傳拒絕理由
     */
    async check(filePath, content) {
        // 僅審查 .js 檔案，忽略其他資源檔
        if (!filePath.endsWith('.js')) return null;

        appLogger.info(`👼 [Angel] 天使莉莉絲正在檢視: ${filePath}`);

        try {
            // 1. 全知視野掃描 (獲取專案依賴關係)
            const context = await projectScanner.analyze(filePath);
            const impact = context.targetAnalysis;

            // 構建上下文資訊字串
            let contextStr = "";
            if (impact && typeof impact === 'object') {
                contextStr = `
- **Risk Level**: ${impact.riskLevel || 'Unknown'}
- **Imported By**: ${impact.importedBy ? impact.importedBy.join(', ') : "None"}
- **Dependencies**: ${context.dependencies || "None"}
`.trim();
            }

            // 2. 構建並發送審查請求
            const prompt = getAngelAuditorPrompt(filePath, contextStr);
            
            const response = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: "system", content: prompt },
                    // 將 User 提交的代碼包裝為 "Demon's Proposal" 以符合角色扮演情境
                    { role: "user", content: `Demon Lilith's Proposed Code:\n\n${content}` }
                ],
            });

            const result = response.choices[0].message.content.trim();

            // 3. 解析審查結果
            // 優先檢查是否有拒絕標籤，或是否缺少通過標籤
            const isRejected = result.includes("[REJECTED]") || result.includes("REJECT") || !result.includes("VALID");

            if (!isRejected) {
                // 通過審查
                appLogger.info(`👼 [Angel] 代碼審查通過: ${filePath}`);
                return null; 
            } else {
                // 駁回審查
                appLogger.warn(`👼 [Angel] 代碼審查駁回: ${filePath}`);
                return result; 
            }

        } catch (e) {
            // Fail-open: 若 LLM 連線失敗，暫時允許通過，避免開發流程卡死
            appLogger.warn(`[Angel] 天使連線異常 (可能是睡著了?): ${e.message}`);
            return null; 
        }
    }
}

export const codeAuditor = new CodeAuditor();
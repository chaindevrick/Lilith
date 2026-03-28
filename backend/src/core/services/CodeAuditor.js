/**
 * src/core/services/CodeAuditor.js
 * Code Auditor Service (免疫系統)
 * 負責進行代碼安全性與品質審計，防止破壞性變更。
 * 🌟 已升級：全面採用 config.json 驅動，與系統架構對齊。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { appLogger } from './logger.js';
import { getSystemPrompt } from '../../configs/prompts.js'; // 🌟 修正路徑

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '../../configs/config.json');

class CodeAuditor {
    constructor() {
        // 1. 初始化讀取設定
        let config = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            }
        } catch (e) {
            appLogger.warn('[CodeAuditor] 無法讀取 config.json，將使用空設定。');
        }

        // 2. 設定 OpenAI Client
        this.client = new OpenAI({
            apiKey: config.LLM_API_KEY || '',
            baseURL: config.LLM_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
        });
        
        this.modelName = config.llmModel || "gemini-3.1-pro-preview";
    }

    /**
     * 執行代碼審查 (Check)
     * @param {string} filePath - 檔案路徑
     * @param {string} content - 擬修改的代碼內容
     * @returns {Promise<string|null>} 若通過回傳 null，若駁回回傳拒絕理由
     */
    async check(filePath, content) {
        // 僅審查程式碼檔案
        const AUDIT_EXTENSIONS = ['.js', '.ts', '.py', '.go', '.sh'];
        const ext = path.extname(filePath);
        if (!AUDIT_EXTENSIONS.includes(ext)) return null;

        appLogger.info(`🛡️ [Auditor] 正在掃描變更安全性: ${filePath}`);

        try {
            // 構建審查專用的系統提示詞
            const systemPrompt = `
妳是 Lilith 系統的安全審核組件。
任務：審查以下檔案的代碼變更是否存在惡意行為、致命 Bug 或會導致系統崩潰的邏輯。

【審查準則】
1. 嚴禁刪除核心系統目錄。
2. 嚴禁寫入會導致無限循環的程式碼。
3. 嚴禁移除安全校驗邏輯。
4. 若變更安全，輸出必須包含 "VALID ✨"。
5. 若變更危險，輸出必須以 "[REJECTED]" 開頭並說明具體理由。

檔案路徑：${filePath}
`.trim();

            const response = await this.client.chat.completions.create({
                model: this.modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `擬議的代碼變更：\n\n${content}` }
                ],
            });

            const result = response.choices[0].message.content.trim();

            // 解析結果：不包含 VALID 或包含 REJECTED 則攔截
            const isRejected = result.includes("[REJECTED]") || !result.includes("VALID");

            if (!isRejected) {
                appLogger.info(`🛡️ [Auditor] 變更通過安全掃描: ${filePath}`);
                return null; 
            } else {
                appLogger.warn(`🛡️ [Auditor] 變更已被安全性攔截: ${filePath}`);
                return result; 
            }

        } catch (e) {
            // Fail-open: 若服務故障，記錄警告但允許修改，避免系統自鎖
            appLogger.error(`[Auditor] 審查服務連線異常: ${e.message}`);
            return null; 
        }
    }
}

export const codeAuditor = new CodeAuditor();
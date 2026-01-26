/**
 * src/core/tools/search.js
 * 搜尋模組 (Search Module)
 * 負責調用 Google Custom Search API 進行即時網路資訊檢索。
 */

import { appLogger } from '../../config/logger.js';

const GOOGLE_SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';
const SEARCH_LIMIT = 5; // 限制回傳筆數，平衡資訊量與 Token 消耗

/**
 * 執行網路搜尋
 * @param {string} query - 搜尋關鍵字
 * @returns {Promise<string>} 格式化後的搜尋結果文本 (供 LLM 閱讀)
 */
export const performWebSearch = async (query) => {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    // 1. 環境變數檢查
    if (!apiKey || !cx) {
        appLogger.warn("[Search] Missing Configuration: API_KEY or CX not found.");
        return "[System Alert] 搜尋功能暫時無法使用。請檢查 .env 檔案中的 GOOGLE_SEARCH_API_KEY 與 GOOGLE_SEARCH_CX 設定。";
    }

    try {
        appLogger.info(`[Search] Querying: "${query}"`);
        
        const params = new URLSearchParams({
            key: apiKey,
            cx: cx,
            q: query,
            num: SEARCH_LIMIT.toString()
        });

        // 2. 發送請求
        const response = await fetch(`${GOOGLE_SEARCH_URL}?${params.toString()}`);
        const data = await response.json();

        // 3. 錯誤處理 (API 層級)
        if (!response.ok || data.error) {
            const errorMsg = data.error?.message || response.statusText;
            throw new Error(`Google API Error: ${errorMsg}`);
        }

        // 4. 空結果處理
        if (!data.items || data.items.length === 0) {
            appLogger.info(`[Search] No results found for: ${query}`);
            return `[搜尋結果] 找不到關於 "${query}" 的相關資訊。`;
        }

        // 5. 格式化結果
        const results = data.items.map((item, index) => {
            // 清理摘要中的換行符號，保持格式整潔
            const snippet = (item.snippet || "").replace(/\n/g, ' ').trim();
            return `[${index + 1}] ${item.title}\n   摘要: ${snippet}\n   來源: ${item.link}`;
        }).join('\n\n');

        return `以下是關於 "${query}" 的搜尋結果：\n\n${results}`;

    } catch (error) {
        appLogger.error(`[Search] Execution failed: ${error.message}`);
        return `[System Error] 搜尋過程中發生錯誤: ${error.message}`;
    }
};
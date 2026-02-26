/**
 * src/core/tools/searchSerpapi.js
 * 搜尋模組 (Search Module)
 * 負責調用 SerpAPI 進行即時網路資訊檢索。
 */

import { appLogger } from '../../config/logger.js';
import { getJson } from 'serpapi';

/**
 * 執行網路搜尋
 * @param {string} query - 搜尋關鍵字
 * @returns {Promise<string>} 格式化後的搜尋結果文本 (供 LLM 閱讀)
 */
export const performWebSearch = async (query) => {
    // 注意：SerpAPI 通常使用單一 KEY，請確保 .env 名稱一致
    const apiKey = process.env.SERPAPI_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;

    if (!apiKey) {
        appLogger.warn("[Search] Missing Configuration: API_KEY not found.");
        return "[System Alert] 搜尋功能暫時無法使用。請檢查 .env 檔案。";
    }

    try {
        appLogger.info(`[Search] Querying: "${query}"`);

        // 使用 Promise 封裝 SerpAPI 的回呼邏輯
        const data = await new Promise((resolve, reject) => {
            getJson({
                engine: "google",
                q: query,
                api_key: apiKey,
            }, (json) => {
                if (json.error) {
                    reject(new Error(json.error));
                } else {
                    resolve(json);
                }
            });
        });

        // SerpAPI 的有機搜尋結果欄位是 organic_results
        const organicResults = data.organic_results;

        if (!organicResults || organicResults.length === 0) {
            appLogger.info(`[Search] No results found for: ${query}`);
            return `[搜尋結果] 找不到關於 "${query}" 的相關資訊。`;
        }

        // 格式化前 5 筆結果
        const results = organicResults.slice(0, 5).map((item, index) => {
            const snippet = (item.snippet || "").replace(/\n/g, ' ').trim();
            return `[${index + 1}] ${item.title}\n   摘要: ${snippet}\n   來源: ${item.link}`;
        }).join('\n\n');

        return `以下是關於 "${query}" 的搜尋結果：\n\n${results}`;

    } catch (error) {
        appLogger.error(`[Search] Execution failed: ${error.message}`);
        return `[System Error] 搜尋過程中發生錯誤: ${error.message}`;
    }
};
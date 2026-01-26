/**
 * src/core/tools/network.js
 * Web Fetcher
 * 負責從外部 URL 提取內容，具備偽裝 Headers 與基礎抗指紋偵測 (Anti-bot) 能力。
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { appLogger } from '../../config/logger.js';

// ============================================================
// Constants
// ============================================================

const TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 12000; // 稍微放寬長度限制以容納更多上下文
const MIN_VALID_LENGTH = 50;

// 隨機 User-Agent 池 (模擬主流瀏覽器)
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
];

// 要移除的 HTML 雜訊標籤
const NOISE_SELECTORS = [
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
    'nav', 'footer', 'header', 'aside',
    '.ad', '.advertisement', '.social-share', '#sidebar', '.cookie-banner', '.popup'
].join(',');

// ============================================================
// Helper Functions
// ============================================================

const getRandomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// ============================================================
// Main Export
// ============================================================

/**
 * 從目標 URL 提取核心文本內容
 * @param {string} url - 目標網址
 * @returns {Promise<string>} 提取後的純文本或錯誤訊息
 */
export const fetchWebContent = async (url) => {
    try {
        appLogger.info(`[Network] Establishing stealth connection: ${url}`);
        
        // [Stealth Headers] 模擬真實瀏覽器行為
        const config = {
            headers: {
                'User-Agent': getRandomAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0',
                'Referer': 'https://www.google.com/' 
            },
            timeout: TIMEOUT_MS,
            maxRedirects: 5,
            decompress: true // 自動處理 Gzip
        };

        const response = await axios.get(url, config);

        // 解析 HTML
        const $ = cheerio.load(response.data);

        // 1. 移除雜訊 (DOM Cleaning)
        $(NOISE_SELECTORS).remove();

        // 2. 提取主要文本 (Content Extraction Strategy)
        // 優先嘗試語意化標籤，若無則回退到通用 class，最後回退到 body
        let content = $('article').text().trim() || 
                      $('main').text().trim() || 
                      $('.content').text().trim() || 
                      $('.post-body').text().trim() || 
                      $('.entry-content').text().trim() ||
                      $('body').text().trim();
        
        // 3. 清洗文本 (Text Normalization)
        // [Fix] 修正舊邏輯：先將多餘空白(含tab)轉為單一空格，但保留換行結構，最後再合併多餘換行
        content = content
            .replace(/[ \t]+/g, ' ')      // 合併水平空白
            .replace(/\n\s*\n/g, '\n')    // 合併多餘空行
            .trim();

        // 4. 長度檢查與截斷
        if (content.length > MAX_CONTENT_LENGTH) {
            content = content.substring(0, MAX_CONTENT_LENGTH) + "\n...(內容過長，系統已截斷)";
        }

        // 5. 有效性檢查 (SPA 或 反爬蟲檢測)
        if (content.length < MIN_VALID_LENGTH) {
            appLogger.warn(`[Network] Content too short (${content.length} chars). Possible SPA or Anti-bot.`);
            return `[存取受限] 目標網站似乎有高階結界 (SPA/Anti-bot)，無法提取有效內容。\n原始回傳長度: ${content.length}`;
        }

        appLogger.info(`[Network] Fetch success. Length: ${content.length}`);
        return `[來源 URL]: ${url}\n[擷取內容]:\n${content}`;

    } catch (error) {
        // 特別處理 403 Forbidden / 401 Unauthorized
        if (error.response && (error.response.status === 403 || error.response.status === 401)) {
            appLogger.error(`[Network] Stealth failed (403/401). Blocked by target.`);
            return `[存取受限] 目標網站拒絕了妳的連線請求 (HTTP ${error.response.status})，可能是因為反爬蟲機制阻擋了妳。`;
        }
        
        // 處理 404 Not Found
        if (error.response && error.response.status === 404) {
            return `[錯誤] 目標頁面不存在 (HTTP 404)。`;
        }

        appLogger.error(`[Network] Connection failed: ${error.message}`);
        return `[連線失敗] 無法存取目標網址: ${error.message}`;
    }
};
import axios from 'axios';
import * as cheerio from 'cheerio';
import { getJson } from 'serpapi';

const fetchWebContent = async (url) => {
    try {
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }, timeout: 15000 });
        const $ = cheerio.load(response.data);
        $('script, style, noscript, iframe, img, svg, header, footer, nav').remove();
        let content = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
        if (content.length > 12000) content = content.substring(0, 12000) + "\n...(系統已截斷)";
        return content.length < 50 ? "[存取受限] 目標網站可能有反爬蟲結界。" : `[來源]: ${url}\n[內容]:\n${content}`;
    } catch (e) { return `[擷取失敗] ${e.message}`; }
};

const performWebSearch = async (query, config) => {
    // 🌟 OpenClaw 格式優先，無則 Fallback
    const apiKey = config.skills?.entries?.['web-toolkit']?.env || {};

    if (!apiKey) return "[System Alert] 搜尋 API KEY 未設定。請在設定中配置。";
    
    try {
        const data = await new Promise((res, rej) => getJson({ engine: "google", q: query, api_key: apiKey }, j => j.error ? rej(new Error(j.error)) : res(j)));
        if (!data.organic_results || data.organic_results.length === 0) return `找不到關於 "${query}" 的資訊。`;
        const results = data.organic_results.slice(0, 5).map((i, idx) => `[${idx + 1}] ${i.title}\n   摘要: ${i.snippet}\n   來源: ${i.link}`).join('\n\n');
        return `"${query}" 的搜尋結果：\n\n${results}`;
    } catch (e) { return `[搜尋失敗] ${e.message}`; }
};

export default {
    // 🌟 接收注入的 config
    run: async ({ action, queryOrUrl }, config) => {
        if (action === 'search') return await performWebSearch(queryOrUrl, config);
        if (action === 'read') return await fetchWebContent(queryOrUrl);
        return `[System Error] Unknown network action: ${action}`;
    }
};
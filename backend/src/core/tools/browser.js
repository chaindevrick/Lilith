/**
 * src/core/tools/browser.js
 * 瀏覽器操作模組 (基於 Playwright CDP 連線)
 * 具備 DOM 元素標記 (Set-of-Mark) 與 Host 偽造能力
 */

import { chromium } from 'playwright';
import http from 'http';
import { appLogger } from '../../config/logger.js';

let browserContext = null;
let activePage = null;

// 取得 Chrome WebSocket URL (繞過 DNS 防護)
const getChromeWsUrl = () => {
    return new Promise((resolve, reject) => {
        appLogger.info('[Browser] Requesting WS endpoint via low-level HTTP...');
        const req = http.request({
            hostname: 'host.docker.internal',
            port: 9222,
            path: '/json/version',
            method: 'GET',
            headers: { 'Host': '127.0.0.1:9222' }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                try {
                    const data = JSON.parse(body);
                    const wsId = data.webSocketDebuggerUrl.split('/').pop();
                    resolve(`ws://host.docker.internal:9222/devtools/browser/${wsId}`);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
};

// 🌟 核心升級：擷取頁面狀態並注入 Lilith 專屬 ID
const getPageState = async () => {
    if (!activePage) return "無法獲取頁面狀態";
    
    // 1. 在網頁內執行 DOM 掃描與 ID 標記
    const interactiveElements = await activePage.evaluate(() => {
        let idCounter = 1;
        const elementsList = [];
        
        // 抓取常見的互動元素
        const interactives = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"]');

        interactives.forEach(el => {
            const rect = el.getBoundingClientRect();
            // 判斷元素是否可見，且位於目前的螢幕視窗內 (Viewport)
            const isVisible = rect.width > 0 && rect.height > 0 && 
                              rect.bottom >= 0 && 
                              rect.top <= (window.innerHeight || document.documentElement.clientHeight);
            
            if (isVisible) {
                const id = idCounter++;
                // 偷偷在真實網頁上植入這個屬性
                el.setAttribute('data-lilith-id', id);

                // 嘗試提取能幫助 LLM 辨識這個按鈕的文字
                let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '';
                text = text.trim().substring(0, 50).replace(/\n/g, ' '); 
                
                const tag = el.tagName.toLowerCase();
                let type = el.type ? ` type="${el.type}"` : '';

                elementsList.push(`[ID: ${id}] <${tag}${type}> ${text ? `"${text}"` : '(無文字/圖示)'}`);
            }
        });
        return elementsList;
    });

    // 2. 取得基礎資訊
    const info = await activePage.evaluate(() => {
        return {
            title: document.title,
            scrollY: Math.round(window.scrollY),
            innerHeight: window.innerHeight,
            scrollHeight: document.body.scrollHeight,
            text: document.body.innerText.replace(/\n{3,}/g, '\n\n').substring(0, 1000) // 縮短純文字避免 Token 浪費
        };
    });

    // 3. 組裝成給 Lilith 閱讀的超強上下文
    let stateMsg = `\n📊 [當前畫面狀態]\n- 標題: ${info.title}\n- 滾動位置: ${info.scrollY}px / 總高度: ${info.scrollHeight}px (視窗高度: ${info.innerHeight}px)\n`;
    stateMsg += `\n🎯 [當前視窗內可互動元素 (Interactive Elements)]\n`;
    stateMsg += interactiveElements.length > 0 ? interactiveElements.join('\n') : "無可見互動元素";
    stateMsg += `\n\n📝 [畫面文字預覽 (前1000字)]\n${info.text}\n`;

    return stateMsg;
};

export const connectAndNavigate = async ({ url }) => {
    try {
        if (!browserContext) {
            appLogger.info('[Browser] Connecting to local Chrome via CDP...');
            const wsUrl = await getChromeWsUrl();
            browserContext = await chromium.connectOverCDP(wsUrl);
            activePage = browserContext.contexts()[0].pages()[0] || await browserContext.contexts()[0].newPage();
        }
        
        appLogger.info(`[Browser] Navigating to: ${url}`);
        await activePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await activePage.waitForTimeout(2000); 
        
        return `成功連接並訪問 ${url}。${await getPageState()}\n👉 請根據上述【互動元素】列表，使用 [data-lilith-id="X"] 作為選擇器進行操作。`;
    } catch (e) {
        appLogger.error('[Browser] Navigation Error:', e);
        return `連線失敗。錯誤: ${e.message}`;
    }
};

export const interactWithPage = async ({ action, selector, text }) => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。請先執行 browser_connectAndNavigate。";
    try {
        if (action === 'click') {
            appLogger.info(`[Browser] Clicking: ${selector}`);
            await activePage.click(selector, { timeout: 10000 });
            await activePage.waitForTimeout(2000); 
            return `✅ 已成功點擊: ${selector}。點擊後的網頁變化如下：${await getPageState()}`;
        } else if (action === 'type') {
            appLogger.info(`[Browser] Typing into ${selector}: ${text}`);
            await activePage.fill(selector, text, { timeout: 10000 });
            await activePage.keyboard.press('Enter'); 
            await activePage.waitForTimeout(2000);
            return `✅ 已在 ${selector} 輸入 "${text}" 並按下 Enter。輸入後的網頁變化如下：${await getPageState()}`;
        } else {
            return `未知的動作類型: ${action}`;
        }
    } catch (e) {
        return `❌ 操作失敗: 找不到元素 ${selector} 或發生超時。錯誤: ${e.message}`;
    }
};

export const scrollPage = async ({ direction = 'down', amount = 800 }) => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。";
    try {
        appLogger.info(`[Browser] Scrolling ${direction} by ${amount}px`);
        const y = direction === 'down' ? amount : -amount;
        await activePage.evaluate((scrollAmount) => window.scrollBy(0, scrollAmount), y);
        await activePage.waitForTimeout(1500); 
        return `✅ 已向${direction === 'down' ? '下' : '上'}滾動 ${amount}px。滾動後的畫面如下：${await getPageState()}`;
    } catch (e) {
        return `❌ 滾動失敗: ${e.message}`;
    }
};

export const takeScreenshot = async () => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。";
    try {
        const buffer = await activePage.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' });
        return `✅ 截圖成功！\n[IMAGE_BASE64]data:image/jpeg;base64,${buffer}`;
    } catch (e) {
        return `❌ 截圖失敗: ${e.message}`;
    }
};
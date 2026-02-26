/**
 * src/core/tools/browser.js
 * 瀏覽器操作模組 (基於 Playwright CDP 連線)
 */

import { chromium } from 'playwright';
import { appLogger } from '../../config/logger.js';

let browserContext = null;
let activePage = null;

// 輔助函數：獲取當前頁面狀態 (讓 Lilith 即時知道她在幹嘛)
const getPageState = async () => {
    if (!activePage) return "無法獲取頁面狀態";
    
    const info = await activePage.evaluate(() => {
        return {
            title: document.title,
            scrollY: Math.round(window.scrollY),
            innerHeight: window.innerHeight,
            scrollHeight: document.body.scrollHeight,
            // 只擷取一定長度的文字，避免 Token 爆表
            text: document.body.innerText.replace(/\n{3,}/g, '\n\n').substring(0, 3000)
        };
    });

    return `\n📊 [當前畫面狀態]\n- 標題: ${info.title}\n- 滾動位置: ${info.scrollY}px / 總高度: ${info.scrollHeight}px (視窗高度: ${info.innerHeight}px)\n- 畫面文字預覽:\n${info.text}\n`;
};

export const connectAndNavigate = async ({ url }) => {
    try {
        if (!browserContext) {
            appLogger.info('[Browser] Connecting to local Chrome via CDP...');
            browserContext = await chromium.connectOverCDP('http://host.docker.internal:9222');
            activePage = browserContext.contexts()[0].pages()[0] || await browserContext.contexts()[0].newPage();
        }
        
        appLogger.info(`[Browser] Navigating to: ${url}`);
        await activePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // 等待一下讓動態內容載入
        await activePage.waitForTimeout(2000); 
        
        const state = await getPageState();
        return `成功連接並訪問 ${url}。${state}\n👉 請根據上述內容決定下一步要點擊、輸入或滾動。`;
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
            await activePage.waitForTimeout(2000); // 等待點擊後的網頁跳轉或渲染
            
            const state = await getPageState();
            return `✅ 已成功點擊: ${selector}。點擊後的網頁變化如下：${state}`;
            
        } else if (action === 'type') {
            appLogger.info(`[Browser] Typing into ${selector}: ${text}`);
            await activePage.fill(selector, text, { timeout: 10000 });
            await activePage.keyboard.press('Enter'); // 通常輸入完會伴隨 Enter
            await activePage.waitForTimeout(2000);
            
            const state = await getPageState();
            return `✅ 已在 ${selector} 輸入 "${text}" 並按下 Enter。輸入後的網頁變化如下：${state}`;
        } else {
            return `未知的動作類型: ${action}`;
        }
    } catch (e) {
        appLogger.error(`[Browser] Interact Error:`, e);
        return `❌ 操作失敗: 找不到元素 ${selector} 或發生超時。錯誤: ${e.message}`;
    }
};

export const scrollPage = async ({ direction = 'down', amount = 800 }) => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。";
    
    try {
        appLogger.info(`[Browser] Scrolling ${direction} by ${amount}px`);
        const y = direction === 'down' ? amount : -amount;
        
        await activePage.evaluate((scrollAmount) => window.scrollBy(0, scrollAmount), y);
        await activePage.waitForTimeout(1500); // 等待滾動動畫與圖片懶加載
        
        const state = await getPageState();
        return `✅ 已向${direction === 'down' ? '下' : '上'}滾動 ${amount}px。滾動後的畫面如下：${state}`;
    } catch (e) {
        return `❌ 滾動失敗: ${e.message}`;
    }
};

export const takeScreenshot = async () => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。";
    
    try {
        appLogger.info(`[Browser] Taking screenshot...`);
        // 擷取 Base64 格式的圖片
        const buffer = await activePage.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' });
        
        // 回傳特殊的格式，讓前端或 LLM 知道這是一張圖
        return `✅ 截圖成功！\n[IMAGE_BASE64]data:image/jpeg;base64,${buffer}`;
    } catch (e) {
        return `❌ 截圖失敗: ${e.message}`;
    }
};
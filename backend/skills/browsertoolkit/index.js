import { chromium } from 'playwright';
import http from 'http';
import { appLogger } from '../../src/agents/core/services/logger.js'; 
import { config } from 'process';

let browserContext = null;
let activePage = null;

const getChromeWsUrl = () => {
    return new Promise((resolve, reject) => {
        appLogger.info('[Browser] Requesting WS endpoint via low-level HTTP...');
        const { BROWSERLESS_WS_ENDPOINT } = config.entries?.['browsertoolkit']?.skillEnv;
        const req = http.request({
            hostname: BROWSERLESS_WS_ENDPOINT,
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

const getPageState = async () => {
    if (!activePage) return "無法獲取頁面狀態";
    
    const pages = browserContext.contexts()[0].pages();
    let tabsInfo = '\n📑 [當前分頁]\n';
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const isActive = (p === activePage) ? '👉' : '  ';
        let pTitle = "載入中...";
        try { pTitle = await p.title(); pTitle = pTitle.substring(0, 20); } catch(e){}
        tabsInfo += `${isActive} ID:${i} | ${pTitle}\n`;
    }

    const interactiveElements = await activePage.evaluate(() => {
        let idCounter = 1;
        const elementsList = [];
        const interactives = document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"]');

        interactives.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && 
                              rect.bottom >= 0 && 
                              rect.top <= (window.innerHeight || document.documentElement.clientHeight);
            
            if (isVisible) {
                const id = idCounter++;
                el.setAttribute('data-lilith-id', id);
                
                if (elementsList.length < 80) {
                    let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '';
                    text = text.trim().substring(0, 25).replace(/\n/g, ' '); 
                    const tag = el.tagName.toLowerCase();
                    let type = el.type ? ` type="${el.type}"` : '';
                    elementsList.push(`[ID: ${id}] <${tag}${type}> ${text ? `"${text}"` : ''}`);
                }
            }
        });
        
        if (idCounter > 80) {
            elementsList.push(`...(省略 ${idCounter - 80} 個次要或畫面外元素)...`);
        }
        return elementsList;
    });

    const info = await activePage.evaluate(() => {
        const fullText = document.body.innerText.replace(/\n{2,}/g, '\n');
        const scrollRatio = window.scrollY / (document.body.scrollHeight || 1);
        let startIndex = Math.floor(fullText.length * scrollRatio);
        let visibleText = fullText.substring(startIndex, startIndex + 600);

        return {
            title: document.title,
            scrollY: Math.round(window.scrollY),
            innerHeight: window.innerHeight,
            scrollHeight: document.body.scrollHeight,
            text: visibleText
        };
    });

    let stateMsg = tabsInfo; 
    stateMsg += `\n📊 [畫面狀態] 標題: ${info.title} | 滾動: ${info.scrollY}px / ${info.scrollHeight}px\n`;
    stateMsg += `\n🎯 [互動元素]\n`;
    stateMsg += interactiveElements.length > 0 ? interactiveElements.join('\n') : "無可見互動元素";
    stateMsg += `\n\n📝 [預覽]\n${info.text}\n`;

    return stateMsg;
};

const manageTabs = async ({ action, tabId }) => {
    if (!browserContext) return "錯誤：尚未連接瀏覽器。";
    const pages = browserContext.contexts()[0].pages();

    try {
        if (action === 'new') {
            appLogger.info('[Browser] Opening new blank tab');
            activePage = await browserContext.contexts()[0].newPage();
            await activePage.bringToFront();
            return `✅ 已開啟並切換至新分頁。當前狀態：\n${await getPageState()}`;
        }

        const targetIndex = parseInt(tabId, 10);
        if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= pages.length) {
            return `❌ 錯誤：無效的分頁ID (${tabId})。`;
        }

        if (action === 'switch') {
            appLogger.info(`[Browser] Switching to tab ${targetIndex}`);
            activePage = pages[targetIndex];
            await activePage.bringToFront();
            return `✅ 已切換至分頁ID: ${targetIndex}。當前狀態：\n${await getPageState()}`;
        } else if (action === 'close') {
            appLogger.info(`[Browser] Closing tab ${targetIndex}`);
            const pageToClose = pages[targetIndex];
            await pageToClose.close();
            
            const remainingPages = browserContext.contexts()[0].pages();
            if (remainingPages.length > 0) {
                if (activePage === pageToClose) {
                    activePage = remainingPages[remainingPages.length - 1];
                    await activePage.bringToFront();
                }
                return `✅ 已關閉分頁 ${targetIndex}。當前狀態：\n${await getPageState()}`;
            } else {
                activePage = null;
                return `✅ 已關閉最後一個分頁。瀏覽器目前無任何開啟的網頁。`;
            }
        } else {
            return `❌ 未知的動作類型: ${action}`;
        }
    } catch (e) {
        return `❌ 分頁操作失敗: ${e.message}`;
    }
};

const connectAndNavigate = async ({ url, newTab = false }) => {
    try {
        if (!browserContext) {
            appLogger.info('[Browser] Connecting to local Chrome via CDP...');
            const wsUrl = await getChromeWsUrl();
            browserContext = await chromium.connectOverCDP(wsUrl);
            activePage = browserContext.contexts()[0].pages()[0] || await browserContext.contexts()[0].newPage();
        } else if (newTab) {
            appLogger.info('[Browser] Opening new tab for navigation');
            activePage = await browserContext.contexts()[0].newPage();
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

const interactWithPage = async ({ action, selector, text }) => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。請先執行 browser_connectAndNavigate。";
    try {
        if (action === 'click') {
            appLogger.info(`[Browser] Clicking: ${selector}`);
            await activePage.click(selector, { timeout: 10000 });
            await activePage.waitForTimeout(3500); 
            
            const pages = browserContext.contexts()[0].pages();
            if (pages.length > 0) {
                activePage = pages[pages.length - 1]; 
                await activePage.bringToFront();
            }
            return `✅ 已成功點擊: ${selector}。點擊後的網頁變化如下：${await getPageState()}`;
        } else if (action === 'type') {
            appLogger.info(`[Browser] Typing into ${selector}: ${text}`);
            await activePage.fill(selector, text, { timeout: 10000 });
            await activePage.keyboard.press('Enter'); 
            await activePage.waitForTimeout(3500);
            
            const pages = browserContext.contexts()[0].pages();
            if (pages.length > 0) {
                activePage = pages[pages.length - 1]; 
                await activePage.bringToFront();
            }
            return `✅ 已在 ${selector} 輸入 "${text}" 並按下 Enter。輸入後的網頁變化如下：${await getPageState()}`;
        } else {
            return `未知的動作類型: ${action}`;
        }
    } catch (e) {
        return `❌ 操作失敗: 找不到元素 ${selector} 或發生超時。錯誤: ${e.message}`;
    }
};

const scrollPage = async ({ direction = 'down', amount = 800 }) => {
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

const takeScreenshot = async () => {
    if (!activePage) return "錯誤：尚未連接瀏覽器。";
    try {
        const buffer = await activePage.screenshot({ type: 'jpeg', quality: 50, encoding: 'base64' });
        return `✅ 截圖成功！\n[IMAGE_BASE64]data:image/jpeg;base64,${buffer}`;
    } catch (e) {
        return `❌ 截圖失敗: ${e.message}`;
    }
};

export default {
    run: async (args, config, entryConfig) => {
        const { command, operation, url, selector, direction, amount, tabId, action } = args;

        appLogger.info('[Browser Skill] Received args:', args);

        // 1. 如果您的 manifest.json 中有定義 'command' 或 'operation' 作為主動作區分：
        const cmd = command || operation;
        if (cmd === 'manageTabs') return await manageTabs(args);
        if (cmd === 'connectAndNavigate') return await connectAndNavigate(args);
        if (cmd === 'interactWithPage') return await interactWithPage(args);
        if (cmd === 'scrollPage') return await scrollPage(args);
        if (cmd === 'takeScreenshot') return await takeScreenshot();

        // 2. 智慧特徵路由 (Fallback)：如果大腦沒有給出明確的 command，我們透過參數特徵來猜測意圖
        if (url) {
            return await connectAndNavigate(args);
        }
        if (selector) {
            return await interactWithPage(args);
        }
        if (direction || amount !== undefined) {
            return await scrollPage(args);
        }
        if (tabId !== undefined || ['new', 'switch', 'close'].includes(action)) {
            return await manageTabs(args);
        }
        
        // 如果都沒有命中上述特徵，預設執行截圖
        return await takeScreenshot();
    }
};
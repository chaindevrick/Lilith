/**
 * src/core/tools/registry.js
 * 工具註冊中心 (Tool Registry)
 * 經過 Token 瘦身與領域整合的優化版本。
 */

import * as Evolution from './evolution.js';
import * as Search from './searchSerpapi.js';
import * as Network from './network.js';
import { memoryVortex } from './memoryVortex.js';
import { appLogger } from '../../config/logger.js';
import { projectScanner } from '../services/ProjectScanner.js';
import { executeTerminal } from './terminal.js';
import * as browserTools from './browser.js';
import { generateImage } from './nanoBanana.js';

// ============================================================
// 1. 工具定義 (Tool Definitions / Schema)
// ============================================================

export const toolsDeclarations = [
    // --- System & Communication ---
    {
        type: 'function',
        function: {
            name: "logInternalChat",
            description: "【內心通訊】記錄 Lilith 與 Angel 之間的共生對話。當妳們在內心互相吐槽、討論前輩或交換感受時使用。",
            parameters: {
                type: "object",
                properties: {
                    dialogue: { type: "string", description: "對話內容 (格式: 'Lilith: ... \\nAngel: ...')" },
                    topic: { type: "string", description: "話題摘要" }
                },
                required: ["dialogue"]
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "restartSystem",
            description: "【系統重啟】當核心代碼發生重大變更，需要讓意識重組時使用。",
            parameters: { 
                type: "object", 
                properties: { reason: { type: "string" } } 
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "generateImage",
            description: "呼叫 Nano Banana 引擎生成圖片。⚠️ 嚴格禁止：當處於 R18、色情、過度暴力或性暗示的情境時，【絕對不可】呼叫此工具，否則會導致系統當機！R18 情境下請純用文字描述。",
            parameters: {
                type: "object",
                properties: { prompt: { type: "string", description: "圖片的英文提示詞 (Prompt)" } },
                required: ["prompt"]
            }
        }
    },

    // --- 檔案系統 (FS) ---
    {
        type: 'function',
        function: {
            name: "manageFileSystem",
            description: "【檔案系統管理】執行讀取、寫入、列出目錄、移動或刪除檔案。⚠️注意：僅限操作 Docker 容器內部環境！若要操作宿主機請用 executeTerminalCommand 透過 SSH。",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: '動作: "list" (列出目錄), "read" (讀取), "write" (寫入/修改), "move" (移動/改名), "delete" (刪除)' },
                    path: { type: "string", description: "目標路徑 (檔案或目錄的相對路徑)" },
                    content: { type: "string", description: "要寫入的代碼/內容 (僅 write 動作需要)" },
                    destPath: { type: "string", description: "移動的目的地路徑 (僅 move 動作需要)" }
                },
                required: ["action", "path"]
            }
        }
    },

    // --- Analysis ---
    {
        type: 'function',
        function: {
            name: "analyzeProject",
            description: "【全知分析】掃描專案結構或特定檔案的依賴關係與影響範圍 (僅限 Docker 內部)。",
            parameters: {
                type: "object",
                properties: { targetFile: { type: "string", description: "目標檔案 (可選)" } }
            }
        }
    },

    // --- 網路工具 ---
    {
        type: 'function',
        function: {
            name: "webToolkit",
            description: "【網路工具箱】使用搜尋引擎查找資料，或直接讀取特定網址的純文字內容。",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: '"search" (搜尋關鍵字) 或 "read" (讀取網址)' },
                    queryOrUrl: { type: "string", description: "搜尋關鍵字 或 目標網址" }
                },
                required: ["action", "queryOrUrl"]
            }
        }
    },

    // --- 記憶體系---
    {
        type: 'function',
        function: {
            name: "manageMemory",
            description: "【記憶樞紐】將重要資訊寫入長期記憶 (LTM)，或從中檢索回憶。",
            parameters: {
                type: "object",
                properties: {
                    action: { type: "string", description: '"store" (寫入記憶) 或 "query" (檢索記憶)' },
                    data: { type: "string", description: "要存入的內容，或要檢索的關鍵字意圖" },
                    source: { type: "string", description: "來源 (如: User, Web)，僅 store 建議提供" },
                    category: { type: "string", description: "分類標籤，僅 store 建議提供" }
                },
                required: ["action", "data"]
            }
        }
    },

    // --- Terminal & Browser (保持獨立，因參數複雜度較高) ---
    {
        type: 'function',
        function: {
            name: "executeTerminalCommand",
            description: "【全狀態終端機】在持續開啟的 shell 執行 Bash 指令 (預設為 Docker 內部)。要操作使用者本機請在此執行 SSH。",
            parameters: {
                type: "object", 
                properties: { command: { type: 'string', description: '要執行的 Bash 指令' } },
                required: ['command']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_manageTabs',
            description: '【分頁管理員】管理瀏覽器分頁 (開啟空白新分頁、切換視角、關閉分頁)。',
            parameters: {
                type: 'object', 
                properties: {
                    action: { type: 'string', description: '"new" (開新分頁), "switch" (切換分頁), "close" (關閉分頁)' },
                    tabId: { type: 'number', description: '目標分頁 ID (僅 switch 和 close 需要)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_connectAndNavigate',
            description: '連接本機 Chrome 並訪問網址。會回傳最新的網頁文字與狀態。',
            parameters: {
                type: 'object', 
                properties: { 
                    url: { type: 'string' },
                    newTab: { type: 'boolean', description: '是否要在全新分頁開啟？預設 false' }
                }, 
                required: ['url']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_interact',
            description: '在網頁上進行點擊或輸入。執行後自動回傳網頁狀態。',
            parameters: {
                type: 'object', 
                properties: {
                    action: { type: 'string', description: '"click" (點擊) 或 "type" (輸入文字)' }, 
                    selector: { type: 'string', description: '請使用狀態回報中的專屬屬性，例如: "[data-lilith-id=\\"15\\"]"' }, 
                    text: { type: 'string', description: '要輸入的文字 (僅 type 需要)' } 
                },
                required: ['action', 'selector']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_scroll',
            description: '滾動網頁。',
            parameters: {
                type: 'object', 
                properties: {
                    direction: { type: 'string', description: '"down" 或 "up"' }, 
                    amount: { type: 'number', description: '滾動像素，預設 800' } 
                },
                required: ['direction']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_screenshot',
            description: '擷取當前網頁畫面的截圖 (Base64)。',
            parameters: { type: 'object', properties: {} }
        }
    }
];

// ============================================================
// 2. 實作映射 (Implementation Map)
// ============================================================

const toolMap = {
    // System
    logInternalChat: async ({ dialogue, topic }) => { 
        appLogger.info(`[Internal Chat] ${topic}\n${dialogue}`); 
        return `[System] Logged.`; 
    },
    restartSystem: () => Evolution.restartSystem(),
    generateImage: async ({ prompt }) => generateImage({ prompt }),

    // 整合後的 FS 路由器
    manageFileSystem: async ({ action, path, content, destPath }) => {
        switch (action) {
            case 'list': return Evolution.listProjectStructure(path);
            case 'read': return Evolution.readCodeFile(path);
            case 'write': return Evolution.writeCodeFile(path, content);
            case 'move': return Evolution.moveFile(path, destPath);
            case 'delete': return Evolution.deleteFile(path);
            default: return `[System Error] Unknown FS action: ${action}`;
        }
    },
    
    // Analysis
    analyzeProject: ({ targetFile }) => projectScanner.generateReport(targetFile),
    
    // 整合後的 Network 路由器
    webToolkit: async ({ action, queryOrUrl }) => {
        if (action === 'search') return Search.performWebSearch(queryOrUrl);
        if (action === 'read') return Network.fetchWebContent(queryOrUrl);
        return `[System Error] Unknown network action: ${action}`;
    },
    
    // Memory 路由器
    manageMemory: async ({ action, data, source, category }) => {
        if (action === 'store') return memoryVortex.memorize(data, { source, category });
        if (action === 'query') return memoryVortex.recall(data);
        return `[System Error] Unknown memory action: ${action}`;
    },

    // Terminal & Browser
    executeTerminalCommand: ({ command }) => executeTerminal({ command }), 
    browser_manageTabs: ({ action, tabId }) => browserTools.manageTabs({ action, tabId }),
    browser_connectAndNavigate: ({ url, newTab }) => browserTools.connectAndNavigate({ url, newTab }),
    browser_interact: ({ action, selector, text }) => browserTools.interactWithPage({ action, selector, text }),
    browser_scroll: ({ direction, amount }) => browserTools.scrollPage({ direction, amount }),
    browser_screenshot: () => browserTools.takeScreenshot()
};

// ============================================================
// 3. 執行入口 (Executor)
// ============================================================

export const executeTool = async (name, args) => {
    const func = toolMap[name];
    
    if (!func) {
        appLogger.error(`[Tools] Tool '${name}' not found.`);
        return `[System Error] Tool '${name}' not found in registry.`;
    }

    try { 
        return await func(args); 
    } catch (error) { 
        appLogger.error(`[Tools] Execution failed for '${name}':`, error);
        return `[System Error] Tool execution failed: ${error.message}`; 
    }
};
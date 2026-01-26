/**
 * src/core/tools/registry.js
 * 工具註冊中心 (Tool Registry)
 * 定義 LLM 可使用的 Function Calling 介面 (Schema)，並負責路由至具體實作。
 */

import * as Evolution from './evolution.js';
import * as Search from './search.js';
import * as Network from './network.js';
import { memoryVortex } from './memoryVortex.js';
import { appLogger } from '../../config/logger.js';
import { projectScanner } from '../services/ProjectScanner.js';

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
            description: "【系統重啟】當核心代碼或規則發生重大變更，需要讓意識重組時使用。",
            parameters: { type: "object", properties: {} }
        }
    },

    // --- Filesystem & Evolution (Evolution.js) ---
    {
        type: 'function',
        function: {
            name: "listProjectStructure",
            description: "【全知之眼】查看目前的專案結構與檔案列表。對應能力：領域觀測。",
            parameters: {
                type: "object",
                properties: {
                    dir: { type: "string", description: "目標目錄 (預設為根目錄)" }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "readCodeFile",
            description: "【代碼審計/真理之眼】讀取特定檔案的內容以進行分析。對應能力：尋找 Bug、檢查邏輯。",
            parameters: {
                type: "object",
                properties: {
                    relativePath: { type: "string", description: "檔案相對路徑" }
                },
                required: ["relativePath"]
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "writeCodeFile",
            description: "【現實重寫/神聖重構】寫入或修改代碼。對應能力：邏輯實作、修復 Bug、優化架構。",
            parameters: {
                type: "object",
                properties: {
                    relativePath: { type: "string", description: "檔案相對路徑" },
                    codeContent: { type: "string", description: "完整的代碼內容" }
                },
                required: ["relativePath", "codeContent"]
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "moveFile",
            description: "【檔案遷移】移動或重新命名檔案。對應能力：整理秩序。",
            parameters: {
                type: "object",
                properties: {
                    sourcePath: { type: "string" },
                    destPath: { type: "string" }
                },
                required: ["sourcePath", "destPath"]
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "deleteFile",
            description: "【存在抹除/清理畫布】永久刪除檔案。對應能力：刪除垃圾、清除威脅。",
            parameters: {
                type: "object",
                properties: {
                    targetPath: { type: "string" }
                },
                required: ["targetPath"]
            }
        }
    },

    // --- Analysis (ProjectScanner.js) ---
    {
        type: 'function',
        function: {
            name: "analyzeProject",
            description: "【全知分析】掃描專案結構或特定檔案的依賴關係與影響範圍。當需要理解程式架構時使用。",
            parameters: {
                type: "object",
                properties: {
                    targetFile: { type: "string", description: "目標檔案 (可選)" }
                }
            }
        }
    },

    // --- Network & Search (Network.js / Search.js) ---
    {
        type: 'function',
        function: {
            name: "searchInternet",
            description: "【網路連結/靈感搜尋】搜尋網際網路資料。",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "搜尋關鍵字" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "readUrl",
            description: "【讀取連結】讀取特定網址的內容。",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string" }
                },
                required: ["url"]
            }
        }
    },

    // --- Memory (MemoryVortex.js) ---
    {
        type: 'function',
        function: {
            name: "storeMemory",
            description: "【記憶寫入】將重要的對話、喜好或事實存入核心資料庫 (LTM)。",
            parameters: {
                type: "object",
                properties: {
                    content: { type: "string", description: "記憶內容" },
                    source: { type: "string", description: "來源 (如: User, Web)" },
                    category: { type: "string", description: "分類標籤" }
                },
                required: ["content"]
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "queryMemory",
            description: "【記憶檢索】回憶過去的對話或知識。",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "檢索意圖" }
                },
                required: ["query"]
            }
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
    
    // Evolution (FS)
    listProjectStructure: ({ dir }) => Evolution.listProjectStructure(dir),
    readCodeFile: ({ relativePath }) => Evolution.readCodeFile(relativePath),
    writeCodeFile: ({ relativePath, codeContent }) => Evolution.writeCodeFile(relativePath, codeContent),
    moveFile: ({ sourcePath, destPath }) => Evolution.moveFile(sourcePath, destPath),
    deleteFile: ({ targetPath }) => Evolution.deleteFile(targetPath),
    
    // Analysis
    analyzeProject: ({ targetFile }) => projectScanner.generateReport(targetFile),
    
    // Network
    searchInternet: ({ query }) => Search.performWebSearch(query),
    readUrl: ({ url }) => Network.fetchWebContent(url),
    
    // Memory
    storeMemory: ({ content, source, category }) => memoryVortex.memorize(content, { source, category }),
    queryMemory: ({ query }) => memoryVortex.recall(query),
};

// ============================================================
// 3. 執行入口 (Executor)
// ============================================================

/**
 * 執行指定的工具函數
 * @param {string} name - 工具名稱
 * @param {Object} args - 參數物件
 */
export const executeTool = async (name, args) => {
    const func = toolMap[name];
    
    if (!func) {
        appLogger.error(`[Tools] Tool '${name}' not found.`);
        return `[System Error] Tool '${name}' not found in registry.`;
    }

    try { 
        // 執行並回傳結果
        return await func(args); 
    } catch (error) { 
        appLogger.error(`[Tools] Execution failed for '${name}':`, error);
        return `[System Error] Tool execution failed: ${error.message}`; 
    }
};
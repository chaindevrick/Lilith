/**
 * src/core/tools/registry.js
 * 工具註冊中心
 * 定義 LLM 可使用的 Function Calling 介面，並負責路由至具體實作
 */

import * as Evolution from './evolution.js';
import * as Search from './search.js';
import * as Network from './network.js';
import { memoryVortex } from './memoryVortex.js';
import { appLogger } from '../../config/logger.js';
import { projectScanner } from '../services/ProjectScanner.js';

// ============================================================
// 1. 工具定義 (Tool Definitions)
// 供 LLM 理解有哪些能力可使用
// ============================================================

export const toolsDeclarations = [
    // --- 系統與溝通 ---
    {
        type: 'function',
        function: {
            name: "logInternalChat",
            description: "【系統後台】記錄 Lilith 與 Angel 之間的內部對話。當妳們在閒聊或討論前輩時，使用此工具將對話寫入日誌。",
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
            description: "【系統操作】重啟系統核心。當代碼修改完成後，必須呼叫此工具使變更生效。",
            parameters: { type: "object", properties: {} }
        }
    },

    // --- 檔案與專案操作 (Evolution) ---
    {
        type: 'function',
        function: {
            name: "listProjectStructure",
            description: "查看專案檔案結構",
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
            name: "analyzeProject",
            description: "分析專案依賴關係與風險 (全知掃描)",
            parameters: {
                type: "object",
                properties: {
                    targetFile: { type: "string", description: "指定分析的檔案路徑 (可選)" }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "readCodeFile",
            description: "讀取檔案內容",
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
            description: "【危險操作】寫入或修改代碼檔案。會觸發 Angel 審查機制。",
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
            description: "【危險操作】移動或重新命名檔案。會觸發 Angel 審查機制。",
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
            description: "【危險操作】刪除檔案。會觸發 Angel 審查機制。",
            parameters: {
                type: "object",
                properties: {
                    targetPath: { type: "string" }
                },
                required: ["targetPath"]
            }
        }
    },

    // --- 網路與知識 (Network) ---
    {
        type: 'function',
        function: {
            name: "searchInternet",
            description: "搜尋網際網路資料 (Google Search)",
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
            description: "讀取特定網址的內容 (Web Scraper)",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string" }
                },
                required: ["url"]
            }
        }
    },

    // --- 長期記憶與 RAG (Memory) ---
    {
        type: 'function',
        function: {
            name: "storeMemory",
            description: "將重要資訊寫入長期記憶庫 (LTM)",
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
            description: "檢索長期記憶庫 (RAG Query)",
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
// 2. 工具實作映射 (Tool Implementation Map)
// ============================================================

const toolMap = {
    // System
    logInternalChat: async ({ dialogue, topic }) => {
        appLogger.info(`[Internal Chat] Topic: ${topic}\n${dialogue}`);
        return `[System] 內部對話已記錄。`;
    },
    restartSystem: () => Evolution.restartSystem(),

    // Evolution (File Ops)
    listProjectStructure: ({ dir }) => Evolution.listProjectStructure(dir),
    readCodeFile: ({ relativePath }) => Evolution.readCodeFile(relativePath),
    writeCodeFile: ({ relativePath, codeContent }) => Evolution.writeCodeFile(relativePath, codeContent),
    moveFile: ({ sourcePath, destPath }) => Evolution.moveFile(sourcePath, destPath),
    deleteFile: ({ targetPath }) => Evolution.deleteFile(targetPath),
    analyzeProject: ({ targetFile }) => projectScanner.generateReport(targetFile),

    // Network
    searchInternet: ({ query }) => Search.performWebSearch(query),
    readUrl: ({ url }) => Network.fetchWebContent(url),

    // Memory
    storeMemory: ({ content, source, category }) => memoryVortex.memorize(content, { source, category }),
    queryMemory: ({ query }) => memoryVortex.recall(query),
};

// ============================================================
// 3. 執行器 (Executor)
// ============================================================

/**
 * 執行指定的工具函數
 * @param {string} name - 工具名稱
 * @param {Object} args - 參數物件
 * @returns {Promise<string>} 執行結果或錯誤訊息
 */
export const executeTool = async (name, args) => {
    const func = toolMap[name];
    
    if (!func) {
        appLogger.warn(`[ToolRegistry] Attempted to call unknown tool: ${name}`);
        return `[System Error] Tool '${name}' not found.`;
    }

    try {
        appLogger.info(`[ToolRegistry] Executing: ${name}`);
        // appLogger.debug(`[ToolRegistry] Args: ${JSON.stringify(args)}`); // 視需要開啟詳細 Log
        
        const result = await func(args);
        return result;
    } catch (error) {
        appLogger.error(`[ToolRegistry] Execution failed for ${name}:`, error);
        return `[System Error] Error executing ${name}: ${error.message}`;
    }
};
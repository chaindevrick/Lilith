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
// ============================================================

export const toolsDeclarations = [
    // --- 系統與溝通 ---
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

    // --- 檔案與專案操作 (Capabilities) ---
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

    // --- 網路與知識 (Network) ---
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

    // --- 長期記憶 (Memory) ---
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

// ... (後面的 toolMap 和 executeTool 保持不變) ...
// 為了版面簡潔，請保留原本檔案中後半段的 toolMap 與 executeTool 邏輯
const toolMap = {
    logInternalChat: async ({ dialogue, topic }) => { appLogger.info(`[Internal Chat] ${topic}\n${dialogue}`); return `[System] Logged.`; },
    restartSystem: () => Evolution.restartSystem(),
    listProjectStructure: ({ dir }) => Evolution.listProjectStructure(dir),
    readCodeFile: ({ relativePath }) => Evolution.readCodeFile(relativePath),
    writeCodeFile: ({ relativePath, codeContent }) => Evolution.writeCodeFile(relativePath, codeContent),
    moveFile: ({ sourcePath, destPath }) => Evolution.moveFile(sourcePath, destPath),
    deleteFile: ({ targetPath }) => Evolution.deleteFile(targetPath),
    analyzeProject: ({ targetFile }) => projectScanner.generateReport(targetFile),
    searchInternet: ({ query }) => Search.performWebSearch(query),
    readUrl: ({ url }) => Network.fetchWebContent(url),
    storeMemory: ({ content, source, category }) => memoryVortex.memorize(content, { source, category }),
    queryMemory: ({ query }) => memoryVortex.recall(query),
};

export const executeTool = async (name, args) => {
    const func = toolMap[name];
    if (!func) return `[System Error] Tool '${name}' not found.`;
    try { return await func(args); } 
    catch (error) { return `[System Error] ${error.message}`; }
};
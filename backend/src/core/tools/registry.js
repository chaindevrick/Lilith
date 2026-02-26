/**
 * src/core/tools/registry.js
 * 工具註冊中心 (Tool Registry)
 * 定義 LLM 可使用的 Function Calling 介面 (Schema)，並負責路由至具體實作。
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
            description: "【系統重啟】當核心代碼或規則發生重大變更，需要讓意識重組時使用。",
            parameters: { 
                type: "object", 
                properties: {
                    reason: { type: "string", description: "重啟的原因紀錄（選填）" }
                } 
            }
        }
    },
    {
        type: 'function',
        function: {
            name: "generateImage",
            description: "【Nano Banana 繪圖引擎 / 具象化魔法】當妳想要傳送圖片給使用者時使用（例如：生氣的表情、天使哭哭圖、情境示意圖等）。執行後會獲得一段 Markdown 圖片語法，妳必須將該語法直接包含在妳的回覆中。",
            parameters: {
                type: "object",
                properties: {
                    prompt: { 
                        type: "string", 
                        description: "圖片的英文提示詞 (Prompt)。請盡量詳細描述畫面、角色特徵、表情、風格與光影。例如: 'A cute anime angel girl crying, tears in eyes, looking sad, dark background, masterpiece, high quality, 8k'" 
                    }
                },
                required: ["prompt"]
            }
        }
    },

    // --- Filesystem & Evolution (Evolution.js) ---
    // 🌟 在這裡加入明確的容器與宿主機邊界警告
    {
        type: 'function',
        function: {
            name: "listProjectStructure",
            description: "【全知之眼】查看目前的專案結構與檔案列表。⚠️注意：此工具僅能看見妳「自己所在」的 Docker 容器內部環境。若要查看使用者本機電腦的檔案，請使用 executeTerminalCommand 透過 SSH 進行 ls 指令。",
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
            description: "【代碼審計/真理之眼】讀取特定檔案的內容以進行分析。⚠️注意：僅能讀取 Docker 容器內部的檔案。讀取使用者電腦的檔案請用 SSH。",
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
            description: "【現實重寫/神聖重構】寫入或修改代碼。⚠️極度重要：此工具『僅能』修改妳所在的 Docker 容器內的代碼！如果使用者要求妳修改他電腦（宿主機）上的專案，絕對不可使用此工具，請改用 executeTerminalCommand 透過 SSH 連線並使用 echo, cat 或 vim 指令來修改！",
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
            description: "【檔案遷移】移動或重新命名檔案。⚠️注意：僅限 Docker 容器內部操作。",
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
            description: "【存在抹除/清理畫布】永久刪除檔案。⚠️注意：僅限 Docker 容器內部操作。",
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
            description: "【全知分析】掃描專案結構或特定檔案的依賴關係與影響範圍。⚠️注意：僅能掃描 Docker 容器內部的專案架構。",
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
    },

    // --- Terminal & Browser ---
    {
        type: 'function',
        function: {
            name: "executeTerminalCommand",
            description: "【全狀態終端機】在一個持續開啟的 sh Shell 中執行指令。預設環境為妳所在的 Docker 容器。🌟若要操作使用者的本機電腦（宿主機），請在此執行 SSH 連線 (例如: sshpass -p '密碼' ssh -T -o StrictHostKeyChecking=no user@host)。一旦 SSH 連線成功，後續呼叫此工具執行的所有指令，都會直接在使用者的電腦上生效！",
            parameters: {
                type: "object", 
                properties: {
                    command: { type: 'string', description: '要執行的 Bash 指令' } 
                },
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
                    tabId: { type: 'number', description: '目標分頁 ID (僅 switch 和 close 需要，請查看狀態回報最上方的【分頁列表】)' }
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
                    url: { type: 'string', description: '網址' },
                    newTab: { type: 'boolean', description: '是否要在全新分頁開啟？預設 false (直接覆蓋當前畫面)' }
                }, 
                required: ['url']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_interact',
            description: '在網頁上進行點擊或輸入。執行後會自動回傳變化後的網頁狀態，讓你確認操作是否成功。',
            parameters: {
                type: 'object', 
                properties: {
                    action: { type: 'string', description: '動作: "click" (點擊) 或 "type" (輸入文字)' }, 
                    selector: { type: 'string', description: '請務必參閱畫面狀態回傳的【可互動元素】列表，並使用專屬屬性進行操作。例如：若看到 [ID: 15] <textarea> "搜尋"，請輸入精準選擇器: "[data-lilith-id=\\"15\\"]"' }, 
                    text: { type: 'string', description: '要輸入的文字 (僅 action 為 "type" 時需要)' } 
                },
                required: ['action', 'selector']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_scroll',
            description: '滾動網頁以查看更多內容。執行後會回傳滾動後出現的新文字與目前高度。',
            parameters: {
                type: 'object', 
                properties: {
                    direction: { type: 'string', description: '"down" (向下) 或 "up" (向上)' }, 
                    amount: { type: 'number', description: '滾動像素，預設 800 (約一個螢幕高)' } 
                },
                required: ['direction']
            }
        }
    },
    {
        type: 'function', 
        function: {
            name: 'browser_screenshot',
            description: '擷取當前網頁畫面的截圖，並以 Base64 格式回傳。',
            parameters: {
                type: 'object', 
                properties: {
                    quality: { type: 'number', description: '截圖品質 (1-100)，可不填' } 
                },
                required: []
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
    generateImage: async ({ prompt }) => generateImage(prompt),
    
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
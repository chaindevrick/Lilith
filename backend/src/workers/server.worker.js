/**
 * src/workers/server.worker.js
 * API 服務器 (Express Server Worker)
 * 職責：提供 Web Dashboard 所需的後端 API，包括檔案系統操作、設定管理、即時對話以及靜態資源託管。
 */

import { parentPort } from 'worker_threads';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { appLogger } from '../config/logger.js';

import { initializeDatabase } from '../db/sqlite.js';
import { LilithRepository } from '../db/repository.js';

// ============================================================
// 1. 環境配置與初始化
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ENV_PATH = path.resolve(PROJECT_ROOT, '.env');
const SHARE_DIR = path.resolve(PROJECT_ROOT, 'share');
const FRONTEND_DIST = path.resolve(PROJECT_ROOT, 'public'); // 使用 PROJECT_ROOT 確保路徑穩定

const PORT = process.env.PORT || 8080;
const REQUEST_TIMEOUT = 120000; // 2 minutes

// 允許前端讀寫的環境變數白名單
const ALLOWED_KEYS = [
    'GEMINI_API_KEY', 'LTM_GEMINI_API_KEY', 'RELATIONSHIP_GEMINI_API_KEY', 
    'GEMINI_API_BASE_URL',
    'GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'
];

// 初始化資料庫 (Top-level await)
let repo = null;
try {
    const db = await initializeDatabase();
    repo = new LilithRepository(db);
} catch (e) {
    appLogger.error('[Server] DB Init Failed:', e);
}

// 確保共享目錄存在
if (!fs.existsSync(SHARE_DIR)) {
    try { fs.mkdirSync(SHARE_DIR, { recursive: true }); } catch (e) {}
}

// 請求佇列 (用於將 HTTP 轉發給 Main Thread)
const pendingRequests = new Map();

// ============================================================
// 2. Express Middleware 設定
// ============================================================

const app = express();
app.use(cors());

// 增加 Payload 限制以支援大檔案上傳
app.use(express.json({ limit: '1024mb' })); 
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

// ============================================================
// 3. 輔助函數 (Helpers)
// ============================================================

/**
 * 驗證路徑安全性 (防止 Path Traversal)
 * @param {string} targetPath - 相對路徑
 * @returns {string} 解析後的絕對路徑
 * @throws {Error} 若路徑超出專案範圍
 */
const validatePath = (targetPath) => {
    const resolved = path.resolve(PROJECT_ROOT, targetPath);
    if (!resolved.startsWith(PROJECT_ROOT)) {
        throw new Error("Access Denied: Path out of bounds.");
    }
    return resolved;
};

// ============================================================
// 4. API 路由定義
// ============================================================

// --- File System API (IDE 功能) ---

app.get('/api/fs/list', (req, res) => {
    try {
        const relativeDir = req.query.dir || '.';
        const dirPath = validatePath(relativeDir);
        
        if (!fs.existsSync(dirPath)) return res.json([]);

        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        const result = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'folder' : 'file',
            path: path.relative(PROJECT_ROOT, path.join(dirPath, item.name))
        }));
        
        // 排序：資料夾優先
        result.sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1));
        
        res.json(result);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
});

app.get('/api/fs/read', (req, res) => {
    try {
        const filePath = validatePath(req.query.path);
        
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
        if (fs.statSync(filePath).isDirectory()) return res.status(400).json({ error: "Cannot read directory" });
        
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
});

app.post('/api/fs/write', (req, res) => {
    try {
        const { path: relativePath, content, encoding = 'utf-8' } = req.body;
        const filePath = validatePath(relativePath);
        const dir = path.dirname(filePath);
        
        // 確保目錄存在
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (encoding === 'base64') {
            fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
        } else {
            fs.writeFileSync(filePath, content, 'utf-8');
        }
        
        appLogger.info(`[IDE] File saved: ${relativePath} (${encoding})`);
        res.json({ success: true });
    } catch (e) {
        appLogger.error(`[API] FS Write Failed: ${e.message}`);
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/fs/extract', (req, res) => {
    try {
        const { path: targetDir, content } = req.body; 
        const absDir = validatePath(targetDir);
        
        if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

        const tempZipPath = path.join(absDir, `temp_${Date.now()}.zip`);
        fs.writeFileSync(tempZipPath, Buffer.from(content, 'base64'));

        const zip = new AdmZip(tempZipPath);
        zip.extractAllTo(absDir, true); 
        fs.unlinkSync(tempZipPath);

        appLogger.info(`[IDE] Extracted zip to: ${targetDir}`);
        res.json({ success: true, message: "Extraction complete" });
    } catch (e) {
        appLogger.error(`[API] Extract Failed: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/fs/delete', (req, res) => {
    try {
        const { path: relativePath } = req.body;
        const filePath = validatePath(relativePath);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(filePath);
        }

        appLogger.info(`[IDE] Deleted: ${relativePath}`);
        res.json({ success: true });
    } catch (e) {
        appLogger.error(`[API] Delete Failed: ${e.message}`);
        res.status(400).json({ error: e.message });
    }
});

// --- Settings API (環境變數管理) ---

app.get('/api/settings', (req, res) => {
    try {
        if (!fs.existsSync(ENV_PATH)) return res.json({});
        
        const content = fs.readFileSync(ENV_PATH, 'utf-8');
        const config = {};
        
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([^=#]+?)\s*=\s*(.*)?$/); 
            if (match && ALLOWED_KEYS.includes(match[1].trim())) {
                let val = match[2] ? match[2].trim() : '';
                // 去除引號
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                config[match[1].trim()] = val;
            }
        });
        res.json(config);
    } catch (e) { 
        res.status(500).json({ error: 'Failed to read settings' }); 
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const newConfig = req.body;
        let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
        const lines = content.split('\n');
        const updatedKeys = new Set();
        
        // 更新現有 Key
        const newLines = lines.map(line => {
            const match = line.match(/^\s*([^=#]+?)\s*=/);
            if (match && ALLOWED_KEYS.includes(match[1].trim()) && newConfig[match[1].trim()] !== undefined) {
                updatedKeys.add(match[1].trim());
                return `${match[1].trim()}=${newConfig[match[1].trim()]}`;
            }
            return line;
        });
        
        // 新增不存在的 Key
        ALLOWED_KEYS.forEach(k => {
            if (newConfig[k] !== undefined && !updatedKeys.has(k)) {
                newLines.push(`${k}=${newConfig[k]}`);
            }
        });
        
        fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf-8');
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
});

// --- Chat API (對話與歷史) ---

app.get('/api/history', async (req, res) => {
    try {
        const { conversationId } = req.query;
        if (!conversationId) return res.status(400).json({ error: "Missing conversationId" });
        if (!repo) return res.status(503).json({ error: "Database not initialized" });

        const history = await repo.getHistory(conversationId);
        res.json({ history });
    } catch (e) {
        appLogger.error('[API] Get History Error:', e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/history/reset', async (req, res) => {
    try {
        const { conversationId } = req.body;
        if (!conversationId) return res.status(400).json({ error: "Missing conversationId" });
        if (!repo) return res.status(503).json({ error: "Database not initialized" });

        appLogger.warn(`[API] Resetting history for: ${conversationId}`);
        await repo.saveHistory(conversationId, []);
        
        res.json({ success: true, message: "History cleared." });
    } catch (e) {
        appLogger.error('[API] Reset History Error:', e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message, attachments = [], conversationId = 'web_user', mode = 'demon' } = req.body;
    
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 設定超時機制
    const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
            const entry = pendingRequests.get(requestId);
            if (entry && !entry.res.headersSent) {
                entry.res.status(504).json({ messages: ["[逾時] 系統回應過久，請稍後再試。"] });
            }
            pendingRequests.delete(requestId);
        }
    }, REQUEST_TIMEOUT);

    pendingRequests.set(requestId, { res, timeoutId });

    // 轉發給 Main Process -> Brain Worker
    parentPort.postMessage({ 
        type: 'WEB_CHAT_REQUEST', 
        requestId, 
        payload: { conversationId, content: message, attachments, mode } 
    });
});

// --- System API ---

app.post('/api/system/restart', (req, res) => {
    appLogger.warn('[API] 收到前端重啟請求 (CMD_RESTART_BRAIN)...');
    parentPort.postMessage({ type: 'CMD_RESTART_BRAIN' });
    res.json({ success: true, message: "System restart signal sent." });
});

// ============================================================
// 5. 訊息路由 (Message Handler)
// ============================================================

parentPort.on('message', (msg) => {
    // 處理來自 Brain 的對話回應
    if (msg.type === 'WEB_CHAT_RESPONSE') {
        const { requestId, response } = msg;
        const entry = pendingRequests.get(requestId);
        
        if (entry) {
            clearTimeout(entry.timeoutId);
            if (!entry.res.headersSent) {
                entry.res.json(response);
            }
            pendingRequests.delete(requestId);
        }
    }
});

// ============================================================
// 6. 前端靜態檔案託管
// ============================================================

if (fs.existsSync(FRONTEND_DIST)) {
    appLogger.info(`📦 [Server] Serving Frontend from: ${FRONTEND_DIST}`);
    app.use(express.static(FRONTEND_DIST));

    // SPA Fallback: 所有非 API 請求都導向 index.html
    app.get(/.*/, (req, res) => {
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API Endpoint Not Found' });
        }
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
} else {
    appLogger.warn(`⚠️ [Server] Frontend build not found at: ${FRONTEND_DIST}`);
    appLogger.warn(`   請執行 'cd frontend && npm run build' 來生成靜態檔案。`);
}

// ============================================================
// 7. 啟動伺服器
// ============================================================

app.listen(PORT, () => {
    appLogger.info(`🌐 [Server] API & Frontend running on http://localhost:${PORT}`);
});
/**
 * src/workers/server.worker.js
 * API 服務器 (Express Server)
 */

import { parentPort } from 'worker_threads';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { appLogger } from '../config/logger.js';

import { LilithRepository } from '../db/repository.js';
const repo = new LilithRepository();

// ============================================================
// 環境與常數配置
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const ENV_PATH = path.resolve(PROJECT_ROOT, '.env');
const SHARE_DIR = path.resolve(PROJECT_ROOT, 'share');
const FRONTEND_DIST = path.join(process.cwd(), 'public');
const PORT = process.env.PORT || 8080;
const REQUEST_TIMEOUT = 120000; 

const ALLOWED_KEYS = [
    'GEMINI_API_KEY', 'LTM_GEMINI_API_KEY', 'RELATIONSHIP_GEMINI_API_KEY', 
    'GEMINI_API_BASE_URL',
    'DISCORD_OWNER_ID', 'DISCORD_TOKEN',
    'GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'
];

const app = express();
app.use(cors());

// 大檔案上傳限制
app.use(express.json({ limit: '1024mb' })); 
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

// 確保 share 資料夾存在
if (!fs.existsSync(SHARE_DIR)) {
    try { fs.mkdirSync(SHARE_DIR, { recursive: true }); } catch (e) {}
}

const pendingRequests = new Map();

// ==========================================
// 輔助函數
// ==========================================

const validatePath = (targetPath) => {
    const resolved = path.resolve(PROJECT_ROOT, targetPath);
    if (!resolved.startsWith(PROJECT_ROOT)) {
        throw new Error("Access Denied: Path out of bounds.");
    }
    return resolved;
};

// ==========================================
// API 路由定義
// ==========================================

// --- FS API ---
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
        result.sort((a, b) => (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1));
        res.json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/fs/read', (req, res) => {
    try {
        const filePath = validatePath(req.query.path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
        if (fs.statSync(filePath).isDirectory()) return res.status(400).json({ error: "Cannot read directory" });
        const content = fs.readFileSync(filePath, 'utf-8');
        res.json({ content });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/fs/write', (req, res) => {
    try {
        const { path: relativePath, content, encoding = 'utf-8' } = req.body;
        const filePath = validatePath(relativePath);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (encoding === 'base64') {
            const buffer = Buffer.from(content, 'base64');
            fs.writeFileSync(filePath, buffer);
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
        const buffer = Buffer.from(content, 'base64');
        fs.writeFileSync(tempZipPath, buffer);

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

// --- Settings API ---
app.get('/api/settings', (req, res) => {
    try {
        if (!fs.existsSync(ENV_PATH)) return res.json({});
        const content = fs.readFileSync(ENV_PATH, 'utf-8');
        const config = {};
        content.split('\n').forEach(line => {
            const match = line.match(/^\s*([^=#]+?)\s*=\s*(.*)?$/); 
            if (match && ALLOWED_KEYS.includes(match[1].trim())) {
                let val = match[2] ? match[2].trim() : '';
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
                config[match[1].trim()] = val;
            }
        });
        res.json(config);
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/settings', (req, res) => {
    try {
        const newConfig = req.body;
        let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
        const lines = content.split('\n');
        const updatedKeys = new Set();
        const newLines = lines.map(line => {
            const match = line.match(/^\s*([^=#]+?)\s*=/);
            if (match && ALLOWED_KEYS.includes(match[1].trim()) && newConfig[match[1].trim()] !== undefined) {
                updatedKeys.add(match[1].trim());
                return `${match[1].trim()}=${newConfig[match[1].trim()]}`;
            }
            return line;
        });
        ALLOWED_KEYS.forEach(k => {
            if (newConfig[k] !== undefined && !updatedKeys.has(k)) newLines.push(`${k}=${newConfig[k]}`);
        });
        fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf-8');
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Chat API ---

app.get('/api/history', async (req, res) => {
    try {
        const { conversationId } = req.query;
        if (!conversationId) {
            return res.status(400).json({ error: "Missing conversationId" });
        }

        const history = await repo.getHistory(conversationId);
        
        res.json({ history });
    } catch (e) {
        appLogger.error('[API] Get History Error:', e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message, attachments = [], conversationId = 'web_user', mode = 'demon' } = req.body;
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timeoutId = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
            const entry = pendingRequests.get(requestId);
            if (entry && !entry.res.headersSent) entry.res.status(504).json({ messages: ["[逾時]"] });
            pendingRequests.delete(requestId);
        }
    }, REQUEST_TIMEOUT);
    pendingRequests.set(requestId, { res, timeoutId });
    parentPort.postMessage({ type: 'WEB_CHAT_REQUEST', requestId, payload: { conversationId, content: message, attachments, mode } });
});

parentPort.on('message', (msg) => {
    if (msg.type === 'WEB_CHAT_RESPONSE') {
        const { requestId, response } = msg;
        const entry = pendingRequests.get(requestId);
        if (entry) {
            clearTimeout(entry.timeoutId);
            if (!entry.res.headersSent) entry.res.json(response);
            pendingRequests.delete(requestId);
        }
    }
});

// ============================================================
// 系統控制 API (Restart)
// ============================================================
app.post('/api/system/restart', (req, res) => {
    appLogger.warn('[API] 收到前端重啟請求 (Apply Changes)...');
    
    // 通知 Main Process 重啟 Brain
    parentPort.postMessage({ type: 'CMD_RESTART_BRAIN' });
    
    res.json({ success: true, message: "System restart signal sent." });
});

// ============================================================
// 前端靜態檔案託管 (Static Serving)
// ============================================================

if (fs.existsSync(FRONTEND_DIST)) {
    appLogger.info(`📦 [Server] Serving Frontend from: ${FRONTEND_DIST}`);
    app.use(express.static(FRONTEND_DIST));

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

// ==========================================
// 啟動伺服器
// ==========================================
app.listen(PORT, () => {
    appLogger.info(`🌐 [Server] API & Frontend running on http://localhost:${PORT}`);
});
import { parentPort } from 'worker_threads';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import os from 'os';

import { appLogger } from '../core/services/logger.js';
import { initializeDatabase } from '../db/sqlite.js';
import { LilithRepository } from '../db/repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

const CONFIG_DIR = path.resolve(PROJECT_ROOT, 'src/configs');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const SHARE_DIR = path.resolve(PROJECT_ROOT, 'share');
const FRONTEND_DIST = path.resolve(PROJECT_ROOT, 'public'); 

const PORT = process.env.PORT || 8080;
const REQUEST_TIMEOUT = 600000;

let repo = null;
try {
    const db = await initializeDatabase();
    repo = new LilithRepository(db);
} catch (e) {
    appLogger.error('[Server] DB Init Failed:', e);
}

if (!fs.existsSync(SHARE_DIR)) fs.mkdirSync(SHARE_DIR, { recursive: true });

const pendingRequests = new Map();
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' })); 
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const validatePath = (targetPath) => {
    const resolved = path.resolve(PROJECT_ROOT, targetPath);
    if (!resolved.startsWith(PROJECT_ROOT)) throw new Error("Access Denied: Path out of bounds.");
    return resolved;
};

// ==========================================================
// 檔案系統 (File System) API
// ==========================================================
app.get('/api/fs/list', (req, res) => {
    try {
        const dirPath = validatePath(req.query.dir || '.');
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
        res.json({ content: fs.readFileSync(filePath, 'utf-8') });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/fs/write', (req, res) => {
    try {
        const { path: relativePath, content, encoding = 'utf-8' } = req.body;
        const filePath = validatePath(relativePath);
        const dir = path.dirname(filePath);
        
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        if (encoding === 'base64') fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
        else fs.writeFileSync(filePath, content, 'utf-8');
        
        appLogger.info(`[IDE] File saved: ${relativePath}`);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/fs/extract', (req, res) => {
    try {
        const { path: targetDir, content } = req.body; 
        const absDir = validatePath(targetDir);
        if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

        const tempZipPath = path.join(absDir, `temp_${Date.now()}.zip`);
        fs.writeFileSync(tempZipPath, Buffer.from(content, 'base64'));
        new AdmZip(tempZipPath).extractAllTo(absDir, true); 
        fs.unlinkSync(tempZipPath);

        appLogger.info(`[IDE] Extracted zip to: ${targetDir}`);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/fs/delete', (req, res) => {
    try {
        const filePath = validatePath(req.body.path);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

        if (fs.statSync(filePath).isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
        else fs.unlinkSync(filePath);

        appLogger.info(`[IDE] Deleted: ${req.body.path}`);
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// ==========================================================
// 設定檔 (Settings) API
// ==========================================================
app.get('/api/settings', (req, res) => {
    try {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

        let config = {};
        if (fs.existsSync(CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }

        const getFile = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
        const relationshipRulesPath = path.join(CONFIG_DIR, 'relationshipRules.json');

        res.json({
            ...config,
            characterCard: getFile(path.join(CONFIG_DIR, 'characterCard.md')),
            relationshipRules: fs.existsSync(relationshipRulesPath) ? JSON.parse(fs.readFileSync(relationshipRulesPath, 'utf-8')) : null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const body = req.body;
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

        let existingConfig = {};
        if (fs.existsSync(CONFIG_PATH)) {
            existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }

        const selectedModel = body.llmModel || existingConfig.llmModel || '';
        let autoApiBaseUrl = body.LLM_API_BASE_URL || existingConfig.LLM_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
        
        if (selectedModel.startsWith('gpt')) {
            autoApiBaseUrl = 'https://api.openai.com/v1/';
        } else if (selectedModel.startsWith('claude')) {
            autoApiBaseUrl = 'https://api.anthropic.com/v1/';
        } else if (selectedModel === 'lm-studio') {
            autoApiBaseUrl = 'http://localhost:1234/v1/';
        }

        const selectedVectorModel = body.vectorModel || existingConfig.vectorModel || 'gemini-embedding-2-preview';
        let vectorApiBaseUrl = body.LTM_LLM_API_BASE_URL || existingConfig.LTM_LLM_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
        
        if (selectedVectorModel.startsWith('text-embedding')) {
            vectorApiBaseUrl = 'https://api.openai.com/v1/';
        } else if (selectedVectorModel === 'lm-studio') {
            vectorApiBaseUrl = 'http://localhost:1234/v1/';
        } else {
            vectorApiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; 
        }

        const newConfig = {
            ...existingConfig, 
            llmModel: selectedModel,
            fastModel: body.fastModel || existingConfig.fastModel || '',
            vectorModel: body.vectorModel || existingConfig.vectorModel,
            LLM_API_KEY: body.LLM_API_KEY || existingConfig.LLM_API_KEY || '',
            FAST_LLM_API_KEY: body.FAST_LLM_API_KEY || existingConfig.FAST_LLM_API_KEY || '',
            LTM_LLM_API_KEY: body.LTM_LLM_API_KEY || existingConfig.LTM_LLM_API_KEY || '',
            LLM_API_BASE_URL: autoApiBaseUrl,
            LTM_LLM_API_BASE_URL: vectorApiBaseUrl,
            interactionRules: body.interactionRules || existingConfig.interactionRules || '',
            conversationStyle: body.conversationStyle || existingConfig.conversationStyle || '',
            multiAgentEnabled: body.multiAgentEnabled !== undefined ? body.multiAgentEnabled : (existingConfig.multiAgentEnabled !== undefined ? existingConfig.multiAgentEnabled : true),
            skills: body.skills || existingConfig.skills || { allowBundled: [], entries: {} },
            bots: body.bots || existingConfig.bots || []
        };

        if (Array.isArray(body.bots)) {
            body.bots.forEach(b => {
                const tokenToSave = b.enabled ? b.apiKey : '';
                if (b.id === 'discord' || b.platform === 'discord') newConfig.DISCORD_BOT_TOKEN = tokenToSave;
                if (b.id === 'telegram' || b.platform === 'telegram') newConfig.TELEGRAM_BOT_TOKEN = tokenToSave;
                if (b.id === 'whatsapp' || b.platform === 'whatsapp') newConfig.WHATSAPP_BOT_TOKEN = tokenToSave;
                if (b.id === 'line' || b.platform === 'line') newConfig.LINE_BOT_TOKEN = tokenToSave;
            });
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
        
        if (body.characterCard !== undefined) {
            fs.writeFileSync(path.join(CONFIG_DIR, 'characterCard.md'), body.characterCard, 'utf-8');
        }
        
        if (body.relationshipRules) {
            fs.writeFileSync(path.join(CONFIG_DIR, 'relationshipRules.json'), JSON.stringify(body.relationshipRules, null, 2), 'utf-8');
        }

        res.status(200).json({ success: true, message: 'Settings saved successfully.' });

        setTimeout(() => {
            parentPort.postMessage({ type: 'CMD_RESTART_BRAIN' });
        }, 1500);

    } catch (error) {
        appLogger.error('[System API] Settings update failed:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================================
// 技能 (Skills) API
// ==========================================================
app.get('/api/skills/available', (req, res) => {
    try {
        const skillsDir = path.resolve(PROJECT_ROOT, 'skills');
        if (!fs.existsSync(skillsDir)) return res.json([]);

        const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
                       .filter(dirent => dirent.isDirectory())
                       .map(dirent => dirent.name);

        const availableSkills = [];
        
        for (const dirName of dirs) {
            const manifestPath = path.join(skillsDir, dirName, 'manifest.json');
            const skillMdPath = path.join(skillsDir, dirName, 'SKILL.md');
            
            let name = dirName;
            let description = '無說明 (未提供 description)。';
            let isSystem = false;

            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    if (manifest.name) name = manifest.name;
                    if (manifest.description) description = manifest.description;
                    if (manifest.system === true) isSystem = true;
                } catch(e){}
            }

            if (fs.existsSync(skillMdPath)) {
                const mdContent = fs.readFileSync(skillMdPath, 'utf-8');
                const nameMatch = mdContent.match(/^name:\s*(.+)$/im);
                const descMatch = mdContent.match(/^description:\s*(.+)$/im);
                const sysMatch = mdContent.match(/^system:\s*(true|false)$/im);
                
                if (nameMatch) name = nameMatch[1].trim();
                if (descMatch) description = descMatch[1].trim();
                if (sysMatch && sysMatch[1].trim().toLowerCase() === 'true') isSystem = true;
            }

            availableSkills.push({ id: dirName, name, desc: description, isSystem });
        }
        res.json(availableSkills);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================================
// 聊天 (Chat) & 系統控制 API
// ==========================================================
app.get('/api/history', async (req, res) => {
    try {
        const { conversationId } = req.query;
        if (!conversationId || !repo) return res.status(400).json({ error: "Missing DB or ID" });
        
        const history = await repo.getHistory(conversationId);
        const totalTokens = await repo.getTotalTokens(conversationId);
        const relationship = await repo.getRelationship(conversationId) || {};

        res.json({ history, totalTokens, relationship });
    } catch (e) { 
        appLogger.error('[API] Get History Failed:', e);
        res.status(500).json({ error: "Internal Error" }); 
    }
});

app.post('/api/history/reset', async (req, res) => {
    try {
        const { conversationId } = req.body;
        if (!conversationId || !repo) return res.status(400).json({ error: "Missing DB or ID" });
        
        await repo.saveHistory(conversationId, []);
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ error: "Internal Error" }); 
    }
});

app.post('/api/chat', async (req, res) => {
    req.setTimeout(0);
    const { message, attachments = [], conversationId = 'web_user', userName = 'User' } = req.body;
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const setupTimeout = () => setTimeout(() => {
        if (pendingRequests.has(requestId)) {
            const entry = pendingRequests.get(requestId);
            if (entry && !entry.res.headersSent) entry.res.status(504).json({ messages: ["[System] Execution timeout."] });
            pendingRequests.delete(requestId);
        }
    }, REQUEST_TIMEOUT);

    pendingRequests.set(requestId, { res, timeoutId: setupTimeout(), conversationId });

    parentPort.postMessage({ 
        type: 'WEB_CHAT_REQUEST', 
        requestId, 
        payload: { conversationId, userName, content: message, attachments } 
    });
});

app.post('/api/system/restart', (req, res) => {
    parentPort.postMessage({ type: 'CMD_RESTART_BRAIN' });
    res.json({ success: true, message: "Restart signal sent." });
});

parentPort.on('message', async (msg) => {
    if (msg.type === 'WEB_CHAT_RESPONSE' || msg.type === 'WEB_CHAT_HEARTBEAT') {
        const { requestId, response } = msg;
        const entry = pendingRequests.get(requestId);
        if (entry) {
            clearTimeout(entry.timeoutId);
            if (msg.type === 'WEB_CHAT_RESPONSE') {
                try {
                    if (repo && entry.conversationId) {
                        const latestTokens = await repo.getTotalTokens(entry.conversationId);
                        response.totalTokens = latestTokens;
                    }
                } catch (e) {
                    appLogger.warn('[Server] Failed to fetch total tokens before response:', e);
                }
                if (!entry.res.headersSent) entry.res.json(response);
                pendingRequests.delete(requestId);
            } else {
                entry.timeoutId = setTimeout(() => {
                    if (pendingRequests.has(requestId) && !entry.res.headersSent) {
                        entry.res.status(504).json({ messages: ["[System] Execution timeout."] });
                        pendingRequests.delete(requestId);
                    }
                }, REQUEST_TIMEOUT);
            }
        }
    }
});

// 前端靜態檔案處理
if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
    app.get(/.*/, (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Endpoint Not Found' });
        res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    });
}

// ==========================================================
// 🌟 啟動 HTTP 伺服器並掛載 WebSocket (Terminal)
// ==========================================================

// 1. 取得 Server 實例
const server = app.listen(PORT, () => {
    appLogger.info(`🌐 [Server] API & Frontend running on http://localhost:${PORT}`);
});

// 2. 建立 WebSocket 伺服器並掛載到同一個 server 上，專門處理 terminal 路由
const wss = new WebSocketServer({ server, path: '/api/terminal' });

wss.on('connection', (ws) => {
    appLogger.info('[Terminal] New WebSocket connection established.');

    // 判斷作業系統選擇 shell
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash'; 
    
    // 啟動虛擬終端 (node-pty)
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: PROJECT_ROOT, // 🌟 直接將工作目錄設為莉莉絲的專案根目錄
        env: process.env
    });

    // 當 PTY 有輸出資料時，傳送給前端的 xterm.js
    ptyProcess.onData((data) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data);
        }
    });

    // 當前端 xterm.js 有輸入時，寫入到 PTY
    ws.on('message', (msg) => {
        ptyProcess.write(msg.toString());
    });

    // 斷線處理：殺掉虛擬程序
    ws.on('close', () => {
        appLogger.info('[Terminal] WebSocket disconnected, killing pty process.');
        ptyProcess.kill();
    });
});
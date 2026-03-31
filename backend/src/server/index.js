import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from '../agents/core/services/logger.js';
import { initializeDatabase } from '../db/sqlite.js';
import { LilithRepository } from '../db/repository.js';
import { setupTerminal } from './terminal.js';
import { setupAppRoutes } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const SHARE_DIR = path.resolve(PROJECT_ROOT, 'share');
const FRONTEND_DIST = path.resolve(PROJECT_ROOT, 'public'); 

const PORT = 8080;
const REQUEST_TIMEOUT = 600000;

export const startServer = async (dispatchToBrain) => {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '100mb' })); 
    app.use(express.urlencoded({ limit: '100mb', extended: true }));

    let repo = null;
    try {
        const db = await initializeDatabase();
        repo = new LilithRepository(db);
    } catch (e) {
        appLogger.error('[Server] DB Init Failed:', e);
    }

    if (!fs.existsSync(SHARE_DIR)) fs.mkdirSync(SHARE_DIR, { recursive: true });

    const pendingRequests = new Map();

    // 建立 Context 供 Controller 與 Router 使用
    const context = { repo, dispatchToBrain, pendingRequests, REQUEST_TIMEOUT };

    // 掛載所有 API 路由
    setupAppRoutes(app, context);

    // 前端靜態檔案處理
    if (fs.existsSync(FRONTEND_DIST)) {
        app.use(express.static(FRONTEND_DIST));
        app.get(/.*/, (req, res) => {
            if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API Endpoint Not Found' });
            res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
        });
    }

    const server = app.listen(PORT, () => {
        appLogger.info(`🌐 [Server] API & Frontend running on http://localhost:${PORT}`);
    });

    setupTerminal(server);

    return {
        resolveChatResponse: async (msg) => {
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
                } else if (msg.type === 'WEB_CHAT_HEARTBEAT') {
                    entry.timeoutId = setTimeout(() => {
                        if (pendingRequests.has(requestId) && !entry.res.headersSent) {
                            entry.res.status(504).json({ messages: ["[System] Execution timeout."] });
                            pendingRequests.delete(requestId);
                        }
                    }, REQUEST_TIMEOUT);
                }
            }
        }
    };
};
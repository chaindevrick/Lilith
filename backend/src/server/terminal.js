import { WebSocketServer } from 'ws';
import pty from 'node-pty';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from '../agents/core/services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

export const setupTerminal = (server) => {
    const wss = new WebSocketServer({ server, path: '/api/terminal' });

    wss.on('connection', (ws) => {
        appLogger.info('[Terminal] New WebSocket connection established.');

        const shell = os.platform() === 'win32' ? 'powershell.exe' : ('bash'); 
        
        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: PROJECT_ROOT, 
            env: process.env
        });

        ptyProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
                ws.send(data);
            }
        });

        ws.on('message', (msg) => {
            ptyProcess.write(msg.toString());
        });

        ws.on('close', () => {
            appLogger.info('[Terminal] WebSocket disconnected, killing pty process.');
            ptyProcess.kill();
        });
    });
};
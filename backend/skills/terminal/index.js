import { spawn } from 'child_process';
import { appLogger } from '../../src/core/services/logger.js';

let bashProcess = null;
let outputBuffer = "";
let isExecuting = false;
let currentResolve = null;
let executionTimeout = null;
const MAGIC_MARKER = '[__LILITH_CMD_DONE__]';

const initBash = () => {
    if (bashProcess) return;
    appLogger.info('[Terminal] Starting persistent bash session...');
    bashProcess = spawn('sh', []); 

    bashProcess.stdout.on('data', (data) => { outputBuffer += data.toString(); checkCompletion(); });
    bashProcess.stderr.on('data', (data) => { outputBuffer += data.toString(); checkCompletion(); });

    bashProcess.on('close', (code) => {
        appLogger.warn(`[Terminal] Bash process exited with code ${code}`);
        bashProcess = null;
        isExecuting = false;
        if (currentResolve) { currentResolve(`[終端機已關閉] 退出代碼: ${code}`); currentResolve = null; }
    });
};

const checkCompletion = () => {
    if (outputBuffer.includes(MAGIC_MARKER) && currentResolve) {
        if (executionTimeout) clearTimeout(executionTimeout);
        const cleanOutput = outputBuffer.split(MAGIC_MARKER)[0].trim();
        const displayOutput = cleanOutput || '(執行成功，無輸出)';
        appLogger.info(`[Terminal Output] \n${displayOutput}\n----------------------------------------`);
        currentResolve(`[執行結果]:\n${displayOutput}`);
        currentResolve = null;
    }
};

export default {
    // 🌟 接收注入的 config
    run: async ({ command }, config) => {
        if (!bashProcess) { initBash(); await new Promise(r => setTimeout(r, 500)); }
        if (isExecuting) return "[系統警告] 終端機正忙碌中。請等待或讓系統自動逾時。";

        isExecuting = true;
        outputBuffer = "";
        appLogger.info(`[Terminal] Executing: ${command}`);

        return new Promise((resolve) => {
            currentResolve = (result) => {
                isExecuting = false;
                resolve(result.length > 1500 ? result.slice(0, 1500) + '\n...[截斷]...' : result);
            };

            executionTimeout = setTimeout(() => {
                isExecuting = false;
                if (bashProcess) bashProcess.stdin.write('\x03\n'); 
                if (currentResolve) { currentResolve(`[執行逾時] 目前已輸出:\n${outputBuffer.trim()}`); currentResolve = null; }
            }, 30000);

            bashProcess.stdin.write(`${command}\necho "${MAGIC_MARKER}"\n`);
        });
    }
};
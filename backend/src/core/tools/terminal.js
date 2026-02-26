/**
 * src/core/tools/terminal.js
 * 持久化終端機 (Persistent Terminal)
 * 提供一個真實且狀態保留的 Bash Shell 給 AI。支援 ssh 連線、cd 目錄切換等。
 */

import { spawn } from 'child_process';
import { appLogger } from '../../config/logger.js';

let bashProcess = null;
let outputBuffer = "";
let isExecuting = false;
let currentResolve = null;
let executionTimeout = null;

// 結束標記，用來判斷指令是否執行完畢
const MAGIC_MARKER = '[__LILITH_CMD_DONE__]';

const initBash = () => {
    if (bashProcess) return;
    
    appLogger.info('[Terminal] Starting persistent bash session...');
    // 啟動一個持續運行的 bash 進程
    bashProcess = spawn('sh', []); 

    // 監聽輸出
    bashProcess.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        checkCompletion();
    });

    // 監聽錯誤
    bashProcess.stderr.on('data', (data) => {
        outputBuffer += data.toString();
        checkCompletion();
    });

    bashProcess.on('close', (code) => {
        appLogger.warn(`[Terminal] Bash process exited with code ${code}`);
        bashProcess = null;
        isExecuting = false;
        if (currentResolve) {
            currentResolve(`[終端機已關閉] 退出代碼: ${code}`);
            currentResolve = null;
        }
    });
};

const checkCompletion = () => {
    // 當收到我們埋設的結束標記時，代表指令執行完畢
    if (currentResolve && outputBuffer.includes(MAGIC_MARKER)) {
        clearTimeout(executionTimeout);
        // 拔除標記，清理多餘空白
        const cleanOutput = outputBuffer.split(MAGIC_MARKER)[0].trim();

        const displayOutput = cleanOutput || '(執行成功，無輸出)';
        appLogger.info(`[Terminal Output] \n${displayOutput}\n----------------------------------------`);

        currentResolve(`[執行結果]:\n${displayOutput}`);
        currentResolve = null;
    }
};

export const executeTerminal = async ({ command }) => {
    if (!bashProcess) {
        initBash();
        await new Promise(r => setTimeout(r, 500)); // 給 Bash 一點啟動時間
    }

    if (isExecuting) {
        return "[系統警告] 終端機正忙碌中（上一個指令尚未完成）。請等待或讓系統自動逾時。";
    }

    isExecuting = true;
    outputBuffer = "";

    appLogger.info(`[Terminal] Executing: ${command}`);

    return new Promise((resolve) => {
        currentResolve = (result) => {
            isExecuting = false;
            if (result.length > 1500) {
                resolve(result.slice(0, 1500) + '\n...[終端機輸出過長，已截斷]...');
            } else {
                resolve(result);
            }
        };

        // 30 秒防卡死機制
        executionTimeout = setTimeout(() => {
            isExecuting = false;
            if (bashProcess) {
                // 嘗試發送 Ctrl+C (\x03) 來中斷卡死的程式 (如 ping, top)
                bashProcess.stdin.write('\x03\n'); 
            }
            resolve(`[超時警告]: 指令執行超過 30 秒尚未結束，已發送中斷訊號。\n目前輸出:\n${outputBuffer.slice(0, 3000)}`);
        }, 30000);

        // 將指令與結束標記寫入 stdin。使用換行確保指令被執行
        bashProcess.stdin.write(`${command}\necho '${MAGIC_MARKER}'\n`);
    });
};
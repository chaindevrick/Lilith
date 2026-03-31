import { parentPort } from 'worker_threads';
import { appLogger } from '../../src/agents/core/services/logger.js';

const restartSystem = () => {
    appLogger.info('[System Skill] System is restarting...');
    if (parentPort) {
        parentPort.postMessage({ type: 'RESTART_BRAIN' });
        return `[System] 已發送重啟訊號，系統即將重新啟動。`;
    } else {
        appLogger.warn('[System Skill] 找不到 parentPort，無法發送重啟訊號。');
        return `[Error] 執行環境不支援直接重啟。`;
    }
};

export default {
    run: async (args, config, entryConfig) => {
        const { action, command, dialogue, topic } = args;
        
        const cmd = action || command;

        appLogger.info('[System Skill] Received command:', cmd);

        // 1. 執行內部對話日誌記錄
        if (cmd === 'log_chat' || dialogue) {
            appLogger.info(`[Internal Chat] ${topic || '未分類'}\n${dialogue}`);
            return `[System] 內部對話紀錄已儲存。`;
        }

        // 2. 執行系統重啟
        if (cmd === 'restart') {
            return restartSystem();
        }

        return `[Error] System 工具收到未知的指令: ${cmd}`;
    }
};
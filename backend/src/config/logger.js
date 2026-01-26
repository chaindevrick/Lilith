/**
 * src/config/logger.js
 * 系統日誌核心配置 (Winston)
 * 負責處理系統運作記錄、錯誤捕捉、以及日誌檔案的自動輪替與格式化。
 */

import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// 1. 環境路徑配置
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 日誌存放目錄：專案根目錄/logs
const logDirectory = path.resolve(__dirname, '../../logs');

const { combine, timestamp, printf, colorize, label, errors, splat } = winston.format;

// ============================================================
// 2. 自定義格式化邏輯
// ============================================================

/**
 * 自定義輸出排版
 * 處理 Log 的截斷、物件序列化以及 Metadata 的顯示
 */
const customPrintFormat = printf((info) => {
    const { level, message, timestamp, label, stack, conversationId } = info;
    
    // 標籤前綴 (例如 [SYSTEM])
    const prefix = label ? `[${label}]` : '';
    let logMessage = message;

    // [Safety] 訊息過長時進行截斷 (避免 Log 檔案爆炸)
    if (typeof logMessage === 'string' && logMessage.length > 2000) {
        logMessage = logMessage.substring(0, 2000) + '...(Log截斷)';
    } 
    // [Safety] 物件安全序列化 (防止 [object Object])
    else if (typeof logMessage === 'object') {
        try {
            logMessage = JSON.stringify(logMessage);
        } catch (e) {
            logMessage = '[Circular/Unserializable Object]';
        }
    }

    // 組裝基礎訊息
    let output = `[${timestamp}] ${prefix} [${level.toUpperCase()}] `;

    // [Metadata] 支援顯示對話 ID (方便追蹤特定用戶)
    if (conversationId) {
        output += `[ConvID: ${conversationId}] `;
    }

    output += logMessage;

    // [Stack Trace] 如果有錯誤堆疊，附加在最後
    if (stack) {
        output += `\nStack Trace: ${stack}`;
    }

    return output;
});

// 基礎格式組合 (共用)
const baseFormat = combine(
    label({ label: 'SYSTEM' }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // 自動捕捉 Error 物件的 stack
    splat()                  // 支援字串插值
);

// 檔案輸出格式 (純文字)
const fileFormat = combine(baseFormat, customPrintFormat);

// 終端機輸出格式 (帶顏色)
const consoleFormat = combine(
    colorize({ all: false }), // 僅 Level 上色
    baseFormat, 
    customPrintFormat
);

// ============================================================
// 3. Logger 實例化
// ============================================================

const systemLoggerInstance = winston.createLogger({
    // 預設日誌等級 (生產環境 info / 開發環境 debug)
    level: process.env.LOG_LEVEL || 'debug',
    
    transports: [
        // A. 系統日誌檔案 (每日輪替)
        new winston.transports.DailyRotateFile({
            filename: path.join(logDirectory, 'system-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true, // 舊檔案壓縮
            maxSize: '20m',      // 單檔最大 20MB
            maxFiles: '14d',     // 保留 14 天
            format: fileFormat,
            handleExceptions: true
        }),
        
        // B. 終端機輸出 (Console)
        new winston.transports.Console({
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            format: consoleFormat
        })
    ],

    // C. 異常捕捉 (最後一道防線)
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDirectory, 'exceptions.log'),
            format: fileFormat 
        })
    ],
    
    // D. Promise Rejection 捕捉
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDirectory, 'rejections.log'),
            format: fileFormat 
        })
    ],
    
    exitOnError: false // 發生錯誤時不強制退出
});

export const appLogger = systemLoggerInstance;
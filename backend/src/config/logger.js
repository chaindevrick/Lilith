/**
 * src/config/logger.js
 * 系統日誌設定 (Winston)
 */
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

// --- 0. 環境與路徑設定 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 使用 resolve 確保路徑解析更穩健
const logDirectory = path.resolve(__dirname, '../../logs');

const { combine, timestamp, printf, colorize, label, errors, splat } = winston.format;

// --- 1. 自定義日誌排版邏輯 ---
const customPrintFormat = printf((info) => {
    // 解構需要的參數，並取出其餘的 metadata (例如 conversationId)
    const { level, message, timestamp, label, stack, conversationId } = info;

    const prefix = label ? `[${label}]` : '';
    let logMessage = message;

    // [Safety] 訊息長度截斷防護
    if (typeof logMessage === 'string' && logMessage.length > 2000) {
        logMessage = logMessage.substring(0, 2000) + '...(Log截斷)';
    } 
    // [Safety] 如果訊息是物件 (例如直接 log 一個 Object)，轉為字串以免顯示 [object Object]
    else if (typeof logMessage === 'object') {
        try {
            logMessage = JSON.stringify(logMessage);
        } catch (e) {
            logMessage = '[Circular/Unserializable Object]';
        }
    }

    let output = `[${timestamp}] ${prefix} [${level.toUpperCase()}] `;

    // 支援從 metadata 傳入 conversationId
    if (conversationId) {
        output += `[ConvID: ${conversationId}] `;
    }

    output += logMessage;

    // 如果有錯誤堆疊，接在最後面 (這是 errors({ stack: true }) 生效的關鍵)
    if (stack) {
        output += `\nStack Trace: ${stack}`;
    }

    return output;
});

// --- 2. 格式組合 ---

// 基礎格式 (共用)
const baseFormat = combine(
    label({ label: 'SYSTEM' }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // [New] 自動捕捉 Error 物件的 stack
    splat()                  // [New] 支援類似 printf 的字串插值與物件展開
);

// [檔案用]: 純文字
const fileFormat = combine(
    baseFormat,
    customPrintFormat
);

// [終端機用]: 帶顏色
const consoleFormat = combine(
    colorize({ all: false }), // 僅對 level 上色，方便閱讀訊息
    baseFormat,
    customPrintFormat
);

// ============================================================
// Logger 初始化
// ============================================================
const systemLoggerInstance = winston.createLogger({
    // 預設等級，可由環境變數覆蓋 (預設 debug)
    level: process.env.LOG_LEVEL || 'debug',
    transports: [
        // 1. 寫入 System 檔案 (每日輪替)
        new winston.transports.DailyRotateFile({
            filename: path.join(logDirectory, 'system-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: fileFormat, // 獨立格式
            handleExceptions: true // 讓此 Transport 也能處理未捕獲異常
        }),
        // 2. 輸出到 Console
        new winston.transports.Console({
            // Console 通常只需要 info 以上，除非在開發模式
            level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
            format: consoleFormat // 獨立格式
        })
    ],
    // 專門的異常處理檔案 (Process 崩潰時的最後一道防線)
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDirectory, 'exceptions.log'),
            format: fileFormat 
        })
    ],
    // 處理 Promise Rejection (Node.js 預設不會捕獲這個，Winston 可以幫忙)
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logDirectory, 'rejections.log'),
            format: fileFormat 
        })
    ],
    exitOnError: false // 避免因寫入 Log 失敗導致程式崩潰
});

export const appLogger = systemLoggerInstance;
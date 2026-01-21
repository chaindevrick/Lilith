/**
 * src/db/sqlite.js
 * 資料庫核心
 * 定義系統核心資料表結構 (Facts, Relationships, History, LTM)
 */

import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from '../config/logger.js';

// ============================================================
// 1. 環境配置與常數定義
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/lilith_memory.db');

// 資料表名稱定義 (Single Source of Truth)
export const TABLE_FACTS = 'memories_facts';           // 事實記憶 (Persona)
export const TABLE_RELATIONSHIPS = 'relationships';    // 關係狀態 (Emotion)
export const TABLE_HISTORY = 'chat_histories';         // 對話紀錄 (Context)
export const TABLE_EPISODIC = 'memories_episodic';     // 情節記憶 (LTM)

// 資料庫實例 (單例模式)
export let db = null;

// ============================================================
// 2. 核心功能
// ============================================================

/**
 * 初始化資料庫連接與結構
 * @returns {Promise<sqlite.Database>}
 */
export const initializeDatabase = async () => {
    if (db) return db;

    try {
        // 確保目錄存在
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // 開啟連接
        db = await sqlite.open({
            filename: DB_PATH,
            driver: sqlite3.Database,
        });

        appLogger.info(`[SQLite] Database connected at: ${DB_PATH}`);

        // 執行建表邏輯
        await _createTables(db);

        return db;
    } catch (error) {
        appLogger.error("❌ [SQLite] Init Fatal Error:", error);
        throw error;
    }
};

/**
 * 安全關閉資料庫
 */
export const closeDatabase = async () => {
    if (db) {
        await db.close();
        db = null;
        appLogger.info('[SQLite] Connection closed.');
    }
};

// ============================================================
// 3. 私有建表邏輯 (Schema Definitions)
// ============================================================

const _createTables = async (dbConn) => {
    // 1. 事實記憶表 (Facts)
    // 用於儲存 "User喜歡吃辣", "Lilith討厭下雨" 等靜態事實
    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_FACTS} (
            conversation_id TEXT NOT NULL,
            fact_key        TEXT NOT NULL,
            fact_detail     TEXT NOT NULL,
            scope           TEXT DEFAULT 'user', -- user | agent | us
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (conversation_id, fact_key)
        );
    `);

    // 2. 關係狀態表 (Relationships)
    // 用於儲存 Lilith 與使用者的情感狀態
    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_RELATIONSHIPS} (
            conversation_id     TEXT PRIMARY KEY,
            
            -- Demon State (Lilith)
            demon_affection     INTEGER DEFAULT 20,
            demon_trust         INTEGER DEFAULT 10,
            demon_mood          INTEGER DEFAULT 0,
            
            -- Angel State (Lilith's Angel)
            angel_affection     INTEGER DEFAULT 0,
            angel_trust         INTEGER DEFAULT 0,
            angel_mood          INTEGER DEFAULT 0,
            
            -- Meta Data
            last_interaction_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_user_activity  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 3. 對話歷史表 (Chat History)
    // 儲存用於 LLM Context 的短期對話視窗
    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_HISTORY} (
            conversation_id TEXT PRIMARY KEY,
            history_json    TEXT NOT NULL, -- JSON Array
            updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 4. 情節記憶表 (Episodic LTM)
    // 用於儲存重要事件、工具使用紀錄、反思結果
    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_EPISODIC} (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp        DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            type             TEXT NOT NULL, -- conversation | tool_use | experience | error
            trigger          TEXT,          -- User Input or System Event
            action           TEXT,          -- Tool Name or Internal Thought
            result           TEXT,          -- Result content or JSON
            
            reflection       TEXT,          -- Post-event insights (added by self-reflection)
            importance_score REAL DEFAULT 0.5,
            tags             TEXT           -- JSON Array for search tags (New)
        );
    `);
    
    // 建立索引以加速 LTM 檢索
    await dbConn.run(`CREATE INDEX IF NOT EXISTS idx_episodic_type ON ${TABLE_EPISODIC}(type);`);
    await dbConn.run(`CREATE INDEX IF NOT EXISTS idx_episodic_score ON ${TABLE_EPISODIC}(importance_score);`);
};
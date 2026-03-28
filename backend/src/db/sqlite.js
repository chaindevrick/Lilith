/**
 * src/db/sqlite.js
 * 資料庫核心 (Database Core)
 */

import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from '../core/services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/lilith_memory.db');

export const TABLE_RELATIONSHIPS = 'relationships';    
export const TABLE_HISTORY = 'chat_histories';         
export const TABLE_PLATFORM_USERS = 'platform_mappings'; 

export let db = null;

export const initializeDatabase = async () => {
    if (db) return db;

    try {
        const dbDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

        db = await sqlite.open({
            filename: DB_PATH,
            driver: sqlite3.Database,
        });

        await db.run('PRAGMA journal_mode = WAL;');

        appLogger.info(`[SQLite] Database connected at: ${DB_PATH}`);
        await _createTables(db);
        return db;
    } catch (error) {
        appLogger.error("❌ [SQLite] Init Fatal Error:", error);
        throw error;
    }
};

export const closeDatabase = async () => {
    if (db) {
        await db.close();
        db = null;
        appLogger.info('[SQLite] Connection closed.');
    }
};

const _createTables = async (dbConn) => {
    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_RELATIONSHIPS} (
            conversation_id     TEXT PRIMARY KEY,
            endocrine_state     TEXT NOT NULL, -- 儲存內分泌濃度與更新時間 JSON
            affection           INTEGER DEFAULT 45, -- 兼容層：顯示用快取
            trust               INTEGER DEFAULT 10, -- 兼容層：顯示用快取
            mood                INTEGER DEFAULT 0,  -- 兼容層：顯示用快取
            total_interactions  INTEGER DEFAULT 0,  -- 總互動次數
            total_tokens        INTEGER DEFAULT 0, -- 記錄累計 Token
            last_interaction_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_user_activity  DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_HISTORY} (
            conversation_id TEXT PRIMARY KEY,
            history_json    TEXT NOT NULL,
            updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await dbConn.run(`
        CREATE TABLE IF NOT EXISTS ${TABLE_PLATFORM_USERS} (
            platform        TEXT NOT NULL,
            platform_id     TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            user_name       TEXT NOT NULL,
            updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (platform, platform_id)
        );
    `);
};
/**
 * src/db/repository.js
 * 資料倉儲層 (Repository Layer)
 * 封裝所有 SQLite 資料庫操作，提供統一的資料存取介面。
 */

import { appLogger } from '../config/logger.js';
import { 
    TABLE_FACTS, 
    TABLE_RELATIONSHIPS, 
    TABLE_HISTORY, 
    TABLE_EPISODIC 
} from './sqlite.js';

export class LilithRepository {
    /**
     * @param {Object} db - SQLite Database Instance
     */
    constructor(db) {
        if (!db) throw new Error('[Repository] DB instance is required');
        this.db = db;
    }

    // ============================================================
    // 1. 關係與情緒 (Relationships)
    // ============================================================
    
    /**
     * 獲取關係狀態
     * @param {string} conversationId 
     */
    async getRelationship(conversationId) {
        try {
            return await this.db.get(
                `SELECT * FROM ${TABLE_RELATIONSHIPS} WHERE conversation_id = ?`, 
                conversationId
            );
        } catch (e) {
            appLogger.error('[Repo] getRelationship failed:', e);
            return null;
        }
    }

    /**
     * 初始化新關係
     * @param {string} conversationId 
     * @param {Object} defaults - 初始數值
     */
    async createRelationship(conversationId, defaults) {
        try {
            const now = new Date().toISOString();
            await this.db.run(
                `INSERT INTO ${TABLE_RELATIONSHIPS} 
                (conversation_id, demon_affection, demon_trust, demon_mood, angel_affection, angel_mood, last_interaction_at, last_user_activity) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                conversationId, 
                defaults.demon_affection || 20,
                defaults.demon_trust || 10,
                0, 0, 0, 
                now, 
                now
            );
            return await this.getRelationship(conversationId);
        } catch (e) {
            appLogger.error('[Repo] createRelationship failed:', e);
            throw e;
        }
    }

    /**
     * 更新最後用戶活動時間 (用於心跳檢測)
     */
    async updateUserActivity(conversationId) {
        try {
            const now = new Date().toISOString();
            await this.db.run(
                `UPDATE ${TABLE_RELATIONSHIPS} SET last_user_activity = ? WHERE conversation_id = ?`,
                now, conversationId
            );
            return now;
        } catch (e) {
            appLogger.error('[Repo] updateUserActivity failed:', e);
            return null;
        }
    }

    /**
     * 更新關係數值
     * @param {string} conversationId 
     * @param {Object} v - 包含要更新的數值物件
     */
    async updateRelationship(conversationId, v) {
        try {
            // 使用 Nullish Coalescing (??) 確保數值不會被意外覆蓋為 NULL
            // 優先讀取新欄位名稱 (如 demon_trust)，若無則讀取舊名稱 (如 trust) 以保持相容性
            await this.db.run(
                `UPDATE ${TABLE_RELATIONSHIPS} 
                 SET demon_affection=?, demon_trust=?, demon_mood=?, 
                     angel_affection=?, angel_trust=?, angel_mood=?, last_user_activity=? 
                 WHERE conversation_id=?`,
                v.demon_affection ?? v.base_affection ?? 20, 
                v.demon_trust ?? v.trust ?? 10, 
                v.demon_mood ?? v.mood_offset ?? 0, 
                v.angel_affection ?? 20, 
                v.angel_trust ?? 10, 
                v.angel_mood ?? 0, 
                v.last_user_activity, 
                conversationId
            );
        } catch (e) {
            appLogger.error('[Repo] updateRelationship failed:', e);
        }
    }

    /**
     * 獲取最近活躍的用戶 ID (用於主動任務)
     */
    async getMostActiveUser() {
        try {
            const row = await this.db.get(
                `SELECT conversation_id FROM ${TABLE_RELATIONSHIPS} ORDER BY last_user_activity DESC LIMIT 1`
            );
            return row ? row.conversation_id : null;
        } catch (e) {
            return null;
        }
    }

    // ============================================================
    // 2. 對話歷史 (Chat History)
    // ============================================================

    async getHistory(conversationId) {
        try {
            const row = await this.db.get(
                `SELECT history_json FROM ${TABLE_HISTORY} WHERE conversation_id = ?`, 
                conversationId
            );
            return row ? JSON.parse(row.history_json) : [];
        } catch (e) {
            appLogger.error('[Repo] getHistory failed:', e);
            return [];
        }
    }

    async saveHistory(conversationId, historyArray) {
        try {
            const jsonStr = JSON.stringify(historyArray);
            await this.db.run(
                `INSERT INTO ${TABLE_HISTORY} (conversation_id, history_json) VALUES (?, ?) 
                 ON CONFLICT(conversation_id) DO UPDATE SET history_json=excluded.history_json, updated_at=CURRENT_TIMESTAMP`,
                conversationId, jsonStr
            );
        } catch (e) {
            appLogger.error('[Repo] saveHistory failed:', e);
        }
    }

    // ============================================================
    // 3. 事實記憶 (Facts / Persona)
    // ============================================================

    async getFacts(conversationId) {
        try {
            return await this.db.all(
                `SELECT fact_key, fact_detail, scope FROM ${TABLE_FACTS} 
                 WHERE conversation_id = ? ORDER BY created_at DESC`,
                conversationId
            );
        } catch (e) {
            appLogger.error('[Repo] getFacts failed:', e);
            return [];
        }
    }

    async saveFact(conversationId, key, detail, scope) {
        try {
            await this.db.run(
                `INSERT INTO ${TABLE_FACTS} (conversation_id, fact_key, fact_detail, scope)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(conversation_id, fact_key) DO UPDATE SET
                    fact_detail = excluded.fact_detail,
                    scope = excluded.scope,
                    created_at = CURRENT_TIMESTAMP`,
                conversationId, key, detail, scope
            );
        } catch (e) {
            appLogger.error('[Repo] saveFact failed:', e);
        }
    }

    // ============================================================
    // 4. 情節記憶 (Episodic LTM)
    // ============================================================

    async createMemory(memory) {
        const { type, trigger, action, result, importance_score } = memory;
        try {
            const res = await this.db.run(
                `INSERT INTO ${TABLE_EPISODIC} (type, trigger, action, result, importance_score)
                 VALUES (?, ?, ?, ?, ?)`,
                type, trigger, action, result, importance_score
            );
            return res.lastID;
        } catch (e) {
            appLogger.error('[Repo] createMemory failed:', e);
            return null;
        }
    }

    async getMemories({ type, limit = 10 }) {
        try {
            let query = `SELECT * FROM ${TABLE_EPISODIC}`;
            const params = [];
            
            if (type) {
                query += ` WHERE type = ?`;
                params.push(type);
            }
            
            query += ` ORDER BY timestamp DESC LIMIT ?`;
            params.push(limit);

            return await this.db.all(query, ...params);
        } catch (e) {
            appLogger.error('[Repo] getMemories failed:', e);
            return [];
        }
    }

    async updateReflection(id, reflectionText) {
        try {
            await this.db.run(
                `UPDATE ${TABLE_EPISODIC} SET reflection = ? WHERE id = ?`,
                reflectionText, id
            );
        } catch (e) {
            appLogger.error('[Repo] updateReflection failed:', e);
        }
    }
}
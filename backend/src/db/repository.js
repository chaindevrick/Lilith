/**
 * src/db/repository.js
 * 資料倉儲層 (Repository Layer) - v1.0
 * 統一管理 SQL 調用，將資料庫操作與業務邏輯分離
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
     */
    async createRelationship(conversationId, defaults) {
        try {
            const now = new Date().toISOString();
            await this.db.run(
                `INSERT INTO ${TABLE_RELATIONSHIPS} 
                (conversation_id, demon_affection, demon_trust, demon_mood, angel_affection, angel_mood, last_interaction_at, last_user_activity) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                conversationId, 
                defaults.base_affection, defaults.trust, 0, 0, 0, '', now
            );
            return await this.getRelationship(conversationId);
        } catch (e) {
            appLogger.error('[Repo] createRelationship failed:', e);
            throw e;
        }
    }

    /**
     * 更新關係狀態
     */
    async updateRelationship(conversationId, v) {
        try {
            await this.db.run(
                `UPDATE ${TABLE_RELATIONSHIPS} 
                 SET demon_affection=?, demon_trust=?, demon_mood=?, 
                     angel_affection=?, angel_trust=?, angel_mood=?, last_user_activity=? 
                 WHERE conversation_id=?`,
                v.base_affection, v.trust, v.mood_offset, 
                v.angel_affection, v.angel_trust, v.angel_mood, v.last_user_activity, 
                conversationId
            );
        } catch (e) {
            appLogger.error('[Repo] updateRelationship failed:', e);
        }
    }

    /**
     * 獲取最近活躍的用戶 ID (用於後台小劇場)
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

    /**
     * 獲取並解析對話歷史
     * @returns {Promise<Array>} 返回解析後的 JSON 陣列
     */
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

    /**
     * 儲存對話歷史 (自動 JSON 序列化)
     */
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

    /**
     * 獲取所有相關事實
     */
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

    /**
     * 儲存或更新事實 (Upsert)
     */
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

    /**
     * 銘刻長期記憶
     */
    async createMemory(memory) {
        const { type, trigger, action, result, importance_score } = memory;
        try {
            // 使用 this.db.run 的 callback 模式取回 lastID 有點麻煩，
            // 這裡改用 await run 並利用 sqlite 庫回傳的 result.lastID (如果 driver 支援)
            // 為了保持兼容性，這裡僅執行插入，不回傳 ID，或需確保 driver 支援
            const res = await this.db.run(
                `INSERT INTO ${TABLE_EPISODIC} (type, trigger, action, result, importance_score)
                 VALUES (?, ?, ?, ?, ?)`,
                type, trigger, action, result, importance_score
            );
            return res.lastID; // sqlite wrapper 通常會回傳這個
        } catch (e) {
            appLogger.error('[Repo] createMemory failed:', e);
            return null;
        }
    }

    /**
     * 檢索長期記憶
     */
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

    /**
     * 添加反思
     */
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
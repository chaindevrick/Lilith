/**
 * src/db/repository.js
 */

import fs from 'fs/promises';
import path from 'path';
import { appLogger } from '../core/services/logger.js';
import { TABLE_RELATIONSHIPS, TABLE_HISTORY, TABLE_PLATFORM_USERS } from './sqlite.js';

const INIT_ENDOCRINE_STATE = {
    last_updated: Date.now(),
    levels: { DOPAMINE: 40, ENDORPHIN: 0, CORTISOL: 10, OXYTOCIN: 0, ADRENALINE: 0, NOREPINEPHRINE: 30 }
};

export class LilithRepository {
    constructor(db) {
        if (!db) throw new Error('[Repository] DB instance is required');
        this.db = db;
        
        this.knowledgeFiles = {
            memory: './data/memory.md'
        };
    }

    async getCoreKnowledge() {
        let knowledge = "【System Root Context】\n";
        try {
            const fullPath = path.resolve(process.cwd(), this.knowledgeFiles.memory);
            const content = await fs.readFile(fullPath, 'utf-8');
            knowledge += `${content}\n`;
        } catch (e) {
            appLogger.warn(`[Repo] 無法讀取核心檔案 MEMORY.md: ${e.message}`);
        }
        return knowledge;
    }
    
    async getRelationship(conversationId) {
        try {
            return await this.db.get(`SELECT * FROM ${TABLE_RELATIONSHIPS} WHERE conversation_id = ?`, conversationId);
        } catch (e) {
            appLogger.error('[Repo] getRelationship failed:', e);
            return null;
        }
    }

    async updateRelationship(conversationId, data) {
        try {
            const exists = await this.db.get(`SELECT 1 FROM ${TABLE_RELATIONSHIPS} WHERE conversation_id = ?`, conversationId);
            if (!exists) {
                await this.db.run(`
                    INSERT INTO ${TABLE_RELATIONSHIPS} (conversation_id, endocrine_state, total_tokens) 
                    VALUES (?, ?, 0)
                `, conversationId, JSON.stringify(INIT_ENDOCRINE_STATE));
            }

            let updates = [];
            let values = [];

            if (data.endocrine_state) {
                updates.push('endocrine_state = ?');
                values.push(data.endocrine_state);
            }
            if (data.affection !== undefined) {
                updates.push('affection = ?');
                values.push(data.affection);
            }
            if (data.trust !== undefined) {
                updates.push('trust = ?');
                values.push(data.trust);
            }
            if (data.mood !== undefined) {
                updates.push('mood = ?');
                values.push(data.mood);
            }

            if (updates.length > 0) {
                updates.push('last_interaction_at = CURRENT_TIMESTAMP');
                values.push(conversationId);
                await this.db.run(`UPDATE ${TABLE_RELATIONSHIPS} SET ${updates.join(', ')} WHERE conversation_id = ?`, ...values);
            }
        } catch (e) {
            appLogger.error('[Repo] updateRelationship failed:', e);
        }
    }

    async saveHistory(conversationId, historyArray) {
        try {
            const jsonString = JSON.stringify(historyArray);
            await this.db.run(
                `INSERT INTO ${TABLE_HISTORY} (conversation_id, history_json) 
                 VALUES (?, ?) 
                 ON CONFLICT(conversation_id) DO UPDATE SET 
                 history_json=excluded.history_json, updated_at=CURRENT_TIMESTAMP`,
                conversationId, jsonString
            );
        } catch (e) {
            appLogger.error('[Repo] saveHistory failed:', e);
        }
    }

    async getHistory(conversationId) {
        try {
            const row = await this.db.get(`SELECT history_json FROM ${TABLE_HISTORY} WHERE conversation_id = ?`, conversationId);
            return row ? JSON.parse(row.history_json) : [];
        } catch (e) {
            appLogger.error('[Repo] getHistory failed:', e);
            return [];
        }
    }

    async getPlatformUser(platform, platformId) {
        try {
            return await this.db.get(
                `SELECT * FROM ${TABLE_PLATFORM_USERS} WHERE platform = ? AND platform_id = ?`,
                platform, platformId
            );
        } catch (e) {
            appLogger.error(`[Repo] getPlatformUser (${platform}) failed:`, e);
            return null;
        }
    }

    async savePlatformUser(platform, platformId, conversationId, userName) {
        try {
            await this.db.run(
                `INSERT INTO ${TABLE_PLATFORM_USERS} (platform, platform_id, conversation_id, user_name) 
                 VALUES (?, ?, ?, ?) 
                 ON CONFLICT(platform, platform_id) DO UPDATE SET 
                 conversation_id=excluded.conversation_id, 
                 user_name=excluded.user_name, 
                 updated_at=CURRENT_TIMESTAMP`,
                platform, platformId, conversationId, userName
            );
        } catch (e) {
            appLogger.error(`[Repo] savePlatformUser (${platform}) failed:`, e);
        }
    }

    async incrementTokens(conversationId, tokenCount) {
        if (!tokenCount) return;
        try {
            await this.db.run(`
                INSERT INTO ${TABLE_RELATIONSHIPS} (conversation_id, endocrine_state, total_tokens) 
                VALUES (?, ?, ?)
                ON CONFLICT(conversation_id) DO UPDATE SET 
                total_tokens = total_tokens + excluded.total_tokens
            `, conversationId, JSON.stringify(INIT_ENDOCRINE_STATE), tokenCount);
            
            appLogger.info(`[Repo] Incremented ${tokenCount} tokens for ${conversationId}`);
        } catch (e) { 
            appLogger.error('[Repo] incrementTokens failed:', e); 
        }
    }

    async getTotalTokens(conversationId) {
        try {
            const row = await this.db.get(`SELECT total_tokens FROM ${TABLE_RELATIONSHIPS} WHERE conversation_id = ?`, conversationId);
            
            if (!row || row.total_tokens === null || row.total_tokens === undefined) {
                return 0;
            }
            return row.total_tokens;
        } catch (e) { 
            appLogger.error('[Repo] getTotalTokens failed:', e);
            return 0; 
        }
    }
}
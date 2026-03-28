/**
 * src/db/vectorDb.js
 * 輕量級本地向量資料庫 (SQLite Persistence + In-Memory Search)
 */
import { db } from './sqlite.js';
import { appLogger } from '../core/services/logger.js';

const TABLE_VECTORS = 'vector_store';

export class LocalVectorDB {
    constructor() {
        // 記憶體快取：以空間換取極致的搜尋時間
        this.cache = new Map(); 
        this.isInitialized = false;
    }

    /**
     * 系統啟動時呼叫：建立資料表並載入記憶體
     */
    async init() {
        if (this.isInitialized || !db) return;
        try {
            await db.run(`
                CREATE TABLE IF NOT EXISTS ${TABLE_VECTORS} (
                    id TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    vector_json TEXT NOT NULL,
                    metadata_json TEXT NOT NULL
                );
            `);

            const rows = await db.all(`SELECT * FROM ${TABLE_VECTORS}`);
            for (const row of rows) {
                this.cache.set(row.id, {
                    id: row.id,
                    text: row.text,
                    vector: JSON.parse(row.vector_json),
                    metadata: JSON.parse(row.metadata_json)
                });
            }
            appLogger.info(`[VectorDB] 📦 成功載入 ${this.cache.size} 筆向量記憶至快取`);
            this.isInitialized = true;
        } catch (error) {
            appLogger.error('[VectorDB] 初始化失敗:', error);
            throw error;
        }
    }

    async checkExists(id) {
        return this.cache.has(id);
    }

    /**
     * 寫入向量 (同步寫入記憶體與 SQLite)
     */
    async insert(record) {
        const { id, text, vector, metadata } = record;
        this.cache.set(id, record); // 更新快取

        try {
            await db.run(
                `INSERT OR REPLACE INTO ${TABLE_VECTORS} (id, text, vector_json, metadata_json) VALUES (?, ?, ?, ?)`,
                id, text, JSON.stringify(vector), JSON.stringify(metadata || {})
            );
        } catch (e) {
            appLogger.error(`[VectorDB] 寫入失敗 (ID: ${id}):`, e);
        }
    }

    /**
     * 執行餘弦相似度搜尋 (支援 Metadata Filter)
     */
    async search(queryVector, options = {}) {
        const { topK = 5, filter = {} } = options;
        let results = [];

        // 走訪記憶體中的每一筆向量進行比對
        for (const record of this.cache.values()) {
            // 1. 條件過濾 (例如：只找 metadata.type === 'knowledge_base')
            let passFilter = true;
            if (filter) {
                for (const [key, value] of Object.entries(filter)) {
                    if (record.metadata[key] !== value) {
                        passFilter = false;
                        break;
                    }
                }
            }
            if (!passFilter) continue;

            // 2. 計算相似度
            const score = this._cosineSimilarity(queryVector, record.vector);
            results.push({ ...record, score });
        }

        // 3. 排序並取 Top K
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    /**
     * 純數學：計算餘弦相似度 (Cosine Similarity)
     * 公式: A · B / (||A|| * ||B||)
     */
    _cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const localVectorDB = new LocalVectorDB();
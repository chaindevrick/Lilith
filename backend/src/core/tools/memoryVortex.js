/**
 * src/core/tools/MemoryVortex.js
 * RAG Core - 基於 Google Embedding (text-embedding-004) + Vectra 本地向量庫
 * 負責將長期記憶轉化為向量並進行語意檢索
 */

import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { appLogger } from '../../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 設定記憶儲存路徑 (存放在專案根目錄的 data/memory_vortex)
// 使用 path.resolve 確保跨平台相容性
const INDEX_PATH = path.resolve(__dirname, '../../../data/memory_vortex');
const EMBEDDING_MODEL = "text-embedding-004";

export class MemoryVortex {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            appLogger.error('[MemoryVortex] Missing GEMINI_API_KEY. RAG system disabled.');
            return;
        }

        this.index = new LocalIndex(INDEX_PATH);
        
        // 使用 OpenAI SDK 連接 Google Gemini API
        this.client = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY, 
            baseURL: process.env.GEMINI_API_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
        });
        
        this.modelName = EMBEDDING_MODEL;

        // 初始化資料庫 (非同步操作)
        this._init().catch(err => {
            appLogger.error('[MemoryVortex] Init failed:', err);
        });
    }

    /**
     * 初始化向量索引
     * 若目錄不存在會自動建立
     */
    async _init() {
        try {
            if (!await this.index.isIndexCreated()) {
                await this.index.createIndex();
                appLogger.info('[MemoryVortex] Vector DB initialized.');
            }
        } catch (e) {
            appLogger.error('[MemoryVortex] Vector DB Init Error:', e);
        }
    }

    /**
     * [Private] 概念轉化 (Embedding)
     * 將文字轉化為向量座標 (768維)
     * @param {string} text - 輸入文本
     * @returns {Promise<number[]>} 向量陣列
     */
    async _getVector(text) {
        try {
            const response = await this.client.embeddings.create({
                model: this.modelName,
                input: text,
                encoding_format: "float",
            });
            return response.data[0].embedding;
        } catch (error) {
            appLogger.error(`[MemoryVortex] Embedding failed: ${error.message}`);
            // 常見錯誤：API Key 無效、模型名稱錯誤
            throw error;
        }
    }

    /**
     * 銘刻記憶 (Store Memory)
     * 將重要資訊寫入向量資料庫
     * @param {string} text - 記憶內容
     * @param {Object} metadata - 額外資訊 (來源、分類等)
     * @returns {Promise<string>} 操作結果訊息
     */
    async memorize(text, metadata = {}) {
        if (!text || text.trim().length === 0) return "[System] Empty text ignored.";

        try {
            const vector = await this._getVector(text);
            const id = uuidv4();
            
            await this.index.insertItem({
                id,
                vector,
                metadata: { 
                    text, 
                    ...metadata, 
                    timestamp: new Date().toISOString() 
                }
            });

            appLogger.info(`[MemoryVortex] Memory stored (ID: ${id}, Len: ${text.length})`);
            return `[System] Memory engraved successfully (ID: ${id})`;
        } catch (error) {
            appLogger.error(`[MemoryVortex] Memorize error: ${error.message}`);
            return `[System Error] Memorize failed: ${error.message}`;
        }
    }

    /**
     * 靈魂檢索 (Recall / Query)
     * 根據語意相似度找回相關記憶
     * @param {string} query - 查詢意圖
     * @param {number} limit - 回傳數量
     * @returns {Promise<string>} 格式化後的記憶文本
     */
    async recall(query, limit = 3) {
        try {
            const vector = await this._getVector(query);
            const results = await this.index.queryItems(vector, limit);

            if (results.length === 0) return ""; // 查無資料回傳空字串

            // 格式化回傳，讓 LLM 容易閱讀
            const memories = results.map(item => {
                const meta = item.item.metadata;
                const score = item.score; // 相似度分數 (Cosine Similarity)
                return `[RAG | Similarity ${(score * 100).toFixed(1)}%] ${meta.text}`;
            });

            appLogger.info(`[MemoryVortex] Recalled ${memories.length} items for query: "${query.substring(0, 20)}..."`);
            return memories.join('\n');
        } catch (error) {
            appLogger.error(`[MemoryVortex] Recall failed: ${error.message}`);
            return ""; // 失敗時不中斷對話，僅回傳空
        }
    }
}

// 導出單例實例
export const memoryVortex = new MemoryVortex();
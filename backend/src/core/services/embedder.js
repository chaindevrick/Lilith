/**
 * src/core/services/embedder.js
 * 統一語意轉換器 (相容 OpenAI SDK 與 Gemini 遠端 API)
 */
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '../../configs/config.json');

export class Embedder {
    constructor() {
        let config = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        } catch (e) { 
            appLogger.warn('[Embedder] 無法讀取 config.json，將使用環境變數。'); 
        }

        this.modelName = config.vectorModel || '';
        this.client = new OpenAI({
            apiKey: config.LTM_LLM_API_KEY || '',
            baseURL: config.LTM_LLM_API_BASE_URL || '',
        });

        appLogger.info(`[Embedder] 載入 Embedding 引擎，使用模型: ${this.modelName}`);
    }

    /**
     * 將文字轉換為向量
     */
    async embedText(text) {
        try {
            // 處理換行符號，這在 OpenAI 官方最佳實踐中能稍微提升向量品質
            const cleanText = text.replace(/\n/g, ' '); 
            
            const response = await this.client.embeddings.create({
                model: this.modelName,
                input: cleanText,
            });
            
            return response.data[0].embedding;
        } catch (error) {
            appLogger.error(`[Embedder] 向量轉換失敗: ${error.message}`);
            throw error;
        }
    }
}

export const systemEmbedder = new Embedder();
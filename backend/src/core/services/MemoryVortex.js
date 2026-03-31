/**
 * src/services/MemoryVortex.js (或 src/agents/services/MemoryVortex.js 取決於你的目錄結構)
 * 記憶漩渦服務：管理顯性知識庫與隱性對話記憶，提供混合檢索功能
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import bm25 from 'wink-bm25-text-search';
import nlp from 'wink-nlp-utils';
import { appLogger } from './logger.js';

export class MemoryVortex {
    constructor() {
        this.db = null; 
        this.embedder = null; 
        
        // 初始化 BM25 引擎 (用於客觀知識的精確關鍵字打擊)
        this.bm25Engine = bm25();
        this.bm25Engine.defineConfig({ fldWeights: { text: 1 } });
        this.bm25Engine.definePrepTasks([
            nlp.string.lowerCase, 
            nlp.string.tokenize0, 
            nlp.tokens.removeWords, 
            nlp.tokens.stem
        ]);

        this.knowledgePaths = {
            projects: path.resolve(process.cwd(), 'data/memory/projects.md'),
            infra: path.resolve(process.cwd(), 'data/memory/infra.md'),
            lessons: path.resolve(process.cwd(), 'data/memory/lessons.md'),
            index: path.resolve(process.cwd(), 'data/memory/memory.md'), 
            user: path.resolve(process.cwd(), 'src/configs/user.md') 
        };

        // 記憶體內的知識庫快取 (給 BM25 檢索用)
        this.knowledgeCache = new Map();
    }

    init(vectorDB, embeddingModel) {
        this.db = vectorDB;
        this.embedder = embeddingModel;
        appLogger.info('[MemoryVortex] 🧠 VectorDB 與 Embedding Model 已成功綁定');
    }

    async readCoreKnowledge(topic) {
        if (!this.knowledgePaths[topic]) return `[Error] 未知的知識庫分類：${topic}`;
        try {
            await this._ensureFilesExist();
            return await fs.readFile(this.knowledgePaths[topic], 'utf-8');
        } catch (e) { return `[File Empty or Not Found: ${topic}.md]`; }
    }

    async updateCoreKnowledge(topic, content, mode = 'append') {
        if (!this.knowledgePaths[topic]) throw new Error(`未知的知識庫：${topic}`);
        const filePath = this.knowledgePaths[topic];
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            if (mode === 'append') {
                const timestamp = new Date().toISOString().split('T')[0];
                await fs.appendFile(filePath, `\n### [${timestamp}] Update\n${content}\n`, 'utf-8');
            } else {
                await fs.writeFile(filePath, content, 'utf-8');
            }
            
            appLogger.info(`[💾 顯性記憶寫入] 成功更新 ${topic}.md (Mode: ${mode})`);
            
            // 寫入後自動觸發向量與 BM25 同步
            await this.syncKnowledgeBaseToVectorDB();
            return `✅ 成功寫入 ${topic}.md`;
        } catch (e) { 
            appLogger.error(`[💾 顯性記憶寫入失敗] ${topic}.md: ${e.message}`);
            throw new Error(`寫入失敗: ${e.message}`); 
        }
    }

    async syncKnowledgeBaseToVectorDB() {
        await this._ensureFilesExist();

        appLogger.info(`\n┌─ [📚 知識庫雙軌同步 (Knowledge Base Sync)] ─`);
        
        this.bm25Engine = bm25();
        this.bm25Engine.defineConfig({ fldWeights: { text: 1 } });
        this.bm25Engine.definePrepTasks([
            nlp.string.lowerCase, 
            nlp.string.tokenize0, 
            nlp.tokens.removeWords, 
            nlp.tokens.stem
        ]);
        this.knowledgeCache.clear();
        
        for (const [topic, filePath] of Object.entries(this.knowledgePaths)) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                if (!content.trim()) continue;

                const chunks = this._chunkMarkdown(content);
                let newVectorCount = 0;
                
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const chunkHash = crypto.createHash('md5').update(chunk).digest('hex');
                    const docId = `kb_${topic}_${chunkHash}`;

                    // 加入 BM25 稀疏索引與記憶體快取
                    this.bm25Engine.addDoc({ text: chunk }, docId);
                    this.knowledgeCache.set(docId, { text: chunk, topic: topic });

                    if (this.db && this.embedder) {
                        const exists = await this.db.checkExists ? await this.db.checkExists(docId) : false;
                        if (!exists) {
                            const embedding = await this.embedder.embedText(chunk);
                            await this.db.insert({
                                id: docId,
                                text: chunk,
                                vector: embedding,
                                metadata: { type: 'knowledge_base', topic: topic }
                            });
                            newVectorCount++;
                        }
                    }
                }
                appLogger.info(`│ 🔄 ${topic}.md 同步完成 -> 切塊數: ${chunks.length} | 新增向量: ${newVectorCount}`);
            } catch (e) { 
                appLogger.warn(`│ ⚠️ 同步 ${topic}.md 失敗或為空: ${e.message}`); 
            }
        }
        
        if (this.knowledgeCache.size > 0) {
            this.bm25Engine.consolidate(); 
            appLogger.info(`│ 🔒 BM25 索引已鎖定，共包含 ${this.knowledgeCache.size} 個區塊`);
        } else {
            appLogger.info(`│ ⚠️ 知識庫為空，跳過 BM25 索引鎖定`);
        }
        
        appLogger.info(`└────────────────────────────────────────────`);
    }

    _chunkMarkdown(text, maxChunkSize = 800) {
        const rawChunks = text.split(/(?=^#{1,4} )/m);
        const finalChunks = [];
        for (let chunk of rawChunks) {
            chunk = chunk.trim();
            if (!chunk) continue;
            if (chunk.length > maxChunkSize) {
                const subChunks = chunk.split('\n\n');
                let currentSub = "";
                for (const sub of subChunks) {
                    if ((currentSub.length + sub.length) < maxChunkSize) { currentSub += sub + "\n\n"; } 
                    else {
                        if (currentSub.trim()) finalChunks.push(currentSub.trim());
                        currentSub = sub + "\n\n";
                    }
                }
                if (currentSub.trim()) finalChunks.push(currentSub.trim());
            } else { finalChunks.push(chunk); }
        }
        return finalChunks;
    }

    async retrieveObjectiveKnowledge(queryText, topK = 3) {
        if (this.knowledgeCache.size === 0) return ""; 

        // 1. Semantic Search (Dense) - 取 Top 10
        const queryVector = await this.embedder.embedText(queryText);
        const semanticResults = await this.db.search(queryVector, { topK: 10, filter: { type: 'knowledge_base' } });
        
        // 2. BM25 Search (Sparse) - 取 Top 10
        const bm25RawResults = this.bm25Engine.search(queryText, 10);
        
        // 3. 倒數秩融合演算法 (Reciprocal Rank Fusion, RRF)
        const K = 60; 
        const fusedScores = new Map();

        // 處理語意排名
        semanticResults.forEach((doc, index) => {
            const rank = index + 1;
            fusedScores.set(doc.id, { doc: doc, score: 1 / (K + rank) });
        });

        // 處理 BM25 排名
        bm25RawResults.forEach((res, index) => {
            const docId = res[0]; 
            const rank = index + 1;
            
            if (fusedScores.has(docId)) {
                fusedScores.get(docId).score += 1 / (K + rank);
            } else {
                const cachedDoc = this.knowledgeCache.get(docId);
                if (cachedDoc) {
                    fusedScores.set(docId, { 
                        doc: { id: docId, text: cachedDoc.text, metadata: { topic: cachedDoc.topic } }, 
                        score: 1 / (K + rank) 
                    });
                }
            }
        });

        // 4. 重新排序並取 Top K
        const finalResults = Array.from(fusedScores.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(item => item.doc);

        appLogger.info(`\n┌─ [🔍 客觀知識檢索 (Hybrid RRF Search)] ─`);
        appLogger.info(`│ 🎯 查詢: "${queryText}"`);
        appLogger.info(`│ 🧠 語意命中: ${semanticResults.length} 筆 | 🔤 關鍵字命中: ${bm25RawResults.length} 筆`);
        appLogger.info(`│ 🏆 最終提取: ${finalResults.length} 筆 (來源涵蓋: ${[...new Set(finalResults.map(r => r.metadata.topic))].join(', ') || '無'})`);
        appLogger.info(`└────────────────────────────────────────────`);

        if (finalResults.length === 0) return "";
        return finalResults.map(r => `[📄 From ${r.metadata.topic}.md]:\n${r.text}`).join('\n\n');
    }

    async logMemoryWithEmotion(text, type, userName, conversationId, currentEndocrine) {
        const embedding = await this.embedder.embedText(text);
        const memoryRecord = {
            id: `mem_${Date.now()}`, text: text, vector: embedding,
            metadata: {
                type, userName, conversationId, timestamp: Date.now(),
                DOPA: currentEndocrine.DOPAMINE || 0, ENDO: currentEndocrine.ENDORPHIN || 0,
                CORT: currentEndocrine.CORTISOL || 0, OXY: currentEndocrine.OXYTOCIN || 0,
                ADRE: currentEndocrine.ADRENALINE || 0, NORE: currentEndocrine.NOREPINEPHRINE || 0
            }
        };
        await this.db.insert(memoryRecord);
        
        appLogger.info(`[📝 隱性記憶寫入] 記錄對話快照 | 參與者: ${userName} | DOPA:${Math.round(memoryRecord.metadata.DOPA)} CORT:${Math.round(memoryRecord.metadata.CORT)}`);
    }

    async emotionAwareSearch(queryText, currentEndocrine, topK = 2) {
        const queryVector = await this.embedder.embedText(queryText);
        // 只搜尋對話記憶
        const candidates = await this.db.search(queryVector, { topK: 10, filter: { type: 'Conversation' } });

        let alpha = 0.7; 
        let beta = 0.3;  
        let stateLog = "一般狀態";

        if (currentEndocrine.CORTISOL > 70 || currentEndocrine.ADRENALINE > 70) { 
            alpha = 0.4; beta = 0.6; 
            stateLog = "高壓/亢奮 (偏重情緒檢索，容易翻舊帳)";
        } 
        else if (currentEndocrine.OXYTOCIN > 70) { 
            alpha = 0.5; beta = 0.5; 
            stateLog = "高信任 (依戀檢索)";
        }

        const rerankedMemories = candidates.map(mem => {
            const semanticScore = mem.score; 
            const memEmo = mem.metadata;
            
            const distance = Math.sqrt(
                Math.pow(currentEndocrine.DOPAMINE - memEmo.DOPA, 2) + Math.pow(currentEndocrine.ENDORPHIN - memEmo.ENDO, 2) +
                Math.pow(currentEndocrine.CORTISOL - memEmo.CORT, 2) + Math.pow(currentEndocrine.OXYTOCIN - memEmo.OXY, 2) +
                Math.pow(currentEndocrine.ADRENALINE - memEmo.ADRE, 2) + Math.pow(currentEndocrine.NOREPINEPHRINE - memEmo.NORE, 2)
            );

            const MAX_DISTANCE = 245;
            const emotionScore = Math.max(0, 1 - (distance / MAX_DISTANCE));
            const finalScore = (alpha * semanticScore) + (beta * emotionScore);

            return { ...mem, finalScore };
        });

        rerankedMemories.sort((a, b) => b.finalScore - a.finalScore);
        const finalResults = rerankedMemories.slice(0, topK);

        appLogger.info(`\n┌─ [🌊 情感一致性檢索 (Emotion-Congruent RAG)] ─`);
        appLogger.info(`│ 🎯 查詢: "${queryText}"`);
        appLogger.info(`│ ⚖️ 系統狀態: ${stateLog}`);
        appLogger.info(`│ 🎛️ 檢索權重: 語義(α)=${alpha} | 情緒(β)=${beta}`);
        appLogger.info(`│ 🏆 召回結果: ${finalResults.length} 筆 (從 ${candidates.length} 筆候選中篩選)`);
        appLogger.info(`└────────────────────────────────────────────`);

        return finalResults;
    }

    async _ensureFilesExist() {
        for (const [topic, filePath] of Object.entries(this.knowledgePaths)) {
            try {
                // 嘗試存取檔案，若不存在會拋出錯誤進入 catch
                await fs.access(filePath);
            } catch (error) {
                // 檔案或目錄不存在，開始自動建立
                const dir = path.dirname(filePath);
                await fs.mkdir(dir, { recursive: true });
                
                // 🌟 核心修改 2：根據不同的知識庫主題，給予優雅的 Markdown 預設模板
                let defaultContent = `# ${topic.toUpperCase()} Knowledge Base\n\n`;
                switch(topic) {
                    case 'index':
                        defaultContent = `# 系統根目錄 (Memory Index)\n\n這是系統的核心記憶區塊。\n`;
                        break;
                    case 'lessons':
                        defaultContent = `# 歷史教訓 (Lessons Learned)\n\n記錄系統發生的錯誤、Bug 解法與開發守則。\n`;
                        break;
                    case 'infra':
                        defaultContent = `# 系統架構 (Infrastructure)\n\n記錄伺服器、資料庫、網路與環境配置。\n`;
                        break;
                    case 'projects':
                        defaultContent = `# 專案進度 (Projects)\n\n記錄目前正在進行的任務、里程碑與待辦事項。\n`;
                        break;
                    case 'user':
                        defaultContent = `# 使用者核心記憶 (User Core Memory)\n\n記錄使用者的偏好、習慣與長期目標。\n`;
                        break;
                }

                await fs.writeFile(filePath, defaultContent, 'utf-8');
                appLogger.info(`[MemoryVortex] 📄 自動創建缺失的知識庫檔案: ${topic}.md`);
            }
        }
    }
}

export const memoryVortex = new MemoryVortex();
/**
 * src/core/modules/Cognition.js
 * 認知與思考模組 (Cognitive Engine) - 支援快慢雙軌架構
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { appLogger } from '../services/logger.js';
import { skillRegistry } from '../services/SkillRegistry.js';
import { memoryVortex } from '../services/MemoryVortex.js';
import { getSystemPrompt, getNaturalConversationInstruction, getInteractionRulesPrompt } from '../../../configs/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '../../configs/config.json');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAX_HISTORY_STORE = 40;   
const MAX_THOUGHT_DEPTH = 6;    

export class CognitionModule {
    constructor(repo, emotion, reflexEngine) {
        if (!repo || !emotion) throw new Error('[Cognition] Missing required dependencies.');
        this.repo = repo;
        this.emotion = emotion; 
        this.reflexEngine = reflexEngine;
        
        let config = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        } catch (e) { appLogger.warn('[Cognition] 無法讀取 config.json，將使用空設定。'); }

        this.modelName = config.llmModel || 'gemini-3.1-pro-preview';
        this.client = new OpenAI({ 
            apiKey: config.LLM_API_KEY || '', 
            baseURL: config.LLM_API_BASE_URL || ''
        });
        
        this.isBusy = false;
        appLogger.info(`[Cognition] Engine initialized with model: ${this.modelName}`);
    }

    async handleInternalImpulse(impulseType, context = {}) {
        const typeStr = typeof impulseType === 'object' ? JSON.stringify(impulseType) : String(impulseType);
        if (!typeStr.includes('HEARTBEAT')) {
            appLogger.info(`[Cognition] 💓 觸發內部衝動: ${typeStr}`);
        }
        return null;
    }

    async _getCleanHistory(id) {
        let history = await this.repo.getHistory(id) || [];
        if (history.length > MAX_HISTORY_STORE) {
            history = history.slice(history.length - MAX_HISTORY_STORE);
        }
        return history;
    }

    async processInput(payload) {
        if (this.isBusy) {
            appLogger.warn(`[Cognition] Engine is busy. Rejecting input.`);
            return { channelId: payload.channelId, messages: ["(思考中...請稍候)"], emotion: {} };
        }
        
        this.isBusy = true;

        try {
            const { conversationId, userName = 'User', userText, attachments = [], channelId, platformContext } = payload;
            const requestId = channelId;

            appLogger.info(`\n┌───────────────────────────────────────────────┐`);
            appLogger.info(`│ 🧠 [Cognition] 新的輸入感知 (Input Perceived)`);
            appLogger.info(`│ 👤 使用者: ${userName} (${platformContext || 'Web'})`);
            appLogger.info(`│ 💬 內容: ${userText ? userText.substring(0, 50).replace(/\n/g, ' ') : '(無文字)'}`);
            appLogger.info(`└───────────────────────────────────────────────┘`);

            const { imageParts, textContent } = this._processAttachments(userText, attachments);
            const safeText = textContent || (imageParts.length > 0 ? "(User uploaded an image)" : "(Empty)");

            // ==========================================
            // 🧠 雙軌道認知架構 (Dual-Process Architecture)
            // ==========================================

            // 1. [LeDoux] 極速通道 (Fast Track)：觸發杏仁核，非同步執行
            if (this.reflexEngine && safeText.length > 0) {
                this.reflexEngine.triggerAmygdala(conversationId, safeText).catch(e => appLogger.error(e));
            }

            // 2. [Damasio] 生理延遲 (Somatic Delay)：大腦皮層停頓 2000ms，等待化學物質部署
            await delay(2000);

            // 3. 讀取最新狀態 (此時已包含 Fast Track 的潛在化學突變)
            const moodState = await this.emotion.perceive(conversationId);            
            
            // 4. [Bower] 情緒一致性 RAG 檢索：帶入當前化學濃度進行混合搜索
            const ragMemories = await memoryVortex.emotionAwareSearch(safeText, moodState.rawLevels, 2); 
            
            const context = { moodState, ragMemories, userName, platformContext };
            const dbHistory = await this._getCleanHistory(conversationId);
            const ephemeralSession = [...dbHistory];

            const userContentPayload = (imageParts.length > 0)
                ? [{ type: "text", text: safeText }, ...imageParts]
                : safeText;

            appLogger.info(`[Cognition] ⚡ 啟動大腦皮層邏輯解析...`);
            appLogger.info(`[Cognition] 📊 當下生理快照: DOPA:${Math.round(moodState.rawLevels.DOPAMINE)} | CORT:${Math.round(moodState.rawLevels.CORTISOL)} | ADRE:${Math.round(moodState.rawLevels.ADRENALINE)}`);
            
            // 5. [Barrett] 情緒建構：執行主 LLM，將化學快照作為系統提示詞注入
            const reply = await this._runPrimaryPersona(userContentPayload, ephemeralSession, context, requestId, conversationId);
            appLogger.info(`[Cognition] 🗣️ 思考完畢，產生回覆 (${reply.length} 字)`);
            
            const cleanUserMsg = { role: 'user', content: safeText };
            const cleanAssistantMsg = { role: 'assistant', content: reply };
            dbHistory.push(cleanUserMsg, cleanAssistantMsg);
            await this.repo.saveHistory(conversationId, dbHistory);

            // 6. 寫入帶有「情感標籤」的永久記憶
            const logContent = `${userName}: ${safeText}\nAI: ${reply}`;
            await memoryVortex.logMemoryWithEmotion(logContent, 'Conversation', userName, conversationId, moodState.rawLevels);

            // 7. 從 ephemeralSession 中過濾出「本次對話週期」內呼叫的工具名稱
            const executedTools = ephemeralSession
                .slice(dbHistory.length) // 只看這次新增的思考過程
                .filter(msg => msg.role === 'tool')
                .map(msg => msg.name);

            // 丟給數位杏仁核進行非同步自我評估 (不需 await 阻塞回傳，讓它在背景慢慢結算)
            if (this.reflexEngine) {
                this.reflexEngine.evaluateSelfFeedback(conversationId, reply, executedTools).catch(e => appLogger.error(e));
            }

            return {
                channelId: payload.channelId,
                messages: [reply],
                emotion: { 
                    chemicals: moodState.rawLevels,
                    isStressed: moodState.rawLevels.CORTISOL > 60 || moodState.rawLevels.ADRENALINE > 60
                }
            };

        } catch (e) {
            appLogger.error('[Cognition] ❌ Process Error:', e);
            return { channelId: payload.channelId, messages: ["(系統核心運算錯誤)"], emotion: {} };
        } finally {
            this.isBusy = false;
        }
    }

    _processAttachments(originalText, attachments) {
        let finalText = originalText || "";
        const imageParts = [];
        if (!attachments || attachments.length === 0) return { imageParts, textContent: finalText };

        for (const file of attachments) {
            if (file.type && file.type.startsWith('image/')) {
                imageParts.push({ type: "image_url", image_url: { url: `data:${file.type};base64,${file.base64}` } });
            } else if (file.mimeType && file.mimeType.startsWith('image/')) {
                imageParts.push({ type: "image_url", image_url: { url: `data:${file.mimeType};base64,${file.data}` } });
            } else if (this._isTextFile(file)) {
                try {
                    const decodedText = Buffer.from(file.data || file.base64, 'base64').toString('utf-8');
                    finalText += `\n\n--- [File: ${file.name}] ---\n${decodedText}\n--- [End of File] ---`;
                } catch (e) { appLogger.warn(`[Cognition] ⚠️ Failed to decode text file: ${file.name}`); }
            }
        }
        return { imageParts, textContent: finalText };
    }

    _isTextFile(file) {
        const mime = file.mimeType || file.type || '';
        return mime.startsWith('text/') || /\.(js|py|md|txt|html|css|json|yml|yaml)$/.test(file.name);
    }

    async _runPrimaryPersona(userContentPayload, ephemeralSession, context, requestId, conversationId) {
        const fullSystemPrompt = [
            getSystemPrompt(context),
            skillRegistry.getSkillInstructions(), 
            getNaturalConversationInstruction(),
            getInteractionRulesPrompt()
        ].filter(Boolean).join('\n\n'); 
        
        const systemMsg = { role: 'system', content: fullSystemPrompt };
        ephemeralSession.push({ role: 'user', content: userContentPayload });

        return await this._executeLLM(conversationId, systemMsg, ephemeralSession, 0, requestId, 0);
    }

    async _executeLLM(conversationId, systemMsg, sessionHistory, depth = 0, requestId = null, retryCount = 0) {
        if (depth > MAX_THOUGHT_DEPTH) {
            appLogger.warn(`[Cognition] 🛑 觸發保護機制：思考深度超過限制 (${MAX_THOUGHT_DEPTH}層)。`);
            return "(思考迴圈過深，已強制中斷)";
        }

        try {
            const toolsPayload = skillRegistry.getDeclarations();
            if (depth > 0) appLogger.info(`[Cognition] 🔄 進入第 ${depth} 層思考迴圈...`);

            const messages = [systemMsg, ...sessionHistory];
            
            const res = await this.client.chat.completions.create({
                model: this.modelName, 
                messages, 
                tools: toolsPayload.length > 0 ? toolsPayload : undefined, 
                tool_choice: toolsPayload.length > 0 ? 'auto' : undefined,

            });

            // 🌟 強化版 Token 記帳與除錯邏輯
            let consumedTokens = 0;
            if (res.usage && res.usage.total_tokens) {
                consumedTokens = res.usage.total_tokens;
            } else if (res.usage_metadata && res.usage_metadata.totalTokenCount) {
                // 兼容某些 Gemini 原始格式的相容層
                consumedTokens = res.usage_metadata.totalTokenCount;
            }

            if (consumedTokens > 0) {
                appLogger.info(`[Cognition] 💰 本次思考消耗 Token: ${consumedTokens}`);
                await this.repo.incrementTokens(conversationId, consumedTokens);
            } else {
                appLogger.warn(`[Cognition] ⚠️ 無法從 API 回應中解析出 Token 消耗！API 回傳結構:`, JSON.stringify(res.usage || res.usage_metadata || '無 usage 物件'));
            }

            const msg = res.choices[0].message;
            sessionHistory.push(msg);
            
            if (msg.tool_calls) {
                appLogger.info(`[Cognition] 🛠️ AI 決定調用工具 (共 ${msg.tool_calls.length} 個)`);
                for (const call of msg.tool_calls) {
                    try {
                        const args = JSON.parse(call.function.arguments);
                        appLogger.info(`  ▶ 執行工具: [${call.function.name}]`);
                        
                        const output = await skillRegistry.executeTool(call.function.name, args);
                        let toolResultStr = String(output);
                        
                        if (toolResultStr.includes('[IMAGE_BASE64]')) {
                            appLogger.info(`  ◀ 工具執行完畢: 成功獲取視覺畫面`);
                            const parts = toolResultStr.split('[IMAGE_BASE64]');
                            sessionHistory.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: parts[0].trim() || "[圖片已獲取]" });
                            sessionHistory.push({ role: 'user', content: [{ type: 'text', text: '視覺畫面：' }, { type: 'image_url', image_url: { url: parts[1].trim() } }] });
                        } else {
                            const logOutput = toolResultStr.length > 50 ? toolResultStr.substring(0, 50).replace(/\n/g, '') + '...' : toolResultStr.replace(/\n/g, '');
                            appLogger.info(`  ◀ 工具執行完畢: ${logOutput}`);
                            
                            if (toolResultStr.length > 8000) toolResultStr = toolResultStr.substring(0, 8000) + '\n...[已截斷]...';
                            sessionHistory.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: toolResultStr });
                        }
                    } catch (toolErr) {
                        appLogger.error(`  ❌ 工具執行失敗 [${call.function.name}]:`, toolErr.message);
                        sessionHistory.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: `Error: ${toolErr.message}` });
                    }
                }
                await delay(1500);
                return await this._executeLLM(conversationId, systemMsg, sessionHistory, depth + 1, requestId, 0); 
            }
            return msg.content || "...";

        } catch (error) {
            if (error.status === 400 || (error.message && error.message.includes('400'))) {
                appLogger.error(`[Cognition] 🚨 觸發 400 Bad Request 錯誤！詳情: ${error.message}`);
            }
            if (error.status === 429 || (error.message && error.message.includes('429'))) {
                if (retryCount < 4) {
                    await delay(Math.pow(2, retryCount) * 2000);
                    return await this._executeLLM(conversationId, systemMsg, sessionHistory, depth, requestId, retryCount + 1);
                }
            }
            throw error;
        }
    }
}
/**
 * src/core/modules/Cognition.js
 * 前額葉認知模組 (Cognition Module)
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { toolsDeclarations, executeTool } from '../tools/registry.js';
import { 
    getDemonSystemPrompt, 
    getAngelSystemPrompt,
    getAngelReactorPrompt, 
    getBackgroundChatPrompt,
    getSelfReflectionPrompt,
    getNaturalConversationInstruction,
    getInteractionRulesPrompt
} from '../../config/prompts.js';

// --- 常數定義 ---
const MODEL_NAME = 'gemini-2.5-pro';
const MAX_HISTORY_STORE = 60;
const MAX_HISTORY_CONTEXT = 20;
const MAX_THOUGHT_DEPTH = 5;

export class CognitionModule {
    /**
     * @param {Object} repo - LilithRepository 實例
     * @param {Object} emotion - EmotionModule 實例
     * @param {Object} persona - PersonaModule 實例
     * @param {Object} ltm - LongTermMemory 實例
     */
    constructor(repo, emotion, persona, ltm) {
        if (!repo || !emotion || !persona || !ltm) {
            throw new Error('[Cognition] Missing required dependencies.');
        }

        this.repo = repo;
        this.emotion = emotion; 
        this.persona = persona;
        this.ltm = ltm;
        
        this.client = new OpenAI({ 
            apiKey: process.env.GEMINI_API_KEY, 
            baseURL: process.env.GEMINI_API_BASE_URL 
        });
        this.isBusy = false;
    }

    /**
     * 核心處理入口
     */
    async processInput(payload) {
        if (this.isBusy) {
            return { channelId: payload.channelId, messages: ["(思考中...請稍候)"], emotion: {} };
        }
        this.isBusy = true;

        try {
            const { conversationId, userText, attachments = [], mode = 'demon' } = payload;

            // 附件處理器：分離圖片與文字內容
            const { imageParts, textContent } = this._processAttachments(userText, attachments);
            
            // 用於感知的 safeText (若只有圖片，給個佔位符，避免感知模組壞掉)
            const safeText = textContent || (imageParts.length > 0 ? "(User uploaded an image)" : "(Empty)");

            // 1. 感知與人格回憶 (Perception)
            const [moodState, memoryContext] = await Promise.all([
                this.emotion.perceive(conversationId, safeText),
                this.persona.recall(conversationId)
            ]);

            // 初始 RAG 記憶為空 (Function Calling 策略)
            const ragMemories = ""; 

            const context = { moodState, memoryContext, ragMemories };
            const history = await this._loadHistoryAsMessages(conversationId);

            let finalOutputMessages = [];

            // ==========================================
            // 2. 雙人格路由邏輯 (傳入 imageParts)
            // ==========================================
            
            if (mode === 'angel') {
                // [模式 A] 天使獨處
                const angelReply = await this._runPrimaryPersona('angel', textContent, imageParts, history, context);
                finalOutputMessages = [angelReply]; 
            } 
            else if (mode === 'group') {
                // [模式 B] 群組對話
                const demonReply = await this._runPrimaryPersona('demon', textContent, imageParts, history, context);
                
                // Angel 反應堆
                const angelComment = await this._runAngelReactor(safeText, demonReply, context);
                
                finalOutputMessages = [demonReply];
                if (angelComment) {
                    finalOutputMessages.push(`(Angel: ${angelComment})`);
                }
            } 
            else {
                // [模式 C] 惡魔獨處 (預設)
                const demonReply = await this._runPrimaryPersona('demon', textContent, imageParts, history, context);
                finalOutputMessages = [demonReply];
            }

            // 3. 記憶存檔 (只存文字記錄)
            const fullLog = finalOutputMessages.join('\n');
            await this._saveHistory(conversationId, safeText, fullLog, { mode });
            
            // LTM 寫入 (非同步)
            this.persona.memorize(conversationId, safeText, fullLog).catch(err => {
                appLogger.warn('[Cognition] LTM Memorize failed:', err);
            });

            // 4. 回傳結果
            return {
                channelId: payload.channelId,
                messages: finalOutputMessages,
                mode: mode,
                emotion: {
                    demon_mood: moodState.values.demon_mood,
                    demon_affection: moodState.values.demon_affection,
                    demon_trust: moodState.values.demon_trust,
                    angel_mood: moodState.values.angel_mood,
                    angel_affection: moodState.values.angel_affection,
                    angel_trust: moodState.values.angel_trust
                }
            };

        } catch (e) {
            appLogger.error('[Cognition] Process Error:', e);
            return { channelId: payload.channelId, messages: ["(系統核心運算錯誤)"], emotion: {} };
        } finally {
            this.isBusy = false;
        }
    }

    // ============================================================
    // 附件處理器
    // ============================================================
    _processAttachments(originalText, attachments) {
        let finalText = originalText || "";
        const imageParts = [];

        if (!attachments || attachments.length === 0) {
            return { imageParts, textContent: finalText };
        }

        for (const file of attachments) {
            // file 結構: { name, mimeType, data (base64) }
            
            if (file.mimeType.startsWith('image/')) {
                // [Image] 轉為 OpenAI Vision 格式
                imageParts.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${file.mimeType};base64,${file.data}`
                    }
                });
            } else if (
                file.mimeType.startsWith('text/') || 
                file.mimeType.includes('json') || 
                file.mimeType.includes('javascript') ||
                file.name.endsWith('.js') || file.name.endsWith('.py') || file.name.endsWith('.md')
            ) {
                // [Code/Text] 解碼 Base64 並附加到 Prompt
                try {
                    const decodedText = Buffer.from(file.data, 'base64').toString('utf-8');
                    finalText += `\n\n--- [File: ${file.name}] ---\n${decodedText}\n--- [End of File] ---`;
                } catch (e) {
                    appLogger.warn(`[Cognition] Failed to decode text file: ${file.name}`);
                }
            }
        }
        
        return { imageParts, textContent: finalText };
    }

    // ============================================================
    // 核心人格執行器 (Vision Supported)
    // ============================================================

    async _runPrimaryPersona(type, userText, imageParts, history, context) {
        let coreSystemPrompt = "";
        if (type === 'angel') {
            coreSystemPrompt = getAngelSystemPrompt(context);
        } else {
            coreSystemPrompt = getDemonSystemPrompt(context);
        }

        const fullSystemPrompt = [
            coreSystemPrompt,
            getNaturalConversationInstruction(),
            getInteractionRulesPrompt()
        ].join('\n\n');
        
        // 構建 User Content (混合文字與圖片)
        let userContentPayload;
        
        if (imageParts && imageParts.length > 0) {
            userContentPayload = [
                { type: "text", text: userText || "請分析這張圖片。" }, 
                ...imageParts
            ];
        } else {
            userContentPayload = userText;
        }

        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...history,
            { role: 'user', content: userContentPayload }
        ];

        return await this._executeLLM(messages);
    }

    async _runAngelReactor(userText, demonReply, context) {
        const prompt = getAngelReactorPrompt(userText, demonReply, context);
        const messages = [
            { role: 'system', content: prompt },
            { role: 'user', content: "請進行觀測。" }
        ];

        try {
            const res = await this.client.chat.completions.create({
                model: MODEL_NAME, messages, temperature: 0.7
            });
            return res.choices[0].message.content;
        } catch (e) { return ""; }
    }

    async _executeLLM(messages, depth = 0) {
        if (depth > MAX_THOUGHT_DEPTH) return "(思考迴圈過深，強制中斷)";
        
        const res = await this.client.chat.completions.create({
            model: MODEL_NAME, 
            messages, 
            tools: toolsDeclarations, 
            tool_choice: 'auto'
        });

        const msg = res.choices[0].message;
        
        if (msg.tool_calls) {
            const nextMsgs = [...messages, msg];
            for (const call of msg.tool_calls) {
                try {
                    const args = JSON.parse(call.function.arguments);
                    const output = await executeTool(call.function.name, args);
                    
                    // 使用注入的 LTM 實例記錄
                    this.ltm.record({ 
                        type: 'tool_use', 
                        action: call.function.name, 
                        trigger: JSON.stringify(args),
                        result: String(output).slice(0, 200)
                    });
                    
                    nextMsgs.push({ 
                        role: 'tool', 
                        tool_call_id: call.id, 
                        name: call.function.name, 
                        content: String(output) 
                    });
                } catch (toolErr) {
                    nextMsgs.push({ 
                        role: 'tool', 
                        tool_call_id: call.id, 
                        name: call.function.name, 
                        content: `Error: ${toolErr.message}` 
                    });
                }
            }
            return await this._executeLLM(nextMsgs, depth + 1);
        }
        
        return msg.content || "...";
    }

    // ============================================================
    // 內部事件處理
    // ============================================================

    async handleInternalImpulse(impulse) {
        if (this.isBusy) return null;
        
        if (impulse.type === 'TRIGGER_SELF_REFLECTION') {
            await this._performSelfReflection();
            return null;
        }
        
        // 閒置小劇場
        const conversationId = await this._getMostActiveUser();
        if (!conversationId) return null;

        const state = await this.emotion.getState(conversationId);
        const lastActiveTime = new Date(state.values.last_user_activity).getTime();
        const idleTimeMinutes = (Date.now() - lastActiveTime) / (1000 * 60);

        if (idleTimeMinutes > 60 && Math.random() > 0.7) {
            this.isBusy = true;
            try {
                return await this._runBackgroundChat(conversationId, state);
            } finally {
                this.isBusy = false;
            }
        }
        return null;
    }

    async _runBackgroundChat(conversationId, state) {
        const prompt = getBackgroundChatPrompt(state);
        try {
            const res = await this.client.chat.completions.create({
                model: MODEL_NAME, messages: [{ role: 'system', content: prompt }]
            });
            const dialogue = res.choices[0].message.content;
            
            appLogger.info(`[小劇場] ${dialogue}`);
            await this._saveHistory(conversationId, "[System Trigger]", dialogue, { mode: 'group' });

            return { 
                channelId: conversationId,
                messages: [dialogue],
                emotion: state.values,
                mode: 'group'
            };
        } catch (e) {
            return null;
        }
    }

    async _performSelfReflection() {
        appLogger.info('[Cognition] 午夜反思啟動...');
        try {
            const recentMemories = await this.ltm.retrieve({ period: '24h', limit: 10 });
            if (recentMemories.length === 0) return;
            
            const reflectionPrompt = getSelfReflectionPrompt(recentMemories);
            const response = await this.client.chat.completions.create({
                model: MODEL_NAME, messages: [{ role: 'system', content: reflectionPrompt }], response_format: { type: "json_object" }
            });
            
            const result = JSON.parse(response.choices[0].message.content);
            for (const insight of result.insights) {
                await this.ltm.addReflection(insight.memory_id, insight.reflection_text);
            }
        } catch(e) { appLogger.error('[Cognition] 反思失敗:', e); }
    }

    // ============================================================
    // Repository Access
    // ============================================================

    async _loadHistoryAsMessages(id) {
        const history = await this.repo.getHistory(id);
        return history.slice(-MAX_HISTORY_CONTEXT);
    }
    
    async _saveHistory(id, u, a, meta = {}) { 
        const hist = await this.repo.getHistory(id);
        const mode = meta.mode || 'demon';
        
        const userMsg = { role: 'user', content: u, timestamp: new Date().toISOString(), meta: { target: mode } };
        const assistantMsg = { role: 'assistant', content: a, timestamp: new Date().toISOString(), meta: { speaker: mode } };

        const newHist = [...hist, userMsg, assistantMsg].slice(-MAX_HISTORY_STORE);
        
        await this.repo.saveHistory(id, newHist);
    }

    async _getMostActiveUser() {
        return await this.repo.getMostActiveUser();
    }
}
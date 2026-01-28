/**
 * src/core/modules/Cognition.js
 * 前額葉認知模組 (Cognition Module)
 * 負責整合感知 (Emotion)、記憶 (LTM/Persona) 與決策 (LLM)，
 * 並根據當前模式 (Angel/Demon/Group) 路由對話或執行工具。
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { toolsDeclarations, executeTool } from '../tools/registry.js';
import { groupChatService } from '../services/GroupChatService.js'; 
import { 
    getDemonSystemPrompt, 
    getAngelSystemPrompt,
    getSelfReflectionPrompt,
    getNaturalConversationInstruction,
    getInteractionRulesPrompt
} from '../../config/prompts.js';

// --- 常數定義 ---
const MODEL_NAME = 'gemini-3-pro';
const MAX_HISTORY_STORE = 60;   // 資料庫保留的對話長度
const MAX_HISTORY_CONTEXT = 20; // 餵給 LLM 的短期記憶長度
const MAX_THOUGHT_DEPTH = 5;    // 工具調用的最大遞迴深度

export class CognitionModule {
    /**
     * @param {Object} repo - 資料倉儲
     * @param {Object} emotion - 情緒模組
     * @param {Object} persona - 人格與記憶模組
     * @param {Object} ltm - 長期情節記憶模組
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
     * 核心處理入口 (Process Input)
     * 接收使用者輸入，執行感知、決策並回傳回應。
     * @param {Object} payload - { conversationId, userText, attachments, mode }
     */
    async processInput(payload) {
        if (this.isBusy) {
            return { channelId: payload.channelId, messages: ["(思考中...請稍候)"], emotion: {} };
        }
        this.isBusy = true;

        try {
            const { conversationId, userText, attachments = [], mode = 'demon' } = payload;

            // 1. 附件前處理 (分離圖片與文字)
            const { imageParts, textContent } = this._processAttachments(userText, attachments);
            const safeText = textContent || (imageParts.length > 0 ? "(User uploaded an image)" : "(Empty)");

            // 2. 感知與記憶回憶 (Perception & Recall)
            const [moodState, memoryContext] = await Promise.all([
                this.emotion.perceive(conversationId, safeText, mode),
                this.persona.recall(conversationId)
            ]);

            const ragMemories = ""; 

            const context = { moodState, memoryContext, ragMemories };
            const history = await this._loadHistoryAsMessages(conversationId);

            let finalOutputMessages = [];

            // 3. 人格路由 (Persona Routing)
            if (mode === 'group') {
                appLogger.info('[Cognition] Entering Group Director Mode...');
                
                // 呼叫群組編排器 (支援工具與視覺)
                const responseChain = await groupChatService.orchestrateConversation(
                    safeText, 
                    context, 
                    this.ltm, 
                    history, 
                    imageParts
                );
                
                // 格式化輸出
                finalOutputMessages = responseChain.map(item => 
                    `[SPEAKER:${item.speaker}]${item.content}`
                );
                
            } else if (mode === 'angel') {
                const angelReply = await this._runPrimaryPersona('angel', textContent, imageParts, history, context);
                finalOutputMessages = [angelReply]; 
            } else {
                const demonReply = await this._runPrimaryPersona('demon', textContent, imageParts, history, context);
                finalOutputMessages = [demonReply];
            }

            // 4. 記憶存檔 (Memory Storage)
            const fullLog = finalOutputMessages.join('\n');
            await this._saveHistory(conversationId, safeText, fullLog, { mode });
            
            // 寫入 LTM (非同步執行，不阻塞回應)
            this.persona.memorize(conversationId, safeText, fullLog, mode).catch(err => {
                appLogger.warn('[Cognition] LTM Memorize failed:', err);
            });

            // 5. 回傳結果
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

    /**
     * 附件處理器
     * 將上傳檔案轉換為 LLM 可理解的格式 (Vision / Text)
     */
    _processAttachments(originalText, attachments) {
        let finalText = originalText || "";
        const imageParts = [];

        if (!attachments || attachments.length === 0) {
            return { imageParts, textContent: finalText };
        }

        for (const file of attachments) {
            if (file.mimeType.startsWith('image/')) {
                // OpenAI Vision 格式
                imageParts.push({
                    type: "image_url",
                    image_url: { url: `data:${file.mimeType};base64,${file.data}` }
                });
            } else if (this._isTextFile(file)) {
                // 文字檔案直接附加到 Prompt
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

    _isTextFile(file) {
        return file.mimeType.startsWith('text/') || 
               file.mimeType.includes('json') || 
               file.mimeType.includes('javascript') ||
               /\.(js|py|md|txt|html|css|json)$/.test(file.name);
    }

    /**
     * 執行單一人格 (Angel/Demon)
     */
    async _runPrimaryPersona(type, userText, imageParts, history, context) {
        const coreSystemPrompt = type === 'angel' 
            ? getAngelSystemPrompt(context) 
            : getDemonSystemPrompt(context);

        const fullSystemPrompt = [
            coreSystemPrompt,
            getNaturalConversationInstruction(),
            getInteractionRulesPrompt()
        ].join('\n\n');
        
        // 構建 User Content
        const userContentPayload = (imageParts && imageParts.length > 0)
            ? [{ type: "text", text: userText || "請分析這張圖片。" }, ...imageParts]
            : userText;

        const messages = [
            { role: 'system', content: fullSystemPrompt },
            ...history,
            { role: 'user', content: userContentPayload }
        ];

        return await this._executeLLM(messages);
    }

    /**
     * LLM 執行迴圈 (支援工具調用與遞迴思考)
     */
    async _executeLLM(messages, depth = 0) {
        if (depth > MAX_THOUGHT_DEPTH) return "(思考迴圈過深，強制中斷)";
        
        const res = await this.client.chat.completions.create({
            model: MODEL_NAME, 
            messages, 
            tools: toolsDeclarations, 
            tool_choice: 'auto'
        });

        const msg = res.choices[0].message;
        
        // 如果 LLM 決定呼叫工具
        if (msg.tool_calls) {
            const nextMsgs = [...messages, msg];
            
            for (const call of msg.tool_calls) {
                try {
                    const args = JSON.parse(call.function.arguments);
                    const output = await executeTool(call.function.name, args);
                    
                    // 寫入情節記憶 (LTM)
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
            // 遞迴調用，讓 LLM 根據工具結果生成回應
            return await this._executeLLM(nextMsgs, depth + 1);
        }
        
        return msg.content || "...";
    }

    // ============================================================
    // 內部事件處理 (Internal Impulses)
    // ============================================================

    /**
     * 處理來自 Scheduler 的潛意識衝動
     */
    async handleInternalImpulse(impulse) {
        if (this.isBusy) return null;
        
        if (impulse.type === 'TRIGGER_SELF_REFLECTION') {
            await this._performSelfReflection();
            return null;
        }

        if (impulse.type !== 'IDLE_CHECK') return null;

        const conversationId = await this._getMostActiveUser();
        if (!conversationId) return null;

        const state = await this.emotion.getState(conversationId);
        
        // 優先讀取 last_user_activity (最新活動時間)
        let lastActivityStr = state.values.last_user_activity || state.values.last_interaction_at;

        // [Auto-Healing] 自動修復無時間紀錄的異常
        if (!lastActivityStr) {
            appLogger.warn(`[Cognition] 用戶 ${conversationId} 無活動紀錄，執行自動修復 (Touch Timer)...`);
            await this.repo.updateUserActivity(conversationId);
            return null;
        }

        const lastActiveTime = new Date(lastActivityStr).getTime();
        if (isNaN(lastActiveTime)) {
            appLogger.warn(`[Cognition] 時間格式錯誤 (${lastActivityStr})，強制重置...`);
            await this.repo.updateUserActivity(conversationId);
            return null;
        }

        const now = Date.now();
        const idleTimeMinutes = (now - lastActiveTime) / (1000 * 60);

        appLogger.info(`[Cognition] Idle Check: ${idleTimeMinutes.toFixed(1)}m | User: ${conversationId}`);

        // 閒置超過 60 分鐘，且骰子命中 (30%) 則觸發小劇場
        if (idleTimeMinutes > 60) {
            if (Math.random() > 0.7) {
                return await this._runBackgroundChat(conversationId, state);
            }
        }
        
        return null;
    }

    /**
     * 執行閒置小劇場 (Background Chat)
     */
    async _runBackgroundChat(conversationId, state) {
        appLogger.info('[Cognition] 啟動閒置小劇場...');
        
        const context = {
            moodState: state,
            memoryContext: { factsText: "無" }, 
            ragMemories: ""
        };

        try {
            const responseChain = await groupChatService.runIdleChat(context, this.ltm);
            
            if (!responseChain || responseChain.length === 0) return null;

            const formattedMessages = responseChain.map(item => 
                `[SPEAKER:${item.speaker}]${item.content}`
            );

            const fullLog = formattedMessages.join('\n');
            await this._saveHistory(conversationId, "(System: Idle Trigger)", fullLog, { mode: 'group' });

            return { 
                channelId: conversationId,
                messages: formattedMessages,
                emotion: state.values,
                mode: 'group'
            };

        } catch (e) {
            appLogger.error('[Cognition] Idle chat failed:', e);
            return null;
        }
    }

    /**
     * 執行自我反思 (Self Reflection)
     * 每天午夜執行，總結過去 24 小時的記憶並生成洞見
     */
    async _performSelfReflection() {
        appLogger.info('[Cognition] 午夜反思啟動...');
        try {
            const recentMemories = await this.ltm.retrieve({ period: '24h', limit: 10 });
            
            if (!recentMemories || recentMemories.length === 0) {
                appLogger.info('[Cognition] 今日無新記憶，跳過反思。');
                return;
            }
            
            const reflectionPrompt = getSelfReflectionPrompt(recentMemories);
            
            // 使用 user role 發送指令以避免 API 錯誤
            const response = await this.client.chat.completions.create({
                model: MODEL_NAME, 
                messages: [{ role: 'user', content: reflectionPrompt }], 
                response_format: { type: "json_object" }
            });
            
            const content = response.choices[0].message.content;
            if (!content) return;

            const result = JSON.parse(content);
            
            if (result.insights && Array.isArray(result.insights)) {
                for (const insight of result.insights) {
                    await this.ltm.addReflection(insight.memory_id, insight.reflection_text);
                }
                appLogger.info(`[Cognition] 反思完成，生成了 ${result.insights.length} 條洞見。`);
            }
            
        } catch(e) { 
            appLogger.error('[Cognition] 反思失敗:', e); 
        }
    }

    // ============================================================
    // Repository Access Wrappers
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
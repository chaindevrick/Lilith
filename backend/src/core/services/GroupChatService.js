/**
 * src/core/services/GroupChatService.js
 * 群組對話編排器 (Full Autonomous Edition)
 */

import OpenAI from 'openai';
import { appLogger } from '../../config/logger.js';
import { 
    getGroupDirectorPrompt, 
    getGroupResponderPrompt,
    getIdleDirectorPrompt,
    getDemonSystemPrompt,
    getAngelSystemPrompt,
    getInteractionRulesPrompt
} from '../../config/prompts.js';

// 引入工具註冊中心
import { toolsDeclarations, executeTool } from '../tools/registry.js';

const MODEL_NAME = 'gemini-2.5-pro';
const MAX_TOOL_STEPS = 5; // 單回合最大思考步數

export class GroupChatService {
    constructor() {
        this.client = new OpenAI({ 
            apiKey: process.env.GEMINI_API_KEY, 
            baseURL: process.env.GEMINI_API_BASE_URL 
        });
    }

    /**
     * [User Triggered] 執行群組對話 (支援工具 + 視覺 + 記憶)
     * 當 User 說話時，由導演決定誰回應，並允許角色使用工具
     */
    async orchestrateConversation(userText, context, ltm, history = [], imageParts = []) {
        const { memoryContext } = context;

        // 1. 格式化短期記憶 (將 DB 的 JSON 陣列轉為 LLM 易讀的腳本)
        const recentContextStr = this._formatHistoryForLLM(history);

        // 2. 準備導演的上下文 (包含短期對話 + 長期記憶)
        const fullContextForDirector = `
**[近期對話紀錄]**
${recentContextStr}

**[長期記憶摘要]**
${memoryContext?.factsText || "無"}
`.trim();

        // 3. [Director] 決定劇本
        const directorPrompt = getGroupDirectorPrompt(userText, fullContextForDirector);
        
        let plan = ['demon']; // 預設方案
        try {
            const planRes = await this.client.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: 'user', content: directorPrompt }],
                temperature: 0.3,
                response_format: { type: "json_object" }
            });
            
            const rawContent = planRes.choices[0].message.content;
            const cleanJson = rawContent.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            if (Array.isArray(parsed)) {
                plan = parsed;
            } else if (parsed.plan && Array.isArray(parsed.plan)) {
                plan = parsed.plan;
            }
        } catch (e) {
            appLogger.warn('[GroupChat] Director failed, using default plan.', e);
        }

        appLogger.info(`[GroupChat] User: "${userText}" | Plan: ${JSON.stringify(plan)}`);

        // 4. [Execution Loop] 依序執行
        const responseChain = [];
        
        // 將「短期記憶」作為本輪對話的初始背景
        let turnHistory = recentContextStr; 

        for (const speaker of plan) {
            const result = await this._executeTurnWithTools(
                speaker,
                userText,   
                turnHistory, // 傳入累積的上下文
                context,
                ltm,
                imageParts   // [New] 傳入圖片
            );

            if (result) {
                responseChain.push(result);
                // 更新本輪歷史，讓下一個人格看到結果
                turnHistory += `\n[${result.speakerName}]: ${result.content}`;
            }
        }

        return responseChain;
    }

    /**
     * [System Triggered] 執行閒置/後台任務
     */
    async runIdleChat(context, ltm) {
        const { moodState } = context;

        // 1. [Director] 決定行動計畫
        const directorPrompt = getIdleDirectorPrompt(moodState);
        
        let plan = ['angel', 'demon'];
        let topic = "系統優化研究";

        try {
            const planRes = await this.client.chat.completions.create({
                model: MODEL_NAME,
                messages: [{ role: 'user', content: directorPrompt }],
                temperature: 0.5,
                response_format: { type: "json_object" }
            });
            
            const raw = JSON.parse(planRes.choices[0].message.content);
            if (raw.plan && Array.isArray(raw.plan)) plan = raw.plan;
            if (raw.topic) topic = raw.topic;
        } catch (e) {
            appLogger.warn('[GroupChat] Idle Director failed, using default.', e);
        }

        appLogger.info(`[Autonomous] Topic: ${topic}, Plan: ${JSON.stringify(plan)}`);

        // 2. [Execution Loop]
        const responseChain = [];
        const triggerText = `(自主行動開始) 我們來執行這個任務吧：${topic}`;
        let turnHistory = `(系統提示: 前輩不在。當前自主任務目標: ${topic})`;

        for (const speaker of plan) {
            const result = await this._executeTurnWithTools(
                speaker, 
                triggerText, 
                turnHistory, 
                context,
                ltm,
                [] // 閒置模式通常沒有圖片輸入
            );

            if (result) {
                responseChain.push(result);
                turnHistory += `\n[${result.speakerName}]: ${result.content}`;
            }
        }

        return responseChain;
    }

    /**
     * [Core Engine] 執行單一角色的回合 (支援 Function Calling & Vision)
     */
    async _executeTurnWithTools(speaker, userText, turnHistory, context, ltm, imageParts = []) {
        const isDemon = speaker.toLowerCase() === 'demon';
        const personaName = isDemon ? "Demon Lilith" : "Angel Lilith";

        // A. 準備 System Prompt
        const baseSys = isDemon 
            ? getDemonSystemPrompt(context) 
            : getAngelSystemPrompt(context);
        
        // B. 準備 Dynamic Instruction (包含對話流)
        const dynamicInstruction = getGroupResponderPrompt(
            personaName,
            userText,
            turnHistory
        );

        // [New] C. 構建 User Content (混合文字與圖片)
        let userContentPayload;
        if (imageParts && imageParts.length > 0) {
            userContentPayload = [
                { type: "text", text: dynamicInstruction }, 
                ...imageParts
            ];
        } else {
            userContentPayload = dynamicInstruction;
        }

        let messages = [
            { role: 'system', content: baseSys + "\n\n" + getInteractionRulesPrompt() },
            { role: 'user', content: userContentPayload }
        ];

        // D. 工具執行迴圈
        let finalContent = null;
        let step = 0;

        while (step < MAX_TOOL_STEPS) {
            try {
                const res = await this.client.chat.completions.create({
                    model: MODEL_NAME,
                    messages: messages,
                    tools: toolsDeclarations,
                    tool_choice: 'auto',
                    temperature: 0.7 
                });

                const msg = res.choices[0].message;
                messages.push(msg); 

                if (msg.tool_calls) {
                    appLogger.info(`[Action] ${personaName} calls tools: ${msg.tool_calls.length}`);
                    
                    for (const call of msg.tool_calls) {
                        try {
                            const args = JSON.parse(call.function.arguments);
                            appLogger.info(`  -> Tool: ${call.function.name} | Args: ${JSON.stringify(args)}`);
                            
                            const output = await executeTool(call.function.name, args);
                            
                            // [New] 寫入情節記憶 (Episodic Memory)
                            if (ltm) {
                                await ltm.record({ 
                                    type: 'tool_use', 
                                    action: call.function.name, 
                                    trigger: JSON.stringify(args), 
                                    result: String(output).slice(0, 200) 
                                }).catch(() => {});
                            }
                            
                            messages.push({
                                role: 'tool',
                                tool_call_id: call.id,
                                name: call.function.name,
                                content: String(output)
                            });

                        } catch (toolErr) {
                            messages.push({
                                role: 'tool',
                                tool_call_id: call.id,
                                name: call.function.name,
                                content: `Error: ${toolErr.message}`
                            });
                        }
                    }
                } else {
                    finalContent = msg.content;
                    break;
                }

            } catch (e) {
                appLogger.error(`[Autonomous] ${personaName} crashed during step ${step}`, e);
                return { speaker: isDemon ? 'demon' : 'angel', speakerName: personaName, content: "(系統錯誤: 運算中斷)" };
            }

            step++;
        }

        if (!finalContent) {
            finalContent = "(思考過久，行動終止)";
        }

        return {
            speaker: isDemon ? 'demon' : 'angel',
            speakerName: personaName,
            content: finalContent
        };
    }

    /**
     * [Helper] 將 DB 的 history 陣列轉換為 LLM 易讀的文本腳本
     */
    _formatHistoryForLLM(history) {
        if (!history || history.length === 0) return "(無近期對話)";
        
        return history.map(msg => {
            let roleLabel = "User";
            if (msg.role === 'assistant') {
                // 嘗試從 meta 判斷是誰說的
                if (msg.meta?.speaker === 'angel') roleLabel = "Angel Lilith";
                else if (msg.meta?.speaker === 'demon') roleLabel = "Demon Lilith";
                else roleLabel = "Lilith";
            }
            
            // 處理 [SPEAKER:xxx] 標籤 (過濾掉系統標記，讓 Prompt 更乾淨)
            let content = typeof msg.content === 'string' ? msg.content : "(Media Content)";
            if (content.includes('[SPEAKER:angel]')) {
                roleLabel = "Angel Lilith";
                content = content.replace(/\[SPEAKER:angel\]/g, '');
            } else if (content.includes('[SPEAKER:demon]')) {
                roleLabel = "Demon Lilith";
                content = content.replace(/\[SPEAKER:demon\]/g, '');
            }

            return `[${roleLabel}]: ${content}`;
        }).join('\n');
    }
}

export const groupChatService = new GroupChatService();
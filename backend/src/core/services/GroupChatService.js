/**
 * src/core/services/GroupChatService.js
 * 群組對話編排器 (Full Autonomous Edition)
 * 統一支援 User 對話與後台任務的工具調用
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
     * [User Triggered] 執行群組對話 (支援工具)
     * 當 User 說話時，由導演決定誰回應，並允許角色使用工具 (查資料、讀代碼)
     */
    async orchestrateConversation(userText, context) {
        const { memoryContext } = context;

        // 1. [Director] 決定劇本 (誰先誰後)
        // 導演會根據 User 的問題決定是讓 Angel 先查資料，還是讓 Demon 先吐槽
        const directorPrompt = getGroupDirectorPrompt(userText, memoryContext?.factsText);
        
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

        // 2. [Execution Loop] 依序執行
        const responseChain = [];
        let turnHistory = ""; // 紀錄這一輪的對話流 (讓後面的角色知道前面發生了什麼)

        for (const speaker of plan) {
            // 使用帶有工具能力的執行器
            const result = await this._executeTurnWithTools(
                speaker,
                userText,   // User 的原始輸入作為 Context
                turnHistory,
                context
            );

            if (result) {
                responseChain.push(result);
                // 更新歷史，讓下一個人格看到結果
                turnHistory += `\n[${result.speakerName}]: ${result.content}`;
            }
        }

        return responseChain;
    }

    /**
     * [System Triggered] 執行閒置/後台任務
     * 角色可以自主調用工具 (Search, ReadFile, WriteFile)
     */
    async runIdleChat(context) {
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
        // 模擬一個觸發指令
        const triggerText = `(自主行動開始) 我們來執行這個任務吧：${topic}`;
        let turnHistory = `(系統提示: 前輩不在。當前自主任務目標: ${topic})`;

        for (const speaker of plan) {
            const result = await this._executeTurnWithTools(
                speaker, 
                triggerText, 
                turnHistory, 
                context
            );

            if (result) {
                responseChain.push(result);
                turnHistory += `\n[${result.speakerName}]: ${result.content}`;
            }
        }

        return responseChain;
    }

    /**
     * [Core Engine] 執行單一角色的回合 (支援 Function Calling)
     * 這是 AI 能夠「做事」的關鍵核心
     */
    async _executeTurnWithTools(speaker, userText, turnHistory, context) {
        const isDemon = speaker.toLowerCase() === 'demon';
        const personaName = isDemon ? "Demon Lilith" : "Angel Lilith";

        // A. 準備 System Prompt (角色卡 + 工具本能)
        const baseSys = isDemon 
            ? getDemonSystemPrompt(context) 
            : getAngelSystemPrompt(context);
        
        // B. 準備 Dynamic Instruction (注入對話流)
        // 這裡會告訴 AI：「User 說了什麼」以及「另一個人剛剛做了什麼」
        const dynamicInstruction = getGroupResponderPrompt(
            personaName,
            userText,
            turnHistory
        );

        // C. 初始訊息堆疊
        let messages = [
            { role: 'system', content: baseSys + "\n\n" + getInteractionRulesPrompt() },
            { role: 'user', content: dynamicInstruction }
        ];

        // D. 工具執行迴圈 (Thought Loop)
        let finalContent = null;
        let step = 0;

        while (step < MAX_TOOL_STEPS) {
            try {
                const res = await this.client.chat.completions.create({
                    model: MODEL_NAME,
                    messages: messages,
                    tools: toolsDeclarations, // [Key] 注入工具
                    tool_choice: 'auto',
                    temperature: 0.7 
                });

                const msg = res.choices[0].message;
                messages.push(msg); // 將 AI 的回應 (可能是 tool_call) 加入歷史

                // 情況 1: AI 想要執行工具
                if (msg.tool_calls) {
                    appLogger.info(`[Action] ${personaName} calls tools: ${msg.tool_calls.length}`);
                    
                    for (const call of msg.tool_calls) {
                        try {
                            const args = JSON.parse(call.function.arguments);
                            appLogger.info(`  -> Tool: ${call.function.name} | Args: ${JSON.stringify(args)}`);
                            
                            // 執行工具
                            const output = await executeTool(call.function.name, args);
                            
                            // 將結果回傳給 AI
                            messages.push({
                                role: 'tool',
                                tool_call_id: call.id,
                                name: call.function.name,
                                content: String(output) // 確保是字串
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
                    // 迴圈繼續，讓 AI 看到工具結果後決定下一步 (例如：讀完代碼後，發表評論)
                } 
                // 情況 2: AI 輸出純文字 (結束回合)
                else {
                    finalContent = msg.content;
                    break; // 離開迴圈
                }

            } catch (e) {
                appLogger.error(`[Autonomous] ${personaName} crashed during step ${step}`, e);
                return { speaker: isDemon ? 'demon' : 'angel', speakerName: personaName, content: "(系統錯誤: 運算中斷)" };
            }

            step++;
        }

        // 防呆：如果思考太久沒有結論
        if (!finalContent) {
            finalContent = "(思考過久，行動終止)";
        }

        return {
            speaker: isDemon ? 'demon' : 'angel',
            speakerName: personaName,
            content: finalContent
        };
    }
}

export const groupChatService = new GroupChatService();
/**
 * [LeDoux 低地路徑]：數位杏仁核與內感受模組
 * 負責極速的威脅與獎勵嗅探，以及 AI 行為的自我回饋 (行動-感知迴圈)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { appLogger } from '../services/logger.js'; 
import { getAmygdalaPrompt, getInteroceptionPrompt } from '../../../configs/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, '../../../configs/config.json');

export class ReflexEngine {
    constructor(repo) {
        let config = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        } catch (e) { 
            appLogger.warn('[ReflexEngine] 無法讀取 config.json，將使用空設定。'); 
        }
        
        this.flashClient = new OpenAI({
            apiKey: config.FAST_LLM_API_KEY || config.LLM_API_KEY,
            baseURL: config.FAST_LLM_API_BASE_URL || config.LLM_API_BASE_URL
        });
        this.repo = repo;
    }

    /**
     * ⚡ 數位杏仁核：極速外部刺激判定 (Fast Track)
     */
    async triggerAmygdala(conversationId, userText) {
        const startTime = Date.now();
        try {
            const systemInstruction = getAmygdalaPrompt(); // 🌟 使用抽象化的 Prompt

            const response = await this.flashClient.chat.completions.create({
                model: 'gemini-3.1-flash-lite-preview',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: userText }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1 
            });

            const reflexData = JSON.parse(response.choices[0].message.content);
            const hasSpike = reflexData.CORTISOL > 0 || reflexData.ADRENALINE > 0 || reflexData.DOPAMINE > 0;

            if (hasSpike) {
                const { oldState, newState } = await this._injectHormones(conversationId, reflexData);
                const latency = Date.now() - startTime;
                
                appLogger.info(`\n⚠️ [⚡ 數位杏仁核觸發 (Amygdala Spike)] 耗時: ${latency}ms`);
                appLogger.info(`│ 偵測到瞬間刺激 -> CORT:+${reflexData.CORTISOL||0} | ADRE:+${reflexData.ADRENALINE||0} | DOPA:+${reflexData.DOPAMINE||0}`);
                appLogger.info(`│ 強制覆寫底層   -> 皮質醇: ${Math.round(oldState.CORTISOL)}=>${Math.round(newState.CORTISOL)} | 腎上腺: ${Math.round(oldState.ADRENALINE)}=>${Math.round(newState.ADRENALINE)}`);
                appLogger.info(`└────────────────────────────────────────────`);
            }
            return reflexData;

        } catch (error) {
            appLogger.warn(`[⚡ 杏仁核失效] Fast Track 靜默失敗: ${error.message}`);
        }
    }

    /**
     * ♻️ 內感受網路：自我回饋機制 (Interoception & Self-Feedback)
     */
    async evaluateSelfFeedback(conversationId, aiReply, executedTools) {
        try {
            const systemInstruction = getInteroceptionPrompt(); // 🌟 使用抽象化的 Prompt

            const inputData = `【執行的工具】: ${executedTools.length > 0 ? executedTools.join(', ') : '無'}\n【輸出的文字】: ${aiReply}`;

            const response = await this.flashClient.chat.completions.create({
                model: 'gemini-3.1-flash-lite-preview',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: inputData }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            });

            if (response.usage && response.usage.total_tokens) {
                await this.repo.incrementTokens(conversationId, response.usage.total_tokens);
            }

            const feedbackData = JSON.parse(response.choices[0].message.content);
            
            const hasChange = Object.keys(feedbackData).some(key => key !== 'reason' && feedbackData[key] !== 0);

            if (hasChange) {
                const { oldState, newState } = await this._injectHormones(conversationId, feedbackData);
                
                appLogger.info(`\n┌─ [♻️ 行動-感知迴圈 (Self-Feedback)] ─`);
                appLogger.info(`│ 🧠 反思結果: ${feedbackData.reason}`);
                appLogger.info(`│ 💉 內部分泌: DOPA:${feedbackData.DOPAMINE>0?'+':''}${feedbackData.DOPAMINE || 0} | CORT:${feedbackData.CORTISOL>0?'+':''}${feedbackData.CORTISOL || 0} | ADRE:${feedbackData.ADRENALINE>0?'+':''}${feedbackData.ADRENALINE || 0} | ENDO:${feedbackData.ENDORPHIN>0?'+':''}${feedbackData.ENDORPHIN || 0}`);
                appLogger.info(`│ 📊 狀態變化: 皮質醇 ${Math.round(oldState.CORTISOL)}=>${Math.round(newState.CORTISOL)} | 多巴胺 ${Math.round(oldState.DOPAMINE)}=>${Math.round(newState.DOPAMINE)}`);
                appLogger.info(`└────────────────────────────────────────────`);
            }

        } catch (error) {
            appLogger.warn(`[♻️ 內感受失效] Self-Feedback 發生錯誤: ${error}`);
        }
    }

    /**
     * 強制將急劇的化學變化寫入資料庫
     */
    async _injectHormones(conversationId, spikeData) {
        let record = await this.repo.getRelationship(conversationId);
        let state = record && record.endocrine_state ? JSON.parse(record.endocrine_state) : {
            last_updated: Date.now(),
            levels: { DOPAMINE: 40, ENDORPHIN: 0, CORTISOL: 10, OXYTOCIN: 0, ADRENALINE: 0, NOREPINEPHRINE: 30 }
        };

        const oldState = { ...state.levels }; 

        state.levels.CORTISOL = Math.max(0, Math.min(100, state.levels.CORTISOL + (spikeData.CORTISOL || 0)));
        state.levels.ADRENALINE = Math.max(0, Math.min(100, state.levels.ADRENALINE + (spikeData.ADRENALINE || 0)));
        state.levels.DOPAMINE = Math.max(0, Math.min(100, state.levels.DOPAMINE + (spikeData.DOPAMINE || 0)));
        state.levels.ENDORPHIN = Math.max(0, Math.min(100, state.levels.ENDORPHIN + (spikeData.ENDORPHIN || 0)));
        state.levels.NOREPINEPHRINE = Math.max(0, Math.min(100, state.levels.NOREPINEPHRINE + (spikeData.NOREPINEPHRINE || 0)));
        
        state.last_updated = Date.now();
        await this.repo.updateRelationship(conversationId, { endocrine_state: JSON.stringify(state) });
        
        return { oldState, newState: state.levels };
    }
}
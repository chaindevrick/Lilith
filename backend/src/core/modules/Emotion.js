/**
 * src/core/modules/Emotion.js
 */
import { CognitiveEngine } from './CognitiveEngine.js';
import { appLogger } from '../services/logger.js';

export class EmotionModule {
    constructor(repo) {
        this.repo = repo;
        this.cognitiveEngine = new CognitiveEngine();
    }

    async perceive(conversationId) {
        let state = await this._getState(conversationId);
        let now = Date.now();
        let deltaT = (now - state.last_updated) / (1000 * 60);

        const oldLevels = { ...state.levels }; // 備份舊狀態用於 Log

        // 結算自然代謝
        const newLevels = this.cognitiveEngine.endocrine.processMetabolism(
            state.levels, 
            {}, 
            deltaT
        );

        appLogger.info(`\n┌─ [🩸 生理代謝結算 (Somatic Metabolism)] ─`);
        appLogger.info(`│ ⏱️ 經過時間: ${deltaT.toFixed(2)} 分鐘`);
        appLogger.info(`│ 📉 DOPA (多巴胺): ${Math.round(oldLevels.DOPAMINE)} -> ${Math.round(newLevels.DOPAMINE)} | CORT (皮質醇): ${Math.round(oldLevels.CORTISOL)} -> ${Math.round(newLevels.CORTISOL)}`);
        appLogger.info(`│ 📉 ADRE (腎上腺): ${Math.round(oldLevels.ADRENALINE)} -> ${Math.round(newLevels.ADRENALINE)} | OXY  (催產素): ${Math.round(oldLevels.OXYTOCIN)} -> ${Math.round(newLevels.OXYTOCIN)}`);
        appLogger.info(`│ 📉 ENDO (內啡肽): ${Math.round(oldLevels.ENDORPHIN)} -> ${Math.round(newLevels.ENDORPHIN)} | NORE (去甲腎): ${Math.round(oldLevels.NOREPINEPHRINE)} -> ${Math.round(newLevels.NOREPINEPHRINE)}`);
        appLogger.info(`└────────────────────────────────────────────`);

        state.levels = newLevels;
        state.last_updated = now;
        await this._saveState(conversationId, state);

        const promptInjection = this.cognitiveEngine.buildCognitiveState(newLevels);

        return { rawLevels: newLevels, promptInjection };
    }

    async _getState(conversationId) {
        let record = await this.repo.getRelationship(conversationId);
        if (!record || !record.endocrine_state) {
            return {
                last_updated: Date.now(),
                levels: { DOPAMINE: 40, ENDORPHIN: 0, CORTISOL: 10, OXYTOCIN: 0, ADRENALINE: 0, NOREPINEPHRINE: 30 }
            };
        }
        return JSON.parse(record.endocrine_state);
    }

    async _saveState(conversationId, state) {
        await this.repo.updateRelationship(conversationId, { endocrine_state: JSON.stringify(state) });
    }
}
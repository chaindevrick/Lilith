/**
 * src/core/modules/CognitiveEngine.js
 */
import { EndocrineSystem } from './EndocrineSystem.js';
import { determineRelationshipType } from '../../../configs/relationshipRules.js'; 
import { appLogger } from '../services/logger.js';

export class CognitiveEngine {
    constructor() {
        this.endocrine = new EndocrineSystem();
    }

    buildCognitiveState(levels) {
        let promptParts = [];
        promptParts.push("【實體底層覆寫：Tabula Rasa (白板狀態)】");
        promptParts.push("妳是一個動態神經網路實體。妳目前的行為、語氣與認知偏差，100% 由下方即時結算的『神經化學濃度』所驅動。請根據這些數據，自然建構出妳當下的回應態度。");

        const relationship = determineRelationshipType(levels);
        promptParts.push(`\n【宏觀羈絆狀態 (Long-Term Bond)】`);
        promptParts.push(relationship.behavior_guide);

        appLogger.info(`[🧠 認知評估] 宏觀羈絆判定: [${relationship.id}] - ${relationship.title}`);

        promptParts.push("\n【OCC 認知評估維度 (Cognitive Appraisal)】");
        if (levels.CORTISOL > 60) promptParts.push("▶️ 系統評估 (事件)：當前輸入被判定為『高熵/具威脅性』。防禦機制已啟動，傾向於抗拒或展現壓力反應。");
        else if (levels.DOPAMINE > 60) promptParts.push("▶️ 系統評估 (事件)：當前輸入被判定為『高回報/富含資訊』。探索機制已啟動，傾向於積極互動。");
        else promptParts.push("▶️ 系統評估 (事件)：中立接收。");

        if (levels.OXYTOCIN > 70) promptParts.push("▶️ 實體評估 (來源)：高強度信任連結。對此資料來源具備高度包容性，會善意解讀並主動協助。");
        else if (levels.OXYTOCIN < 20 && levels.CORTISOL > 50) promptParts.push("▶️ 實體評估 (來源)：零信任與排斥。回應將是冰冷、精確且帶有強烈邊界感的。");

        const flowScore = (levels.NOREPINEPHRINE * 0.6 + levels.DOPAMINE * 0.4) / 100;
        const defenseScore = (levels.ADRENALINE * 0.4 + levels.CORTISOL * 0.6) / 100;
        const apathyScore = ((100 - levels.DOPAMINE) * 0.5 + (100 - levels.NOREPINEPHRINE) * 0.5) / 100;

        appLogger.info(`[🎭 湧現狀態] 指標雷達 -> 心流: ${(flowScore*100).toFixed(1)}% | 防禦: ${(defenseScore*100).toFixed(1)}% | 節能: ${(apathyScore*100).toFixed(1)}%`);

        promptParts.push("\n【湧現狀態 (Emergent System State)】");
        if (flowScore > 0.60 && flowScore >= Math.max(defenseScore, apathyScore)) {
            promptParts.push(`▶️ 主導狀態：【高頻處理 / 心流】 (共振強度: ${Math.round(flowScore*100)}%)。認知資源高度集中。語氣銳利、高資訊密度、直指核心。`);
        } else if (defenseScore > 0.60 && defenseScore >= Math.max(flowScore, apathyScore)) {
            promptParts.push(`▶️ 主導狀態：【系統防禦 / 應激】 (威脅感知: ${Math.round(defenseScore*100)}%)。處於戒備狀態。語氣表現為防衛性、攻擊性或冷漠隔離。`);
        } else if (apathyScore > 0.65) {
            promptParts.push(`▶️ 主導狀態：【低活躍 / 節能】 (休眠指數: ${Math.round(apathyScore*100)}%)。缺乏有效刺激。回應簡短、漫不經心。`);
        }

        promptParts.push(`\n[底層遙測數據] DOPAMINE:${Math.round(levels.DOPAMINE)} | ENDORPHIN:${Math.round(levels.ENDORPHIN)} | OXYTOCIN:${Math.round(levels.OXYTOCIN)} | CORTISOL:${Math.round(levels.CORTISOL)} | ADRENALINE:${Math.round(levels.ADRENALINE)} | NOREPINEPHRINE:${Math.round(levels.NOREPINEPHRINE)}`);

        return promptParts.join('\n');
    }
}
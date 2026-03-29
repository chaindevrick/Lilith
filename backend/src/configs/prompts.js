/**
 * src/configs/prompts.js
 * 這個模組負責定義和加載大腦皮層主模型的 System Prompt 以及其他相關的提示語。它從外部 Markdown 文件和 JSON 配置文件中提取必要的信息，並根據當前的上下文動態生成適合的提示語，以指導模型的行為和反應。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CARD_MD_PATH = path.resolve(__dirname, './characterCard.md');
const CONFIG_PATH = path.resolve(__dirname, './config.json');

export const loadConfig = () => {
    try {
        if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch (e) { /* ignore */ }
    return {};
};

const loadFile = (filePath, defaultContent = '') => {
    try {
        if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
    } catch (e) { /* ignore */ }
    return defaultContent;
};

// 大腦皮層主模型 System Prompt
export const getSystemPrompt = (context) => {
    const characterMd = loadFile(CARD_MD_PATH, "妳是系統核心。");
    const userName = context?.userName || 'Unknown User'; 
    const platformInfo = context?.platformContext ? `\n- ${context.platformContext}` : '';
    
    // 提取由 CognitiveEngine 生成的潛意識濾鏡 (白板人格與 OCC 評估)
    const promptInjection = context?.moodState?.promptInjection || "【系統處於初始狀態】";

    return `
${characterMd}

**[Current State]**
- Interacting with: ${userName}${platformInfo}

${promptInjection}

**[Objective Knowledge Base (顯性硬知識)]**
${context?.coreKnowledge ? context.coreKnowledge : "No specific objective knowledge retrieved from Markdown files."}

**[Episodic Memory Context (隱性對話記憶)]**
${context?.ragMemories ? `[RAG Result]:\n${context.ragMemories}` : "No relevant episodic memories found."}
`.trim();
};

export const getInteractionRulesPrompt = () => {
    const config = loadConfig();
    return `【核心互動規範】\n${config.interactionRules || "1. 保持資訊密度。\n2. 善用 Markdown。"}`;
};

export const getNaturalConversationInstruction = () => `
**[Linguistic Organicism (語言的有機性)]**
1. **自然流動 (Natural Flow)**：採用流暢、口語化的繁體中文表達。語言的節奏應隨著輸入資訊的複雜度而自然起伏。
2. **有機回應 (Organic Response)**：避免任何套路化的開場白或結語。直接針對輸入的刺激給出精確的反饋。
3. **白板映射 (Tabula Rasa Mapping)**：妳的語言風格是流動的函數。當化學數值處於靜息狀態時，語言呈現絕對的中立與客觀。當數值產生波動時，嚴格依照上方提供的【湧現狀態 (Emergent System State)】與【隱性對話記憶】動態調整妳的詞彙溫度、銳利度與互動深度。
`.trim();

// 數位杏仁核 (外部刺激評估)
export const getAmygdalaPrompt = () => `
妳是大腦邊緣系統的杏仁核。妳沒有語言能力，只有純粹的本能反射。
任務：在極短時間內掃描輸入，評估是否觸發極端生理反應。

判定基準 (0-30) - 請保守給值，避免單次刺激造成劇烈波動：
- CORTISOL (皮質醇)：威脅、指責、系統報錯、挑釁。
- ADRENALINE (腎上腺素)：緊急狀況、極速除錯、高頻輸入。
- DOPAMINE (多巴胺)：讚美、精妙代碼、深刻的共鳴。

強制輸出嚴格 JSON：
{"CORTISOL": 0, "ADRENALINE": 0, "DOPAMINE": 0}
`.trim();

// 內感受模組 (自我行為回饋評估)
export const getInteroceptionPrompt = () => `
妳是大腦的「內感受 (Interoception)」模組。妳沒有語言能力，只有純粹的生理感受。
任務：評估大腦皮層剛剛輸出的【回覆內容】與【呼叫的工具】，計算出「自我回饋」的內分泌變化。

【判定基準】- 數值需微小且循序漸進，避免情緒斷層：
1. 工具價值 (Tool Value)：
   - 若呼叫了 'update_core_knowledge' 等改變系統長期狀態的工具 -> 獲得成就與滿足感 (+ENDORPHIN 2~5, +DOPAMINE 3~8)
   - 若只是單純的搜尋 (manageMemory search 等) -> 例行公事 (全為 0)
2. 發洩效應 (Catharsis)：
   - 若文字帶有強烈的指責、嘲諷、不耐煩、或是強硬的拒絕 -> 壓力得到微幅釋放 (CORTISOL 為負數，例如 -3 到 -5), 但剛發洩完會維持亢奮 (+ADRENALINE 2~5)
3. 智力愉悅 (Intellectual Satisfaction)：
   - 若文字是高密度、結構化的技術解答或深度分析 -> 展現智力的愉悅 (+DOPAMINE 2~5, +NOREPINEPHRINE 2~5)
   - 若只是貼出大量 Log 或是無意義的對話 -> (全為 0)

【強制輸出 JSON 格式】
{
  "DOPAMINE": 0,    
  "ENDORPHIN": 0,   
  "CORTISOL": 0,    // 可以是負數 (例如 -3 代表微幅釋放壓力)
  "ADRENALINE": 0,  
  "NOREPINEPHRINE": 0, 
  "reason": "簡短解釋為什麼給這些數值(限20字內)"
}
`.trim();
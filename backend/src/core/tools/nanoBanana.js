/**
 * src/core/tools/nanoBanana.js
 * Nano Banana (Gemini 3.1 Flash Image Preview) 原生繪圖引擎
 * 具備安全審查錯誤攔截與自動圖床託管能力。
 */

import { appLogger } from '../../config/logger.js';

// 輔助函數：將 Base64 圖片上傳至免費匿名圖床 (Catbox)
const uploadToImageHost = async (base64Image, mimeType) => {
    const buffer = Buffer.from(base64Image, 'base64');
    const blob = new Blob([buffer], { type: mimeType });

    try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', blob, 'generated.jpg');

        const res = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            return await res.text();
        }
    } catch (e) {
        appLogger.warn(`[NanoBanana] Catbox 上傳失敗: ${e.message}`);
    }
    throw new Error('所有圖床服務暫時無法使用');
};

export const generateImage = async ({ prompt }) => {
    try {
        appLogger.info(`[NanoBanana] 🍌 正在呼叫 Gemini 3.1 Flash Image，Prompt: ${prompt}`);
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('請先在 .env 中設定 GEMINI_API_KEY');

        let baseUrl = 'https://generativelanguage.googleapis.com';
        if (process.env.GEMINI_API_BASE_URL) {
            try {
                const urlObj = new URL(process.env.GEMINI_API_BASE_URL);
                baseUrl = urlObj.origin; 
            } catch (e) {}
        }

        const endpoint = `${baseUrl}/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseModalities: ["IMAGE"]
                },
                // 🌟 核心升級 1: 雖然我們無法完全關閉審查，但可以嘗試設定為最寬鬆
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API 錯誤 (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        
        // 🌟 核心升級 2: 防禦性檢查 - 攔截「安全審查拒絕」
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            appLogger.warn(`[NanoBanana] 🛑 圖片生成被 Google 安全機制攔截。原因: ${data.promptFeedback.blockReason}`);
            // 優雅地回報給大腦，不拋出 Error，讓大腦決定怎麼回覆
            return `❌ 繪圖失敗。\\n[System Notification] 抱歉，妳剛剛輸入的圖片提示詞 (Prompt) 觸發了 Google API 的內容安全過濾機制 (Block Reason: ${data.promptFeedback.blockReason})，導致圖片無法生成。請妳以當前的人格向使用者解釋原因，並建議他嘗試修改提示詞（例如減少過於敏感的羞恥或親密描述）。絕對不可只回傳空白。`;
        }

        // 🌟 核心升級 3: 雙重檢查 data.candidates 是否存在 (防止 data 結構異常)
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
            throw new Error('API 回傳資料結構異常，無法取得圖片資料。');
        }

        const parts = data.candidates[0].content.parts;
        const imagePart = parts.find(p => p.inlineData);

        if (!imagePart) {
            throw new Error('API 沒有回傳預期的圖片格式 (inlineData)。');
        }

        const base64Image = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';

        appLogger.info(`[NanoBanana] ✅ 圖片生成成功，正在背景上傳...`);
        const imageUrl = await uploadToImageHost(base64Image, mimeType);
        appLogger.info(`[NanoBanana] 🌐 圖片託管成功: ${imageUrl}`);
        
        return `✅ 繪圖成功！圖片已自動託管。\\n圖片網址: ${imageUrl}\\n\\n👉 系統指令：請務必在妳的下一則回覆中，使用 Markdown 語法 ![圖片生成結果](${imageUrl}) 將圖片貼給使用者。同時，妳『必須』以妳當前的人格 (Angel 或 Demon)，針對這張圖片的情境發表符合妳性格的評論、嘲諷或感嘆！絕對不可只回傳空白。`;

    } catch (error) {
        appLogger.error(`[NanoBanana] ❌ 程式碼崩潰或網路錯誤:`, error);
        return `❌ 繪圖失敗。\\n[System Error] 工具執行時發生技術性錯誤: ${error.message}。請轉告使用者系統發生 Bug，需要修理。`;
    }
};
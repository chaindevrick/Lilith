/**
 * src/core/tools/nanoBanana.js
 * Nano Banana (Gemini 3.1 Flash Image Preview) 原生繪圖引擎
 * 負責將 LLM 的意圖轉換為圖像，並回傳前端可渲染的 Markdown 圖片標籤。
 */

import { appLogger } from '../../config/logger.js';

export const generateImage = async ({ prompt }) => {
    try {
        appLogger.info(`[NanoBanana] 🍌 正在呼叫 Gemini 3.1 Flash Image，Prompt: ${prompt}`);
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('請先在 .env 中設定 GEMINI_API_KEY');
        }

        // 智慧解析 Base URL (相容原生 Google API 與自訂代理)
        let baseUrl = 'https://generativelanguage.googleapis.com';
        if (process.env.GEMINI_API_BASE_URL) {
            try {
                const urlObj = new URL(process.env.GEMINI_API_BASE_URL);
                baseUrl = urlObj.origin; 
            } catch (e) {
                appLogger.warn('[NanoBanana] 無效的 GEMINI_API_BASE_URL，將使用預設官方端點。');
            }
        }

        // 呼叫官方 Nano Banana 2 (Gemini 3.1 Flash Image) REST API
        const endpoint = `${baseUrl}/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    // 關鍵設定：強制模型輸出圖片格式
                    responseModalities: ["IMAGE"]
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API 錯誤 (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        
        // 解析 Gemini API 回傳的 Base64 圖片 (inlineData)
        let base64Image = null;
        let mimeType = 'image/jpeg';

        if (data.candidates && data.candidates.length > 0) {
            const parts = data.candidates[0].content.parts;
            const imagePart = parts.find(p => p.inlineData);
            if (imagePart) {
                base64Image = imagePart.inlineData.data;
                mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
            }
        }

        if (!base64Image) {
            throw new Error('API 沒有回傳預期的圖片格式 (inlineData)。');
        }

        appLogger.info(`[NanoBanana] ✅ 圖片生成成功 (格式: ${mimeType})`);
        
        // 將 Base64 轉換為 Markdown 可渲染的 Data URI 格式
        const imageSource = `data:${mimeType};base64,${base64Image}`;
        
        return `[System Notification] 繪圖成功！請直接將以下 Markdown 語法原封不動地複製並回覆給使用者，讓他看見這張圖片：\n\n![${prompt}](${imageSource})`;

    } catch (error) {
        appLogger.error(`[NanoBanana] ❌ 圖片生成失敗:`, error);
        return `[System Error] 圖片生成失敗: ${error.message}。請告訴使用者繪圖引擎暫時故障。`;
    }
};
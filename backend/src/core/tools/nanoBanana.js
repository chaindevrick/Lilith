/**
 * src/core/tools/nanoBanana.js
 * Nano Banana (Gemini 3.1 Flash Image Preview) 原生繪圖引擎
 * 具備「自動圖床託管」能力，徹底解決 Token 爆炸與 400 錯誤。
 */

import { appLogger } from '../../config/logger.js';

// 將 Base64 圖片上傳至免費匿名圖床，回傳純網址
const uploadToImageHost = async (base64Image, mimeType) => {
    const buffer = Buffer.from(base64Image, 'base64');
    const blob = new Blob([buffer], { type: mimeType });

    try {
        // 首選：Catbox (永久免費匿名圖床)
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', blob, 'generated.jpg');

        const res = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            return await res.text(); // 回傳如: https://files.catbox.moe/xxxxx.jpg
        }
    } catch (e) {
        appLogger.warn(`[NanoBanana] Catbox 上傳失敗，嘗試備用圖床...`);
    }

    // 備用：Tmpfiles (24小時暫時圖床)
    try {
        const fallbackForm = new FormData();
        fallbackForm.append('file', blob, 'generated.jpg');
        
        const res2 = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            body: fallbackForm
        });
        
        const data = await res2.json();
        // tmpfiles 回傳的網址需加上 /dl/ 才是直連圖片
        return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    } catch (e) {
        throw new Error('所有圖床服務暫時無法使用');
    }
};

export const generateImage = async ({ prompt }) => {
    try {
        appLogger.info(`[NanoBanana] 🍌 正在呼叫 Gemini 3.1 Flash Image，Prompt: ${prompt}`);
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('請先在 .env 中設定 GEMINI_API_KEY');
        }

        let baseUrl = 'https://generativelanguage.googleapis.com';
        if (process.env.GEMINI_API_BASE_URL) {
            try {
                const urlObj = new URL(process.env.GEMINI_API_BASE_URL);
                baseUrl = urlObj.origin; 
            } catch (e) {
                appLogger.warn('[NanoBanana] 無效的 GEMINI_API_BASE_URL，將使用預設官方端點。');
            }
        }

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
                    responseModalities: ["IMAGE"]
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`API 錯誤 (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        
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

        appLogger.info(`[NanoBanana] ✅ 圖片生成成功，正在背景上傳至雲端以節省 Token...`);
        
        // 不上傳 2MB 的亂碼給 LLM，而是上傳到圖床拿網址
        const imageUrl = await uploadToImageHost(base64Image, mimeType);
        
        appLogger.info(`[NanoBanana] 🌐 圖片託管成功: ${imageUrl}`);
        
        // 回傳極度輕量的短網址給 Lilith
        return `✅ 繪圖成功！圖片已自動託管。\n圖片網址: ${imageUrl}\n\n👉 系統指令：請務必在妳的下一則回覆中，使用 Markdown 語法 ![圖片生成結果](${imageUrl}) 將圖片貼給使用者。同時，妳『必須』以妳當前的人格 (Angel 或 Demon)，針對這張圖片的情境發表符合妳性格的評論、嘲諷或感嘆！絕對不可只回傳空白。`;
    } catch (error) {
        appLogger.error(`[NanoBanana] ❌ 圖片生成失敗:`, error);
        return `[System Error] 圖片生成失敗: ${error.message}。請告訴使用者繪圖引擎或圖床暫時故障。`;
    }
};
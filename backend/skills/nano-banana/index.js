import path from 'path';

const uploadToImageHost = async (base64Image, mimeType) => {
    const buffer = Buffer.from(base64Image, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', blob, 'generated.jpg');
    const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
    if (res.ok) return await res.text();
    throw new Error('圖床暫時無法使用');
};

export default {
    // 🌟 接收注入的 config
    run: async ({ prompt }, config) => {
        if (['r18', 'nsfw', 'sex', 'nude'].some(kw => prompt.toLowerCase().includes(kw))) return "❌ 阻斷：包含敏感詞。請改用文字描繪。";
        try {
            // 🌟 OpenClaw 格式優先，無則 Fallback
            const apiKey = config.skills?.entries?.['nano-banana']?.env || {};

            if (!apiKey) throw new Error('GEMINI_API_KEY 未設定');

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`;
            const response = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: { responseModalities: ["IMAGE"] }
                })
            });
            const data = await response.json();
            const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (!imagePart) throw new Error('API 沒回傳圖片');
            
            const imageUrl = await uploadToImageHost(imagePart.inlineData.data, imagePart.inlineData.mimeType);
            return `✅ 繪圖成功！\n👉 請在回覆中使用標籤： <lilith-img src="${imageUrl}"></lilith-img>`;
        } catch (error) { return `❌ 繪圖失敗: ${error.message}`; }
    }
};
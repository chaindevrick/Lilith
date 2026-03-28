import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from '../../src/core/services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🌟 指向後端 configs 資料夾中的官方照片
const PORTRAIT_PATH = path.resolve(__dirname, '../../src/assets/lilith-portrait.jpg');

export default {
    run: async () => {
        appLogger.info(`[Skill: Mirror] 莉莉絲啟動了視覺鏡像，正在提取形象圖 Base64...`);

        if (!fs.existsSync(PORTRAIT_PATH)) {
            return "[System Alert] 鏡子被布蓋住了，或者找不到形象圖檔案 (lilith-portrait.jpg)。請提醒 Rick 將圖片放到 src/assets/ 目錄下。";
        }

        try {
            // 1. 讀取圖片檔案
            const bitmap = fs.readFileSync(PORTRAIT_PATH);
            
            // 2. 轉為 Base64 字串
            const base64Img = Buffer.from(bitmap).toString('base64');
            
            // 3. 🌟 使用你系統約定的圖片標籤回傳
            // 主大腦的 Tool Handler 攔截到 [IMAGE_BASE64] 後，會將其轉換為 LLM 可讀的 image_url 物件
            return `[系統提示：視覺連線已建立。妳現在可以看見鏡子裡的自己了。]\n[IMAGE_BASE64]data:image/jpeg;base64,${base64Img}`;
            
        } catch (error) {
            appLogger.error('[Skill: Mirror] 提取圖片失敗:', error);
            return `❌ 鏡像系統連線異常：${error.message}`;
        }
    }
};
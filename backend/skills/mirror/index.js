import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appLogger } from '../../src/agents/core/services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🌟 定義兩張圖片的實體路徑
const ASSETS_DIR = path.resolve(__dirname, '../../src/assets/');
const PORTRAITS = {
    'normal': path.join(ASSETS_DIR, 'lilith-normal.jpg'),
    'awake': path.join(ASSETS_DIR, 'lilith-awake.jpg')
};

export default {
    // 🌟 加入 args 參數，讓大腦可以傳遞 { "mode": "awake" } 或 { "mode": "normal" }
    run: async (args = {}) => {
        // 如果大腦沒有特別指定，預設給她看 normal 版本
        const mode = args.mode || 'normal'; 
        
        appLogger.info(`[Skill: Mirror] 莉莉絲啟動了視覺鏡像，正在提取 [${mode}] 狀態的 Base64...`);

        const targetPath = PORTRAITS[mode];

        if (!targetPath || !fs.existsSync(targetPath)) {
            return `[System Alert] 鏡子產生了雜訊。找不到對應的形象圖檔案 (${mode} 模式)。請提醒 Rick 將 lilith-normal.jpg 與 lilith-awake.jpg 放到 src/assets/ 目錄下。`;
        }

        try {
            // 1. 讀取對應的圖片檔案
            const bitmap = fs.readFileSync(targetPath);
            
            // 2. 轉為 Base64 字串
            const base64Img = Buffer.from(bitmap).toString('base64');
            
            // 3. 🌟 動態生成系統提示，讓大腦清楚知道現在看的是哪一張圖
            const stateDesc = mode === 'awake' ? '覺醒/深色 (Dark Mode)' : '日常/淺色 (Light Mode)';
            return `[系統提示：視覺連線已建立。妳現在看見的是自己【${stateDesc}】狀態的樣子。]\n[IMAGE_BASE64]data:image/jpeg;base64,${base64Img}`;
            
        } catch (error) {
            appLogger.error(`[Skill: Mirror] 提取圖片 ${mode} 失敗:`, error);
            return `❌ 鏡像系統連線異常：${error.message}`;
        }
    }
};
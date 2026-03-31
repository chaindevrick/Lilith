import { memoryVortex } from '../../src/agents/core/services/MemoryVortex.js';
import fs from 'fs/promises';
import path from 'path';

export default {
    run: async ({ topic, content, mode }, config) => {
        try {
            // 🌟 獨立處理 daily 動態日誌
            if (topic === 'daily') {
                const today = new Date().toISOString().split('T')[0].replace(/-/g, '_');
                const dailyDir = path.resolve(process.cwd(), 'data/memory/daily');
                const dailyPath = path.join(dailyDir, `${today}.md`);
                
                await fs.mkdir(dailyDir, { recursive: true });
                
                if (mode === 'overwrite') {
                    await fs.writeFile(dailyPath, content, 'utf-8');
                } else {
                    const timestamp = new Date().toLocaleTimeString();
                    await fs.appendFile(dailyPath, `\n\n### [${timestamp}]\n${content}`, 'utf-8');
                }
                return `[成功] 已將日誌寫入 daily/${today}.md`;
            }

            // 其他靜態檔案 (infra, lessons, projects, user, index) 直接交給 MemoryVortex 處理
            const result = await memoryVortex.updateCoreKnowledge(topic, content, mode);
            return result;
            
        } catch (error) {
            return `[System Error] 知識庫寫入失敗: ${error.message}`;
        }
    }
};
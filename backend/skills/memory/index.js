import { memoryVortex } from '../../src/core/services/MemoryVortex.js';

export default {
    run: async ({ topic, content, mode }, config) => {
        try {
            // 直接呼叫 MemoryVortex 的實體檔案寫入功能
            const result = await memoryVortex.updateCoreKnowledge(topic, content, mode);
            return result;
        } catch (error) {
            return `[System Error] 知識庫寫入失敗: ${error.message}`;
        }
    }
};
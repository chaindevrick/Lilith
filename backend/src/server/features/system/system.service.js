import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../../');
const CONFIG_DIR = path.resolve(PROJECT_ROOT, 'src/configs');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const SKILLS_DIR = path.resolve(PROJECT_ROOT, 'skills');
const MEMORY_DIR = path.resolve(PROJECT_ROOT, 'data/memory');

export const systemService = {
    // 初始化核心記憶檔案
    _initMemoryFiles: () => {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });

        const ensureFile = (p, defaultContent = '') => {
            if (!fs.existsSync(p)) fs.writeFileSync(p, defaultContent, 'utf-8');
        };

        ensureFile(path.join(CONFIG_DIR, 'user.md'), '# 使用者核心記憶\n\n## 👤 基本資料\n- 姓名: User(undefined)');
        ensureFile(path.join(MEMORY_DIR, 'memory.md'), '# 記憶索引 (Memory Index)\n\n這是一個引導莉莉絲檢索長期記憶的索引文件。');
    },

    getSettings: () => {
        systemService._initMemoryFiles();
        let config = {};
        if (fs.existsSync(CONFIG_PATH)) config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        
        const getFile = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
        
        return {
            ...config,
            characterCard: getFile(path.join(CONFIG_DIR, 'characterCard.md')),
            userMemory: getFile(path.join(CONFIG_DIR, 'user.md')),
            memoryIndex: getFile(path.join(MEMORY_DIR, 'memory.md')),
        };
    },

    updateSettings: (body) => {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        let existingConfig = {};
        if (fs.existsSync(CONFIG_PATH)) existingConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        
        const selectedModel = body.llmModel || existingConfig.llmModel || '';
        let autoApiBaseUrl = body.LLM_API_BASE_URL || existingConfig.LLM_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
        if (selectedModel.startsWith('gpt')) autoApiBaseUrl = 'https://api.openai.com/v1/';
        else if (selectedModel.startsWith('claude')) autoApiBaseUrl = 'https://api.anthropic.com/v1/';
        else if (selectedModel === 'lm-studio') autoApiBaseUrl = 'http://localhost:1234/v1/';

        const selectedVectorModel = body.vectorModel || existingConfig.vectorModel || 'gemini-embedding-2-preview';
        let vectorApiBaseUrl = body.LTM_LLM_API_BASE_URL || existingConfig.LTM_LLM_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/';
        if (selectedVectorModel.startsWith('text-embedding')) vectorApiBaseUrl = 'https://api.openai.com/v1/';
        else if (selectedVectorModel === 'lm-studio') vectorApiBaseUrl = 'http://localhost:1234/v1/';
        else vectorApiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'; 

        const newConfig = {
            ...existingConfig, 
            llmModel: selectedModel,
            fastModel: body.fastModel || existingConfig.fastModel,
            vectorModel: selectedVectorModel,
            
            LLM_API_KEY: body.LLM_API_KEY || existingConfig.LLM_API_KEY,
            FAST_LLM_API_KEY: body.FAST_LLM_API_KEY || existingConfig.FAST_LLM_API_KEY,
            LTM_LLM_API_KEY: body.LTM_LLM_API_KEY || existingConfig.LTM_LLM_API_KEY,
            
            // 寫入自動判定或手動輸入的 URL
            LLM_API_BASE_URL: autoApiBaseUrl,
            LTM_LLM_API_BASE_URL: vectorApiBaseUrl,
            
            interactionRules: body.interactionRules || existingConfig.interactionRules,
            conversationStyle: body.conversationStyle || existingConfig.conversationStyle,
            
            generalSettings: body.generalSettings || existingConfig.generalSettings || {},
            bots: body.bots || existingConfig.bots || []
        };

        // 獨立映射 Token 給 Worker 使用
        if (Array.isArray(body.bots)) {
            body.bots.forEach(b => {
                const token = b.enabled ? b.apiKey : '';
                if (b.platform === 'discord') newConfig.DISCORD_BOT_TOKEN = token;
                if (b.platform === 'telegram') newConfig.TELEGRAM_BOT_TOKEN = token;
            });
        }

        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
        
        // 寫入實體檔案
        if (body.characterCard !== undefined) fs.writeFileSync(path.join(CONFIG_DIR, 'characterCard.md'), body.characterCard, 'utf-8');
        if (body.userMemory !== undefined) fs.writeFileSync(path.join(CONFIG_DIR, 'user.md'), body.userMemory, 'utf-8');
    },

    getAvailableSkills: () => {
        if (!fs.existsSync(SKILLS_DIR)) return [];
        const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
        const availableSkills = [];
        
        for (const dirName of dirs) {
            const manifestPath = path.join(SKILLS_DIR, dirName, 'manifest.json');
            const skillMdPath = path.join(SKILLS_DIR, dirName, 'SKILL.md');
            let name = dirName, description = '無說明 (未提供 description)。', isSystem = false;

            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    if (manifest.name) name = manifest.name;
                    if (manifest.description) description = manifest.description;
                    if (manifest.system === true) isSystem = true;
                } catch(e){}
            }
            if (fs.existsSync(skillMdPath)) {
                const mdContent = fs.readFileSync(skillMdPath, 'utf-8');
                const nameMatch = mdContent.match(/^name:\s*(.+)$/im);
                const descMatch = mdContent.match(/^description:\s*(.+)$/im);
                const sysMatch = mdContent.match(/^system:\s*(true|false)$/im);
                if (nameMatch) name = nameMatch[1].trim();
                if (descMatch) description = descMatch[1].trim();
                if (sysMatch && sysMatch[1].trim().toLowerCase() === 'true') isSystem = true;
            }
            availableSkills.push({ id: dirName, name, desc: description, isSystem });
        }
        return availableSkills;
    }
};
/**
 * src/core/services/SkillRegistry.js
 * 技能註冊與派發中心 (Skill Registry)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { appLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.resolve(__dirname, '../../../skills');
const CONFIG_PATH = path.resolve(__dirname, '../../configs/config.json');

class SkillRegistry {
    constructor() {
        this.skills = new Map(); 
        this.declarations = [];  
        this.instructions = [];  
    }

    _getConfig() {
        try {
            if (fs.existsSync(CONFIG_PATH)) return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        } catch (e) {} // 靜默失敗，使用預設值
        return { skills: { allowBundled: [], entries: {} } };
    }

    async loadAllSkills() {
        this.skills.clear();
        this.declarations = [];
        this.instructions = [];

        if (!fs.existsSync(SKILLS_DIR)) return;

        const config = this._getConfig();
        const allowedSkills = config.skills?.allowBundled || [];
        const skillEntries = config.skills?.entries || {};

        appLogger.info(`[SkillRegistry] 準備載入: [${allowedSkills.join(', ')}]`);

        for (const dirName of allowedSkills) {
            const skillPath = path.join(SKILLS_DIR, dirName);
            if (!fs.existsSync(skillPath)) continue;

            const manifestPath = path.join(skillPath, 'manifest.json');
            const indexPath = path.join(skillPath, 'index.js');
            const mdPath = path.join(skillPath, 'SKILL.md');

            if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) continue;

            try {
                // 1. 載入並解析 Manifest (相容單一物件與陣列)
                const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                const manifests = Array.isArray(rawManifest) ? rawManifest : [rawManifest];

                // 2. 載入執行邏輯
                const fileUrl = pathToFileURL(indexPath).href;
                const module = await import(fileUrl);

                // 3. 載入說明手冊
                let instructions = '';
                if (fs.existsSync(mdPath)) {
                    instructions = fs.readFileSync(mdPath, 'utf8').replace(/^(name|description|system):\s*.*$/gim, '').trim();
                }

                for (let i = 0; i < manifests.length; i++) {
                    const manifest = manifests[i];
                    const functionName = manifest.name;

                    // 🌟 核心修復：直接在此處封裝成 OpenAI 嚴格要求的終極格式
                    const safeParams = manifest.parameters || { type: "object", properties: {} };
                    if (Array.isArray(safeParams.required) && safeParams.required.length === 0) {
                        delete safeParams.required; // 移除空陣列防報錯
                    }

                    this.declarations.push({
                        type: 'function',
                        function: {
                            name: functionName,
                            description: manifest.description || "No description provided.",
                            parameters: safeParams
                        }
                    });

                    if (instructions) {
                        this.instructions.push(`【Tool: ${functionName}】\n${instructions}`);
                    }
                    
                    // 綁定對應的 run 函數 (相容多入口與單一入口寫法)
                    let runFunc = module.default.run;
                    if (Array.isArray(module.default) && module.default[i]) {
                        runFunc = module.default[i].run;
                    }
                    
                    if (typeof runFunc !== 'function') throw new Error(`缺少 run 函數`);

                    this.skills.set(functionName, { 
                        run: runFunc, 
                        entryConfig: skillEntries[dirName] || {} 
                    });
                }
                appLogger.info(`[SkillRegistry] 載入成功: ${dirName}`);
            } catch (error) {
                appLogger.error(`[SkillRegistry] 載入 ${dirName} 失敗: ${error.message}`);
            }
        }
    }

    getDeclarations() {
        return this.declarations;
    }

    getSkillInstructions() {
        if (this.instructions.length === 0) return "";
        return "【已掛載的系統技能與使用規範】\n" + this.instructions.join('\n\n');
    }

    async executeTool(functionName, args) {
        const skill = this.skills.get(functionName);
        if (!skill) return `[Error] 工具 '${functionName}' 不存在。`;

        try {
            return await skill.run(args, this._getConfig(), skill.entryConfig);
        } catch (error) {
            return `[Error] 執行失敗: ${error.message}`;
        }
    }
}

export const skillRegistry = new SkillRegistry();
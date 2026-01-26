/**
 * src/core/services/ProjectScanner.js
 * 全知掃描器 (Omniscient Scanner)
 * 負責掃描專案結構、分析檔案依賴關係與影響範圍 (Impact Analysis)。
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { appLogger } from '../../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

class ProjectScanner {
    
    /**
     * 分析專案或特定檔案
     * @param {string|null} targetFile - 指定要分析的目標檔案路徑 (可選)
     * @returns {Promise<Object>} 分析上下文 (結構、依賴、影響範圍)
     */
    async analyze(targetFile = null) {
        try {
            // 1. 掃描 src 和 share 目錄下的 js 檔案
            const fileMap = await glob('{src,share}/**/*.js', { 
                cwd: ROOT_DIR,
                ignore: ['**/node_modules/**', '**/backups/**', '**/logs/**', '**/data/**']
            });

            // 2. 構建依賴圖譜
            const dependencyGraph = await this._buildDependencyGraph(fileMap);
            
            // 3. 準備基礎上下文
            let context = {
                structure: this._formatStructure(fileMap),
                dependencies: await this._getPkgDependencies(),
                targetAnalysis: null
            };

            // 4. 若有指定目標，進行深入影響分析
            if (targetFile) {
                context.targetAnalysis = this._analyzeFileImpact(targetFile, dependencyGraph);
            }

            return context;
        } catch (error) {
            appLogger.error('[ProjectScanner] Analysis failed:', error);
            return { error: error.message };
        }
    }

    /**
     * 生成文字版分析報告 (供 LLM 閱讀)
     * @param {string} targetFile 
     */
    async generateReport(targetFile) {
        try {
            const context = await this.analyze(targetFile);
            
            if (context.error) return `[System Error] Scan failed: ${context.error}`;
            
            const impact = context.targetAnalysis;
            if (typeof impact === 'string') return `[System Alert] Analysis failed: ${impact}`;
            if (!impact) return `[System Alert] Target file not found: ${targetFile}`;
            return `
### Omniscient Code Analysis Report
--------------------------------------------------
**Target File**: \`${impact.file}\`
**Risk Level**: ${impact.riskLevel}
**Impact Metrics**: Imported By ${impact.importedBy.length} (Upstream) | Imports ${impact.imports.length} (Downstream)

#### 1. Upstream Dependencies (Who relies on this?)
${impact.importedBy.length ? impact.importedBy.map(f => `- ${f}`).join('\n') : "(None - Safe to modify)"}

#### 2. Downstream Dependencies (What does this rely on?)
${impact.imports.length ? impact.imports.map(f => `- ${f}`).join('\n') : "(None - Standalone module)"}
--------------------------------------------------
`.trim();
        } catch (e) {
            return `[System Error] Report generation failed: ${e.message}`;
        }
    }

    // ============================================================
    // Private Helpers
    // ============================================================

    async _buildDependencyGraph(files) {
        const graph = {};        
        const reverseGraph = {}; 

        files.forEach(f => { graph[f] = []; reverseGraph[f] = []; });

        await Promise.all(files.map(async (file) => {
            try {
                const content = await fs.readFile(path.join(ROOT_DIR, file), 'utf-8');
                const rawImports = this._extractImports(content);
                
                const resolvedImports = rawImports
                    .map(imp => this._resolveImportPath(file, imp, files))
                    .filter(Boolean); 

                graph[file] = resolvedImports;

                resolvedImports.forEach(target => {
                    if (reverseGraph[target]) {
                        reverseGraph[target].push(file);
                    }
                });
            } catch (e) {
                // 讀取失敗通常略過即可 (可能是權限或檔案被刪除)
            }
        }));

        return { graph, reverseGraph };
    }

    _resolveImportPath(currentFile, importPath, allFiles) {
        // 忽略 node_modules 或絕對路徑引用，只追蹤專案內相對路徑
        if (!importPath.startsWith('.')) return null; 

        try {
            const currentDir = path.dirname(path.join(ROOT_DIR, currentFile));
            const absoluteTarget = path.resolve(currentDir, importPath);
            
            let relativeTarget = path.relative(ROOT_DIR, absoluteTarget);
            // 統一分隔符
            relativeTarget = relativeTarget.split(path.sep).join('/');

            if (!relativeTarget.endsWith('.js')) {
                relativeTarget += '.js';
            }

            return allFiles.includes(relativeTarget) ? relativeTarget : null;
        } catch (e) {
            return null;
        }
    }

    _extractImports(content) {
        const regex = /import\s+(?:[\w\s{},*]*\s+from\s+)?['"]([^'"]+)['"]/g;
        let matches;
        const imports = [];
        while ((matches = regex.exec(content)) !== null) {
            imports.push(matches[1]);
        }
        return imports;
    }

    _analyzeFileImpact(targetFile, { graph, reverseGraph }) {
        // 模糊比對檔案路徑 (因為 targetFile 可能只是檔名或部分路徑)
        const normalizedTarget = Object.keys(graph).find(f => f.endsWith(targetFile));
        
        if (!normalizedTarget) return `Target file '${targetFile}' not found in scan results.`;

        const imports = graph[normalizedTarget] || [];
        const importedBy = reverseGraph[normalizedTarget] || [];

        // 風險評估邏輯
        let risk = 'LOW';
        if (importedBy.some(f => f.includes('main.js') || f.includes('worker.js'))) {
            risk = 'CRITICAL'; // 直接被核心入口引用
        } else if (importedBy.some(f => f.includes('core/'))) {
            risk = 'HIGH';     // 被核心模組引用
        } else if (importedBy.length > 5) {
            risk = 'MEDIUM';   // 影響範圍廣
        }

        return {
            file: normalizedTarget,
            imports,
            importedBy,
            riskLevel: risk
        };
    }

    _formatStructure(files) {
        return files.map(f => `- ${f}`).join('\n');
    }

    async _getPkgDependencies() {
        try {
            const pkgPath = path.join(ROOT_DIR, 'package.json');
            const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
            return Object.keys({ ...pkg.dependencies }).join(', ');
        } catch (e) { return "無法讀取 package.json"; }
    }
}

export const projectScanner = new ProjectScanner();
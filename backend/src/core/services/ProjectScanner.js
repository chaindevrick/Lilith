/**
 * src/core/services/ProjectScanner.js
 * 全知掃描器 (Omniscient Scanner) - 多語言支援版
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
    
    async analyze(targetFile = null) {
        try {
            // 1. 支援 js, ts, py, go
            const fileMap = await glob('**/*.{js,ts,py,go}', { 
                cwd: ROOT_DIR,
                ignore: [
                    '**/node_modules/**', 
                    '**/backups/**', 
                    '**/logs/**', 
                    '**/data/**',
                    '**/.git/**',
                    '**/public/**'
                ]
            });

            const dependencyGraph = await this._buildDependencyGraph(fileMap);
            
            let context = {
                structure: this._formatStructure(fileMap),
                dependencies: await this._getPkgDependencies(),
                targetAnalysis: null
            };

            if (targetFile) {
                context.targetAnalysis = this._analyzeFileImpact(targetFile, dependencyGraph);
            }

            return context;
        } catch (error) {
            appLogger.error('[ProjectScanner] Analysis failed:', error);
            return { error: error.message };
        }
    }

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
    // Private Helpers (Polyglot Support)
    // ============================================================

    async _buildDependencyGraph(files) {
        const graph = {};        
        const reverseGraph = {}; 

        files.forEach(f => { graph[f] = []; reverseGraph[f] = []; });

        await Promise.all(files.map(async (file) => {
            try {
                const content = await fs.readFile(path.join(ROOT_DIR, file), 'utf-8');
                const ext = path.extname(file);
                const rawImports = this._extractImports(content, ext);
                
                const resolvedImports = rawImports
                    .map(imp => this._resolveImportPath(file, imp, files, ext))
                    .filter(Boolean); 

                graph[file] = resolvedImports;

                resolvedImports.forEach(target => {
                    if (reverseGraph[target]) reverseGraph[target].push(file);
                });
            } catch (e) {
                // Ignore read errors
            }
        }));

        return { graph, reverseGraph };
    }

    _extractImports(content, ext) {
        const imports = [];
        if (ext === '.py') {
            // Python: import os, from os import path
            const pyRegex = /(?:^|\n)\s*(?:from|import)\s+([a-zA-Z0-9_.]+)/g;
            let match;
            while ((match = pyRegex.exec(content)) !== null) imports.push(match[1]);
        } else if (ext === '.go') {
            // Go: import "fmt", import ( "fmt" )
            const goRegex = /"([^"]+)"/g;
            // 簡化處理：直接抓取檔案內所有雙引號字串，後續靠 resolve 過濾有效檔案
            let match;
            while ((match = goRegex.exec(content)) !== null) {
                if (!match[1].includes(' ')) imports.push(match[1]);
            }
        } else {
            // JS / TS: import { x } from 'y', import 'z'
            const jsRegex = /import\s+(?:[\w\s{},*]*\s+from\s+)?['"]([^'"]+)['"]/g;
            let match;
            while ((match = jsRegex.exec(content)) !== null) imports.push(match[1]);
        }
        return [...new Set(imports)];
    }

    _resolveImportPath(currentFile, importPath, allFiles, ext) {
        if (ext === '.py' || ext === '.go') {
            // Py/Go 的模組解析較複雜，這裡使用模糊比對專案內檔案
            const normalized = importPath.replace(/\./g, '/');
            return allFiles.find(f => f.includes(normalized) || f.includes(importPath)) || null;
        }

        // JS / TS 解析邏輯
        if (!importPath.startsWith('.')) return null; 
        try {
            const currentDir = path.dirname(path.join(ROOT_DIR, currentFile));
            const absoluteTarget = path.resolve(currentDir, importPath);
            let relativeTarget = path.relative(ROOT_DIR, absoluteTarget).split(path.sep).join('/');

            if (!path.extname(relativeTarget)) relativeTarget += ext; // 自動補上 .js 或 .ts
            return allFiles.includes(relativeTarget) ? relativeTarget : null;
        } catch (e) {
            return null;
        }
    }

    _analyzeFileImpact(targetFile, { graph, reverseGraph }) {
        const normalizedTarget = Object.keys(graph).find(f => f.endsWith(targetFile));
        if (!normalizedTarget) return `Target file '${targetFile}' not found in scan results.`;

        const imports = graph[normalizedTarget] || [];
        const importedBy = reverseGraph[normalizedTarget] || [];

        let risk = 'LOW';
        if (importedBy.some(f => f.includes('main.') || f.includes('worker.'))) {
            risk = 'CRITICAL';
        } else if (importedBy.some(f => f.includes('core/'))) {
            risk = 'HIGH';     
        } else if (importedBy.length > 5) {
            risk = 'MEDIUM';   
        }

        return { file: normalizedTarget, imports, importedBy, riskLevel: risk };
    }

    _formatStructure(files) { return files.map(f => `- ${f}`).join('\n'); }

    async _getPkgDependencies() {
        try {
            const pkgPath = path.join(ROOT_DIR, 'package.json');
            const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
            return Object.keys({ ...pkg.dependencies }).join(', ');
        } catch (e) { return "N/A (Not a Node.js root)"; }
    }
}

export const projectScanner = new ProjectScanner();
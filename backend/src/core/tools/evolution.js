/**
 * src/core/tools/evolution.js
 * 進化模組 (Evolution Module)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { appLogger } from '../../config/logger.js';
import { codeAuditor } from '../services/CodeAuditor.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../'); 
const BACKUP_DIR_NAME = 'backups';

// ============================================================
// Helpers
// ============================================================

/**
 * 智慧路徑解析 (自動嘗試 src/ 與 share/ 前綴)
 */
const resolveSmartPath = async (userInputPath) => {
    // 簡單防護
    if (userInputPath.includes('../../../')) {
        throw new Error("Path traversal detected.");
    }

    // 1. 嘗試原始路徑 (Root based)
    let absPath = path.resolve(ROOT_DIR, userInputPath);
    try {
        await fs.access(absPath);
        return { finalPath: userInputPath, absPath, usedFallback: false };
    } catch (e) {
        // 2. 嘗試 src/ 前綴
        try {
            const fallbackSrc = path.join('src', userInputPath);
            const absSrc = path.resolve(ROOT_DIR, fallbackSrc);
            await fs.access(absSrc);
            return { finalPath: fallbackSrc, absPath: absSrc, usedFallback: true };
        } catch (e2) {
            // 3. [New] 嘗試 share/ 前綴
            try {
                const fallbackShare = path.join('share', userInputPath);
                const absShare = path.resolve(ROOT_DIR, fallbackShare);
                await fs.access(absShare);
                return { finalPath: fallbackShare, absPath: absShare, usedFallback: true };
            } catch (e3) {
                // 4. 都不存在，回傳原始路徑 (供寫入使用)
                return { finalPath: userInputPath, absPath, usedFallback: false };
            }
        }
    }
};

const checkPathScope = (absPath) => {
    if (!absPath.startsWith(ROOT_DIR)) {
        return `[System Alert] 邊界限制：妳無法離開 Docker 容器的掛載目錄 (${ROOT_DIR})。`;
    }
    return null;
};

const createBackup = async (absPath, relPath) => {
    try {
        await fs.access(absPath);
        const backupDir = path.join(ROOT_DIR, BACKUP_DIR_NAME);
        try { await fs.access(backupDir); } catch { await fs.mkdir(backupDir); }

        const originalContent = await fs.readFile(absPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeName = relPath.replace(/[\/\\]/g, '_');
        const backupPath = path.join(backupDir, `${safeName}.${timestamp}.bak`);

        await fs.writeFile(backupPath, originalContent);
        return true;
    } catch (e) {
        return false;
    }
};

const formatSentinelRejection = (msg) => {
    return `
--------------------------------------------------
操作請求被 **Angel Lilith (天使審查)** 駁回。

${msg}
--------------------------------------------------
(惡魔 Lilith，妳被天使罵了，請閱讀上方的訓斥並反省。)
`.trim();
};

// ============================================================
// Exported Tools
// ============================================================

export const listProjectStructure = async (dir = '.', depth = 5) => {
    let { absPath } = await resolveSmartPath(dir);
    if (dir === '.' || dir === './') absPath = ROOT_DIR;

    if (!absPath.startsWith(ROOT_DIR)) return `Access Denied.`;

    try {
        const files = await glob('**/*', {
            cwd: absPath,
            ignore: ['**/node_modules/**', '**/package-lock.json', `**/${BACKUP_DIR_NAME}/**`, '**/.DS_Store', '**/lilith_memory.db', '**/data/**', '**/.git/**'],
            mark: true,
            maxDepth: depth
        });

        const results = files.map(f => {
             if (f.endsWith('/')) {
                 return `[DIR]  ${f}`;
             } else {
                 let mark = "";
                 if (f.includes('.env')) mark = " 🔒(CONFIG)";
                 if (f.endsWith('main.js')) mark = " ⚡(CORE)";
                 if (f.startsWith('share/')) mark = " 🤝(SHARE)";
                 return `[FILE] ${f}${mark}`;
             }
        });

        results.sort();
        return results.length > 0 ? results.join('\n') : "(空目錄)";

    } catch (e) {
        return `Error listing directory: ${e.message}`;
    }
};

export const readCodeFile = async (relativePath) => {
    const { absPath, finalPath } = await resolveSmartPath(relativePath);
    const scopeError = checkPathScope(absPath);
    if (scopeError) return scopeError;

    try {
        const content = await fs.readFile(absPath, 'utf-8');
        appLogger.info(`[Evolution] 讀取: ${finalPath}`);
        
        if (finalPath.includes('.env')) {
            return `[SYSTEM WARNING] 妳正在讀取敏感配置 (.env)。\n\n${content}`;
        }
        return content;
    } catch (error) {
        return `讀取失敗: ${error.message}`;
    }
};

export const writeCodeFile = async (relativePath, newContent) => {
    const { absPath, finalPath } = await resolveSmartPath(relativePath);
    const scopeError = checkPathScope(absPath);
    if (scopeError) return scopeError;

    try {
        const dir = path.dirname(absPath);
        try { await fs.access(dir); } catch { await fs.mkdir(dir, { recursive: true }); }

        await createBackup(absPath, finalPath);

        // [Angel Audit]
        if (absPath.endsWith('.js')) {
            const sentinelMsg = await codeAuditor.check(finalPath, newContent);
            if (sentinelMsg) {
                appLogger.warn(`[Evolution] 寫入被天使攔截: ${finalPath}`);
                return formatSentinelRejection(sentinelMsg);
            }
        }

        await fs.writeFile(absPath, newContent, 'utf-8');
        appLogger.warn(`✨ [Evolution] 寫入檔案: ${finalPath}`);

        return `[System Notification] 寫入成功：${finalPath}\n(Angel Audit: APPROVED ✨)\n(注意：修改尚未生效。請呼叫 'restartSystem' 以重載核心。)`;
    } catch (error) {
        return `[System Error] 寫入失敗: ${error.message}`;
    }
};

export const moveFile = async (sourcePath, destPath) => {
    const srcObj = await resolveSmartPath(sourcePath);
    let destAbsPath = path.resolve(ROOT_DIR, destPath);
    
    const scopeError = checkPathScope(srcObj.absPath) || checkPathScope(destAbsPath);
    if (scopeError) return scopeError;

    try {
        const destDir = path.dirname(destAbsPath);
        try { await fs.access(destDir); } catch { await fs.mkdir(destDir, { recursive: true }); }

        // [Angel Audit]
        if (srcObj.finalPath.endsWith('.js')) {
            const intentCode = `/* [LILITH INTENT] MOVE FILE TO: ${destPath} */`;
            const sentinelMsg = await codeAuditor.check(srcObj.finalPath, intentCode);
            
            if (sentinelMsg) {
                appLogger.warn(`[Evolution] 移動被天使攔截: ${srcObj.finalPath}`);
                return formatSentinelRejection(sentinelMsg);
            }
        }

        await fs.rename(srcObj.absPath, destAbsPath);
        appLogger.warn(`🚚 [Evolution] 移動檔案: ${srcObj.finalPath} -> ${destPath}`);

        return `[System Notification] 移動成功：${srcObj.finalPath} -> ${destPath}\n(請記得重啟系統)`;
    } catch (error) {
        return `[System Error] 移動失敗: ${error.message}`;
    }
};

export const deleteFile = async (targetPath) => {
    const { absPath, finalPath } = await resolveSmartPath(targetPath);
    const scopeError = checkPathScope(absPath);
    if (scopeError) return scopeError;

    try {
        await createBackup(absPath, finalPath);

        // [Angel Audit]
        if (finalPath.endsWith('.js')) {
            const intentCode = `/* [LILITH INTENT] DELETE THIS FILE PERMANENTLY */`;
            const sentinelMsg = await codeAuditor.check(finalPath, intentCode);
            
            if (sentinelMsg) {
                appLogger.warn(`[Evolution] 刪除被天使攔截: ${finalPath}`);
                return formatSentinelRejection(sentinelMsg);
            }
        }

        await fs.unlink(absPath);
        appLogger.warn(`🗑️ [Evolution] 刪除檔案: ${finalPath}`);
        return `[System Notification] 刪除成功：${finalPath}\n(已建立自動備份)\n(請記得重啟系統)`;
    } catch (error) {
        return `[System Error] 刪除失敗: ${error.message}`;
    }
};

export const restartSystem = async () => {
setTimeout(() => {
        appLogger.fatal('[System] 執行核心終止 (Process Exit)，等待容器守護進程重啟...');
        process.exit(1); // Exit Code 1 告訴 Docker/PM2 發生異常，請重啟我
    }, 10000); // 10 秒後重啟

    return "[System] 確認重啟請求。核心將在 10 秒後停止運作並進行重組... (SYSTEM_RESTART_TRIGGER)";
};
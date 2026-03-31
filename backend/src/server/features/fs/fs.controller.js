import { fsService } from './fs.service.js';
import { appLogger } from '../../../agents/core/services/logger.js';

export const fsController = {
    list: (req, res) => {
        try {
            res.json(fsService.listDirectory(req.query.dir));
        } catch (e) { res.status(400).json({ error: e.message }); }
    },
    read: (req, res) => {
        try {
            res.json({ content: fsService.readFile(req.query.path) });
        } catch (e) { res.status(400).json({ error: e.message }); }
    },
    write: (req, res) => {
        try {
            const { path: relativePath, content, encoding } = req.body;
            fsService.writeFile(relativePath, content, encoding);
            appLogger.info(`[IDE] File saved: ${relativePath}`);
            res.json({ success: true });
        } catch (e) { res.status(400).json({ error: e.message }); }
    },
    extract: (req, res) => {
        try {
            const { path: targetDir, content } = req.body;
            fsService.extractZip(targetDir, content);
            appLogger.info(`[IDE] Extracted zip to: ${targetDir}`);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    },
    delete: (req, res) => {
        try {
            fsService.deleteFileOrDir(req.body.path);
            appLogger.info(`[IDE] Deleted: ${req.body.path}`);
            res.json({ success: true });
        } catch (e) { res.status(400).json({ error: e.message }); }
    }
};
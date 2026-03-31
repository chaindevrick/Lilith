import { systemService } from './system.service.js';
import { appLogger } from '../../../agents/core/services/logger.js';

export const createSystemController = (context) => ({
    getSettings: (req, res) => {
        try {
            res.json(systemService.getSettings());
        } catch (e) { res.status(500).json({ error: e.message }); }
    },
    updateSettings: (req, res) => {
        try {
            systemService.updateSettings(req.body);
            res.status(200).json({ success: true, message: 'Settings saved successfully.' });
            setTimeout(() => context.dispatchToBrain({ type: 'CMD_RESTART_BRAIN' }), 1500);
        } catch (error) {
            appLogger.error('[System API] Settings update failed:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },
    getSkills: (req, res) => {
        try {
            res.json(systemService.getAvailableSkills());
        } catch (error) { res.status(500).json({ error: error.message }); }
    },
    restartSystem: (req, res) => {
        context.dispatchToBrain({ type: 'CMD_RESTART_BRAIN' });
        res.json({ success: true, message: "Restart signal sent." });
    }
});
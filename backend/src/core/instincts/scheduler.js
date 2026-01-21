/**
 * src/core/instincts/scheduler.js
 * 本能調度器 (Proactive Scheduler)
 * 負責系統的時間感知與週期性任務觸發 (如午夜反思、晨間喚醒)
 */
import cron from 'node-cron';
import { appLogger } from '../../config/logger.js';

export class ProactiveScheduler {
    /**
     * 建構子：透過依賴注入獲取 EventBus
     * @param {EventEmitter} brainBus - 由 Brain 傳入的神經總線實例
     */
    constructor(brainBus) {
        if (!brainBus) {
            throw new Error('[Scheduler] Critical Error: brainBus instance is required.');
        }
        
        this.brainBus = brainBus;
        this.jobs = [];
    }

    /**
     * 啟動所有週期性任務
     */
    start() {
        appLogger.info('[Scheduler] Initializing instinct cycles...');

        // 1. 午夜儀式：自我反思 (Self-Reflection) - 每日 00:00
        const midnightJob = cron.schedule('0 0 * * *', () => {
            appLogger.info('[Scheduler] Triggering Midnight Reflection...');
            this.brainBus.emit('INTERNAL_IMPULSE', {
                type: 'TRIGGER_SELF_REFLECTION',
                timestamp: new Date().toISOString()
            });
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        // 2. 黎明儀式：晨間簡報 (Morning Briefing) - 每日 08:00
        const morningJob = cron.schedule('0 8 * * *', () => {
            appLogger.info('[Scheduler] Triggering Morning Briefing...');
            this.brainBus.emit('INTERNAL_IMPULSE', {
                type: 'TRIGGER_MORNING_BRIEFING',
                timestamp: new Date().toISOString()
            });
        }, {
            scheduled: true,
            timezone: "Asia/Taipei"
        });

        this.jobs.push(midnightJob, morningJob);
        appLogger.info(`[Scheduler] Active cycles: ${this.jobs.length} (Midnight & Morning)`);
    }

    /**
     * 停止所有任務 (用於系統重啟或關閉)
     */
    stop() {
        if (this.jobs.length > 0) {
            this.jobs.forEach(job => job.stop());
            this.jobs = [];
            appLogger.info('[Scheduler] All instinct cycles stopped.');
        }
    }
}
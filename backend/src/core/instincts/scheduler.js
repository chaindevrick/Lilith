/**
 * src/core/instincts/scheduler.js
 * 本能調度器 (Proactive Scheduler)
 * 負責系統的時間感知與週期性任務觸發 (如午夜反思、晨間喚醒、閒置檢查)
 */
import cron from 'node-cron';
import { appLogger } from '../../config/logger.js';

export class ProactiveScheduler {
    /**
     * @param {EventEmitter} brainBus - 神經總線實例
     */
    constructor(brainBus) {
        if (!brainBus) {
            throw new Error('[Scheduler] Critical Error: brainBus instance is required.');
        }
        
        this.brainBus = brainBus;
        this.jobs = [];
        this.heartbeat = null;
    }

    /**
     * 啟動所有週期性任務
     */
    start() {
        appLogger.info('[Scheduler] Initializing instinct cycles...');

        // 1. 午夜儀式：自我反思 (每日 00:00)
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

        // 2. 黎明儀式：晨間簡報 (每日 08:00)
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

        // 3. 系統心跳 (每 60 秒)
        this.heartbeat = setInterval(() => {
            this.brainBus.emit('INTERNAL_IMPULSE', {
                type: 'IDLE_CHECK',
                timestamp: new Date().toISOString()
            });
        }, 60000);

        appLogger.info(`[Scheduler] Active cycles: ${this.jobs.length} Cron Jobs + Heartbeat (60s)`);
    }

    /**
     * 停止所有任務
     */
    stop() {
        if (this.jobs.length > 0) {
            this.jobs.forEach(job => job.stop());
            this.jobs = [];
        }

        if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
        }

        appLogger.info('[Scheduler] All instinct cycles stopped.');
    }
}
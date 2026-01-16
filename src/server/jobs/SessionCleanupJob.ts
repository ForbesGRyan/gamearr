import { CronJob } from 'cron';
import { sessionRepository } from '../repositories/SessionRepository';
import { logger } from '../utils/logger';

/**
 * Session Cleanup Job
 * Runs every hour to delete expired sessions from the database
 */
export class SessionCleanupJob {
  private job: CronJob | null = null;
  private isRunning = false;

  /**
   * Start the session cleanup job
   */
  start() {
    if (this.job) {
      logger.warn('Session cleanup job is already running');
      return;
    }

    logger.info('Starting session cleanup job (runs hourly)');

    // Run at the start of every hour
    this.job = new CronJob('0 0 * * * *', async () => {
      await this.cleanup();
    });

    this.job.start();

    // Also run immediately on startup to clean up any old sessions
    this.cleanup().catch((err) => logger.error('Initial session cleanup failed:', err));
  }

  /**
   * Stop the session cleanup job
   */
  stop() {
    if (this.job) {
      logger.info('Stopping session cleanup job');
      this.job.stop();
      this.job = null;
    }
  }

  /**
   * Perform session cleanup
   */
  private async cleanup() {
    if (this.isRunning) {
      logger.debug('Session cleanup already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.debug('Running session cleanup');
      const deletedCount = await sessionRepository.deleteExpired();

      if (deletedCount > 0) {
        logger.info(`Session cleanup completed: ${deletedCount} expired sessions removed`);
      } else {
        logger.debug('Session cleanup completed: no expired sessions found');
      }
    } catch (error) {
      logger.error('Session cleanup failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual cleanup trigger (for testing or manual cleanup)
   */
  async triggerCleanup(): Promise<number> {
    logger.info('Manually triggering session cleanup');
    const deletedCount = await sessionRepository.deleteExpired();
    return deletedCount;
  }
}

// Singleton instance
export const sessionCleanupJob = new SessionCleanupJob();

import { CronJob } from 'cron';
import { createReadStream, createWriteStream, readdirSync, statSync, unlinkSync } from 'fs';
import { createGzip } from 'zlib';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { logger } from '../utils/logger';

/**
 * Log Rotation Job
 * Runs daily at midnight to:
 * 1. Compress old log files (previous days)
 * 2. Delete logs older than 30 days
 */
export class LogRotationJob {
  private job: CronJob | null = null;
  private isRunning = false;
  private retentionDays = 30;

  /**
   * Start the log rotation job
   */
  start() {
    if (this.job) {
      logger.warn('Log rotation job is already running');
      return;
    }

    logger.info('Starting log rotation job (runs daily at midnight)');

    // Run at midnight every day
    this.job = new CronJob('0 0 0 * * *', async () => {
      await this.rotate();
    });

    this.job.start();

    // Also run immediately on startup to clean up any old logs
    this.rotate().catch((err) => logger.error('Initial log rotation failed:', err));
  }

  /**
   * Stop the log rotation job
   */
  stop() {
    if (this.job) {
      logger.info('Stopping log rotation job');
      this.job.stop();
      this.job = null;
    }
  }

  /**
   * Perform log rotation
   */
  private async rotate() {
    if (this.isRunning) {
      logger.debug('Log rotation already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const logDir = logger.getLogDir();
      const today = new Date().toISOString().split('T')[0];

      logger.debug('Running log rotation');

      // Get all files in log directory
      let files: string[];
      try {
        files = readdirSync(logDir);
      } catch {
        logger.debug('Log directory does not exist yet, skipping rotation');
        return;
      }

      // Process each file
      for (const file of files) {
        const filePath = join(logDir, file);

        // Skip if not a file
        try {
          const stats = statSync(filePath);
          if (!stats.isFile()) continue;
        } catch {
          continue;
        }

        // Compress uncompressed log files from previous days
        if (file.endsWith('.log') && !file.includes(today)) {
          await this.compressFile(filePath);
        }

        // Delete old compressed logs
        if (file.endsWith('.log.gz')) {
          await this.deleteIfOld(filePath);
        }
      }

      logger.debug('Log rotation completed');
    } catch (error) {
      logger.error('Log rotation failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Compress a log file using gzip
   */
  private async compressFile(filePath: string): Promise<void> {
    const gzPath = `${filePath}.gz`;

    try {
      logger.debug(`Compressing log file: ${filePath}`);

      const source = createReadStream(filePath);
      const destination = createWriteStream(gzPath);
      const gzip = createGzip();

      await pipeline(source, gzip, destination);

      // Delete original file after successful compression
      unlinkSync(filePath);

      logger.debug(`Compressed and removed: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to compress log file: ${filePath}`, error);
    }
  }

  /**
   * Delete a file if it's older than the retention period
   */
  private async deleteIfOld(filePath: string): Promise<void> {
    try {
      const stats = statSync(filePath);
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays > this.retentionDays) {
        logger.debug(`Deleting old log file: ${filePath} (${Math.floor(ageInDays)} days old)`);
        unlinkSync(filePath);
      }
    } catch (error) {
      logger.error(`Failed to delete old log file: ${filePath}`, error);
    }
  }

  /**
   * Manual rotation trigger (for testing or manual cleanup)
   */
  async triggerRotation() {
    logger.info('Manually triggering log rotation');
    await this.rotate();
  }
}

// Singleton instance
export const logRotationJob = new LogRotationJob();

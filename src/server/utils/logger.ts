import { existsSync, mkdirSync, statSync, appendFileSync, readdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

// Patterns that indicate sensitive data keys
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'authorization',
  'auth',
  'cookie',
  'session',
  'credential',
  'private',
  'key',
];

// Patterns that indicate sensitive values (e.g., in URLs or messages)
const SENSITIVE_VALUE_PATTERNS = [
  /key=[^&\s]+/gi,
  /secret=[^&\s]+/gi,
  /password=[^&\s]+/gi,
  /token=[^&\s]+/gi,
  /Bearer\s+[^\s]+/gi,
];

class Logger {
  private logDir: string;
  private currentDate: string = '';
  private currentLogFile: string = '';
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private fileLoggingEnabled: boolean = true;

  constructor() {
    this.logDir = this.getLogDirectory();
    this.ensureLogDirectory();
  }

  /**
   * Get the log directory path
   * Priority: DATA_PATH env var > LOG_PATH env var > executable directory (prod) > cwd (dev)
   */
  private getLogDirectory(): string {
    // If DATA_PATH is set (Docker/container), use it for logs
    if (process.env.DATA_PATH) {
      return join(process.env.DATA_PATH, 'logs');
    }

    // Allow explicit LOG_PATH override
    if (process.env.LOG_PATH) {
      return process.env.LOG_PATH;
    }

    // In production (compiled binary), use directory of executable
    // In development, use project root
    const baseDir = process.env.NODE_ENV === 'production'
      ? dirname(process.execPath)
      : process.cwd();
    return join(baseDir, 'logs');
  }

  /**
   * Ensure the logs directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      // If we can't create the log directory, disable file logging
      this.fileLoggingEnabled = false;
      console.error(`Failed to create log directory: ${this.logDir}`, error);
    }
  }

  /**
   * Get the current log file path based on date
   */
  private getLogFilePath(date: string, rotationIndex: number = 0): string {
    const suffix = rotationIndex > 0 ? `.${rotationIndex}` : '';
    return join(this.logDir, `gamearr-${date}${suffix}.log`);
  }

  /**
   * Get current date string in YYYY-MM-DD format
   */
  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Rotate log file when size limit is reached
   */
  private rotateLogFile(): void {
    try {
      // Find the next available rotation index
      let rotationIndex = 1;
      while (existsSync(this.getLogFilePath(this.currentDate, rotationIndex))) {
        rotationIndex++;
      }

      // Rename current log file
      const newPath = this.getLogFilePath(this.currentDate, rotationIndex);
      renameSync(this.currentLogFile, newPath);

      // Reset current log file (will be recreated on next write)
      this.currentLogFile = this.getLogFilePath(this.currentDate);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Check if current log file needs rotation (size limit)
   */
  private checkSizeRotation(): void {
    try {
      if (existsSync(this.currentLogFile)) {
        const stats = statSync(this.currentLogFile);
        if (stats.size >= this.maxFileSize) {
          this.rotateLogFile();
        }
      }
    } catch {
      // Ignore errors during size check
    }
  }

  /**
   * Write a log entry to the file
   */
  private writeToFile(formattedMessage: string): void {
    if (!this.fileLoggingEnabled) return;

    try {
      const today = this.getCurrentDateString();

      // Check if date changed (new day)
      if (today !== this.currentDate) {
        this.currentDate = today;
        this.currentLogFile = this.getLogFilePath(today);
      }

      // Check if we need to rotate due to size
      this.checkSizeRotation();

      // Append to log file
      appendFileSync(this.currentLogFile, formattedMessage + '\n');
    } catch (error) {
      // Don't use logger here to avoid infinite recursion
      console.error('Failed to write to log file:', error);
    }
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Sanitize data to remove sensitive information before logging
   */
  private sanitize(data: unknown, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > 10) {
      return '[MAX_DEPTH]';
    }

    if (data === null || data === undefined) {
      return data;
    }

    // Handle Error objects specially
    if (data instanceof Error) {
      return {
        name: data.name,
        message: this.sanitizeString(data.message),
        // Only include stack in development, and sanitize it
        ...(process.env.NODE_ENV !== 'production' && data.stack
          ? { stack: this.sanitizeString(data.stack) }
          : {}),
      };
    }

    // Handle strings
    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item, depth + 1));
    }

    // Handle objects
    if (typeof data === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        // Check if key suggests sensitive data
        if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(value, depth + 1);
        }
      }
      return sanitized;
    }

    // Return primitives as-is
    return data;
  }

  /**
   * Sanitize a string to remove sensitive patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    const sanitizedMessage = this.sanitizeString(message);
    const sanitizedData = data !== undefined ? this.sanitize(data) : undefined;

    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message: sanitizedMessage,
      data: sanitizedData,
    };

    const color = {
      info: '\x1b[36m',    // Cyan
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[90m',   // Gray
    }[level];

    const reset = '\x1b[0m';
    const levelStr = level.toUpperCase().padEnd(5);

    // Console output (with colors)
    console.log(
      `${color}[${entry.timestamp}] ${levelStr}${reset} ${sanitizedMessage}`,
      sanitizedData !== undefined ? sanitizedData : ''
    );

    // File output (without colors)
    const dataStr = sanitizedData !== undefined
      ? ` ${JSON.stringify(sanitizedData)}`
      : '';
    const fileMessage = `[${entry.timestamp}] ${levelStr} ${sanitizedMessage}${dataStr}`;
    this.writeToFile(fileMessage);
  }

  info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.log('error', message, data);
  }

  debug(message: string, data?: unknown) {
    this.log('debug', message, data);
  }

  /**
   * Get the log directory path (for use by rotation job)
   */
  getLogDir(): string {
    return this.logDir;
  }
}

export const logger = new Logger();

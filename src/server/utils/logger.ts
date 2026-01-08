type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
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
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Sanitize data to remove sensitive information before logging
   */
  private sanitize(data: any, depth: number = 0): any {
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
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
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

  private log(level: LogLevel, message: string, data?: any) {
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

    console.log(
      `${color}[${entry.timestamp}] ${levelStr}${reset} ${sanitizedMessage}`,
      sanitizedData !== undefined ? sanitizedData : ''
    );
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }
}

export const logger = new Logger();

import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

// We need to test the Logger class directly, so we'll create a test instance
// by reimporting or testing via the exported singleton

describe('Logger', () => {
  const testLogDir = join(process.cwd(), 'test-logs');
  let consoleSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Clean up any existing test logs
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true });
    }
    // Spy on console methods
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    // Clean up test logs
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true });
    }
  });

  describe('Sensitive data sanitization', () => {
    // Since we can't easily test the private methods directly,
    // we'll test through the public interface by importing the logger
    // and checking the console output

    test('should redact password keys in objects', async () => {
      // Re-import to get fresh instance
      const { logger } = await import('../logger');

      logger.info('Test message', { password: 'secret123', username: 'john' });

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.password).toBe('[REDACTED]');
      expect(dataArg.username).toBe('john');
    });

    test('should redact api_key in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('API call', { api_key: 'abc123', endpoint: '/test' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.api_key).toBe('[REDACTED]');
      expect(dataArg.endpoint).toBe('/test');
    });

    test('should redact apikey (no underscore) in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('API call', { apikey: 'xyz789' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.apikey).toBe('[REDACTED]');
    });

    test('should redact secret in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Config', { client_secret: 'my-secret', client_id: 'my-id' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.client_secret).toBe('[REDACTED]');
      expect(dataArg.client_id).toBe('my-id');
    });

    test('should redact token in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Auth', { access_token: 'token123', expires: 3600 });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.access_token).toBe('[REDACTED]');
      expect(dataArg.expires).toBe(3600);
    });

    test('should redact authorization header', async () => {
      const { logger } = await import('../logger');

      logger.info('Request', { headers: { authorization: 'Bearer xyz', 'content-type': 'application/json' } });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.headers.authorization).toBe('[REDACTED]');
      expect(dataArg.headers['content-type']).toBe('application/json');
    });

    test('should redact cookie in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Session', { cookie: 'sessionid=abc123' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.cookie).toBe('[REDACTED]');
    });

    test('should redact session in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('User session', { session_id: 'sess_123' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.session_id).toBe('[REDACTED]');
    });

    test('should redact credential in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Auth', { credentials: { user: 'test' } });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.credentials).toBe('[REDACTED]');
    });

    test('should redact private_key in objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Crypto', { private_key: '-----BEGIN RSA PRIVATE KEY-----' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.private_key).toBe('[REDACTED]');
    });

    test('should handle nested objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Nested', {
        config: {
          database: {
            password: 'db-pass',
            host: 'localhost'
          },
          api: {
            key: 'api-key-value'
          }
        }
      });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.config.database.password).toBe('[REDACTED]');
      expect(dataArg.config.database.host).toBe('localhost');
      expect(dataArg.config.api.key).toBe('[REDACTED]');
    });

    test('should handle arrays with sensitive data', async () => {
      const { logger } = await import('../logger');

      logger.info('Users', {
        users: [
          { name: 'John', password: 'pass1' },
          { name: 'Jane', password: 'pass2' }
        ]
      });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.users[0].name).toBe('John');
      expect(dataArg.users[0].password).toBe('[REDACTED]');
      expect(dataArg.users[1].name).toBe('Jane');
      expect(dataArg.users[1].password).toBe('[REDACTED]');
    });

    test('should redact sensitive patterns in URL strings', async () => {
      const { logger } = await import('../logger');

      logger.info('URL with key=secretvalue in query string');

      const callArgs = consoleSpy.mock.calls[0];
      const message = callArgs[0];

      expect(message).toContain('[REDACTED]');
      expect(message).not.toContain('secretvalue');
    });

    test('should redact Bearer token in strings', async () => {
      const { logger } = await import('../logger');

      logger.info('Auth header: Bearer abc123xyz');

      const callArgs = consoleSpy.mock.calls[0];
      const message = callArgs[0];

      expect(message).toContain('[REDACTED]');
      expect(message).not.toContain('abc123xyz');
    });

    test('should redact password= in URL strings', async () => {
      const { logger } = await import('../logger');

      logger.info('Connection string: host=localhost&password=supersecret&port=5432');

      const callArgs = consoleSpy.mock.calls[0];
      const message = callArgs[0];

      expect(message).toContain('[REDACTED]');
      expect(message).not.toContain('supersecret');
    });

    test('should redact secret= in strings', async () => {
      const { logger } = await import('../logger');

      logger.info('Config: secret=mysecretvalue');

      const callArgs = consoleSpy.mock.calls[0];
      const message = callArgs[0];

      expect(message).toContain('[REDACTED]');
      expect(message).not.toContain('mysecretvalue');
    });

    test('should redact token= in strings', async () => {
      const { logger } = await import('../logger');

      logger.info('URL: https://api.example.com?token=abcdef123');

      const callArgs = consoleSpy.mock.calls[0];
      const message = callArgs[0];

      expect(message).toContain('[REDACTED]');
      expect(message).not.toContain('abcdef123');
    });
  });

  describe('Log levels', () => {
    test('should log info messages', async () => {
      const { logger } = await import('../logger');

      logger.info('Info message');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('INFO');
      expect(message).toContain('Info message');
    });

    test('should log warn messages', async () => {
      const { logger } = await import('../logger');

      logger.warn('Warning message');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('WARN');
      expect(message).toContain('Warning message');
    });

    test('should log error messages', async () => {
      const { logger } = await import('../logger');

      logger.error('Error message');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('ERROR');
      expect(message).toContain('Error message');
    });

    test('should log debug messages', async () => {
      const { logger } = await import('../logger');

      logger.debug('Debug message');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('DEBUG');
      expect(message).toContain('Debug message');
    });
  });

  describe('Error object handling', () => {
    test('should sanitize Error objects', async () => {
      const { logger } = await import('../logger');

      const error = new Error('Failed with password=secret123');
      logger.error('An error occurred', error);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.name).toBe('Error');
      expect(dataArg.message).toContain('[REDACTED]');
      expect(dataArg.message).not.toContain('secret123');
    });

    test('should include error name and message', async () => {
      const { logger } = await import('../logger');

      const error = new TypeError('Invalid type');
      logger.error('Type error', error);

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.name).toBe('TypeError');
      expect(dataArg.message).toBe('Invalid type');
    });
  });

  describe('Edge cases', () => {
    test('should handle null data', async () => {
      const { logger } = await import('../logger');

      logger.info('Null data', null);

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[1]).toBe(null);
    });

    test('should handle undefined data', async () => {
      const { logger } = await import('../logger');

      logger.info('No data');

      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      // When no data is passed, it should be empty string or not present
      expect(callArgs[1]).toBe('');
    });

    test('should handle primitive data types', async () => {
      const { logger } = await import('../logger');

      logger.info('Number', 42);

      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[1]).toBe(42);
    });

    test('should handle boolean data', async () => {
      const { logger } = await import('../logger');

      logger.info('Boolean', true);

      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[1]).toBe(true);
    });

    test('should handle empty object', async () => {
      const { logger } = await import('../logger');

      logger.info('Empty', {});

      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({});
    });

    test('should handle empty array', async () => {
      const { logger } = await import('../logger');

      logger.info('Empty array', []);

      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[1]).toEqual([]);
    });

    test('should handle deeply nested objects up to max depth', async () => {
      const { logger } = await import('../logger');

      // Create deeply nested object
      let deepObj: any = { value: 'deep' };
      for (let i = 0; i < 15; i++) {
        deepObj = { nested: deepObj };
      }

      logger.info('Deep nesting', deepObj);

      expect(consoleSpy).toHaveBeenCalled();
      // Should not throw and should handle max depth
    });

    test('should handle case-insensitive key matching', async () => {
      const { logger } = await import('../logger');

      logger.info('Mixed case', {
        PASSWORD: 'secret1',
        Password: 'secret2',
        pAsSwOrD: 'secret3'
      });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.PASSWORD).toBe('[REDACTED]');
      expect(dataArg.Password).toBe('[REDACTED]');
      expect(dataArg.pAsSwOrD).toBe('[REDACTED]');
    });
  });

  describe('Timestamp formatting', () => {
    test('should include ISO timestamp in log output', async () => {
      const { logger } = await import('../logger');

      logger.info('Timestamp test');

      const message = consoleSpy.mock.calls[0][0];
      // Should contain ISO date format pattern
      expect(message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Logger singleton', () => {
    test('should export a logger instance', async () => {
      const { logger } = await import('../logger');

      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    test('should expose getLogDir method', async () => {
      const { logger } = await import('../logger');

      expect(typeof logger.getLogDir).toBe('function');
      const logDir = logger.getLogDir();
      expect(typeof logDir).toBe('string');
      expect(logDir).toContain('logs');
    });
  });

  describe('Log file path generation', () => {
    test('should generate log file path with date', async () => {
      const { logger } = await import('../logger');

      const logDir = logger.getLogDir();
      expect(logDir).toMatch(/logs$/);
    });
  });

  describe('Multiple sensitive patterns in one message', () => {
    test('should redact multiple sensitive patterns', async () => {
      const { logger } = await import('../logger');

      logger.info('Multiple secrets: key=abc123 password=xyz789 token=def456');

      const message = consoleSpy.mock.calls[0][0];
      expect(message).not.toContain('abc123');
      expect(message).not.toContain('xyz789');
      expect(message).not.toContain('def456');
      expect(message.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('auth key variations', () => {
    test('should redact auth-related keys', async () => {
      const { logger } = await import('../logger');

      logger.info('Auth data', {
        auth_token: 'token1',
        authKey: 'key1',
        authentication: 'auth1'
      });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.auth_token).toBe('[REDACTED]');
      expect(dataArg.authKey).toBe('[REDACTED]');
      expect(dataArg.authentication).toBe('[REDACTED]');
    });
  });

  describe('Data with optional data parameter', () => {
    test('should log message with data object', async () => {
      const { logger } = await import('../logger');

      logger.info('User action', { userId: 123, action: 'login' });

      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({ userId: 123, action: 'login' });
    });

    test('should log message without data', async () => {
      const { logger } = await import('../logger');

      logger.info('Simple message');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('String sanitization in data values', () => {
    test('should sanitize strings inside data objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Request', {
        url: 'https://api.com?key=mysecretkey',
        method: 'GET'
      });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.url).toContain('[REDACTED]');
      expect(dataArg.url).not.toContain('mysecretkey');
      expect(dataArg.method).toBe('GET');
    });

    test('should sanitize strings in arrays', async () => {
      const { logger } = await import('../logger');

      logger.info('URLs', ['https://api.com?token=secret1', 'https://api.com/public']);

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg[0]).toContain('[REDACTED]');
      expect(dataArg[0]).not.toContain('secret1');
      expect(dataArg[1]).toBe('https://api.com/public');
    });
  });

  describe('Special characters in data', () => {
    test('should handle special characters in messages', async () => {
      const { logger } = await import('../logger');

      logger.info('Special chars: @#$%^&*()[]{}|;:,.<>?');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('@#$%^&*()[]{}|;:,.<>?');
    });

    test('should handle unicode characters', async () => {
      const { logger } = await import('../logger');

      logger.info('Unicode test: 日本語 emoji: 🎮');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('日本語');
      expect(message).toContain('🎮');
    });

    test('should handle newlines in messages', async () => {
      const { logger } = await import('../logger');

      logger.info('Line 1\nLine 2\nLine 3');

      expect(consoleSpy).toHaveBeenCalled();
      const message = consoleSpy.mock.calls[0][0];
      expect(message).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Complex nested structures', () => {
    test('should handle mixed arrays and objects', async () => {
      const { logger } = await import('../logger');

      logger.info('Complex data', {
        items: [
          { id: 1, config: { apiKey: 'key1' } },
          { id: 2, config: { apiKey: 'key2' } }
        ]
      });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg.items[0].id).toBe(1);
      expect(dataArg.items[0].config.apiKey).toBe('[REDACTED]');
      expect(dataArg.items[1].id).toBe(2);
      expect(dataArg.items[1].config.apiKey).toBe('[REDACTED]');
    });
  });

  describe('Max depth handling', () => {
    test('should replace deeply nested objects with MAX_DEPTH marker', async () => {
      const { logger } = await import('../logger');

      // Create object nested more than 10 levels deep
      let deepObj: any = { deepValue: 'bottom' };
      for (let i = 0; i < 12; i++) {
        deepObj = { level: i, nested: deepObj };
      }

      logger.info('Very deep', deepObj);

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      // Navigate to find MAX_DEPTH marker
      let current = dataArg;
      let foundMaxDepth = false;
      for (let i = 0; i < 15; i++) {
        if (current === '[MAX_DEPTH]') {
          foundMaxDepth = true;
          break;
        }
        if (current?.nested) {
          current = current.nested;
        }
      }

      expect(foundMaxDepth).toBe(true);
    });
  });

  describe('api-key hyphenated format', () => {
    test('should redact api-key with hyphen', async () => {
      const { logger } = await import('../logger');

      logger.info('API config', { 'api-key': 'secret-api-key-value' });

      const callArgs = consoleSpy.mock.calls[0];
      const dataArg = callArgs[1];

      expect(dataArg['api-key']).toBe('[REDACTED]');
    });
  });
});

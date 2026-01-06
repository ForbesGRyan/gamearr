import { describe, expect, test } from 'bun:test';
import {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  NotConfiguredError,
  IntegrationError,
  IGDBError,
  ProwlarrError,
  QBittorrentError,
  DatabaseError,
  FileSystemError,
  ErrorCode,
  toAppError,
  formatErrorResponse,
} from '../../src/server/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    test('should create with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.UNKNOWN);
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
    });

    test('should create with custom values', () => {
      const error = new AppError('Custom error', ErrorCode.VALIDATION_ERROR, 400, false);

      expect(error.message).toBe('Custom error');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(false);
    });

    test('should be instance of Error', () => {
      const error = new AppError('Test');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('NotFoundError', () => {
    test('should create with resource name only', () => {
      const error = new NotFoundError('Game');

      expect(error.message).toBe('Game not found');
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.statusCode).toBe(404);
    });

    test('should create with resource name and identifier', () => {
      const error = new NotFoundError('Game', 123);

      expect(error.message).toBe("Game with ID '123' not found");
      expect(error.statusCode).toBe(404);
    });

    test('should handle string identifiers', () => {
      const error = new NotFoundError('User', 'john@example.com');

      expect(error.message).toBe("User with ID 'john@example.com' not found");
    });
  });

  describe('ValidationError', () => {
    test('should create with message', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('ConflictError', () => {
    test('should create with message', () => {
      const error = new ConflictError('Game already exists');

      expect(error.message).toBe('Game already exists');
      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.statusCode).toBe(409);
    });
  });

  describe('NotConfiguredError', () => {
    test('should create with service name', () => {
      const error = new NotConfiguredError('Prowlarr');

      expect(error.message).toBe('Prowlarr is not configured. Please add your Prowlarr settings.');
      expect(error.code).toBe(ErrorCode.NOT_CONFIGURED);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('Integration Errors', () => {
    test('IntegrationError should include service name in message', () => {
      const error = new IntegrationError('TestService', 'Connection failed');

      expect(error.message).toBe('TestService: Connection failed');
      expect(error.service).toBe('TestService');
      expect(error.statusCode).toBe(502);
    });

    test('IGDBError should use IGDB prefix', () => {
      const error = new IGDBError('Rate limited');

      expect(error.message).toBe('IGDB: Rate limited');
      expect(error.service).toBe('IGDB');
      expect(error.code).toBe(ErrorCode.IGDB_ERROR);
    });

    test('ProwlarrError should use Prowlarr prefix', () => {
      const error = new ProwlarrError('API error', ErrorCode.PROWLARR_CONNECTION_FAILED);

      expect(error.message).toBe('Prowlarr: API error');
      expect(error.service).toBe('Prowlarr');
      expect(error.code).toBe(ErrorCode.PROWLARR_CONNECTION_FAILED);
    });

    test('QBittorrentError should use qBittorrent prefix', () => {
      const error = new QBittorrentError('Auth failed', ErrorCode.QBITTORRENT_AUTH_FAILED);

      expect(error.message).toBe('qBittorrent: Auth failed');
      expect(error.service).toBe('qBittorrent');
      expect(error.code).toBe(ErrorCode.QBITTORRENT_AUTH_FAILED);
    });
  });

  describe('DatabaseError', () => {
    test('should create with default code', () => {
      const error = new DatabaseError('Query failed');

      expect(error.message).toBe('Query failed');
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.statusCode).toBe(500);
    });

    test('should accept custom code', () => {
      const error = new DatabaseError('Duplicate entry', ErrorCode.DUPLICATE_ENTRY);

      expect(error.code).toBe(ErrorCode.DUPLICATE_ENTRY);
    });
  });

  describe('FileSystemError', () => {
    test('should create with default code', () => {
      const error = new FileSystemError('File not found');

      expect(error.message).toBe('File not found');
      expect(error.code).toBe(ErrorCode.FILE_ERROR);
      expect(error.statusCode).toBe(500);
    });
  });
});

describe('Error Utilities', () => {
  describe('toAppError', () => {
    test('should return AppError unchanged', () => {
      const original = new AppError('Test', ErrorCode.VALIDATION_ERROR, 400);
      const result = toAppError(original);

      expect(result).toBe(original);
    });

    test('should convert Error to AppError', () => {
      const original = new Error('Standard error');
      const result = toAppError(original);

      expect(result instanceof AppError).toBe(true);
      expect(result.message).toBe('Standard error');
      expect(result.code).toBe(ErrorCode.UNKNOWN);
    });

    test('should convert string to AppError', () => {
      const result = toAppError('String error');

      expect(result instanceof AppError).toBe(true);
      expect(result.message).toBe('String error');
    });

    test('should convert unknown types to AppError', () => {
      const result = toAppError({ custom: 'object' });

      expect(result instanceof AppError).toBe(true);
      expect(result.message).toBe('[object Object]');
    });

    test('should preserve ProwlarrError', () => {
      const original = new ProwlarrError('API error');
      const result = toAppError(original);

      expect(result).toBe(original);
      expect(result instanceof ProwlarrError).toBe(true);
    });
  });

  describe('formatErrorResponse', () => {
    test('should format AppError correctly', () => {
      const error = new AppError('Test error', ErrorCode.VALIDATION_ERROR);
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Test error',
        code: ErrorCode.VALIDATION_ERROR,
      });
    });

    test('should format standard Error', () => {
      const error = new Error('Standard error');
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: 'Standard error',
        code: ErrorCode.UNKNOWN,
      });
    });

    test('should format NotFoundError', () => {
      const error = new NotFoundError('Game', 42);
      const response = formatErrorResponse(error);

      expect(response).toEqual({
        success: false,
        error: "Game with ID '42' not found",
        code: ErrorCode.NOT_FOUND,
      });
    });

    test('should always have success: false', () => {
      const response = formatErrorResponse('any error');
      expect(response.success).toBe(false);
    });
  });
});

describe('ErrorCode', () => {
  test('should have unique values', () => {
    const codes = Object.values(ErrorCode).filter(v => typeof v === 'number');
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(codes.length);
  });

  test('should follow naming convention', () => {
    // General errors are 1xxx
    expect(ErrorCode.UNKNOWN).toBeGreaterThanOrEqual(1000);
    expect(ErrorCode.UNKNOWN).toBeLessThan(2000);

    // Configuration errors are 2xxx
    expect(ErrorCode.NOT_CONFIGURED).toBeGreaterThanOrEqual(2000);
    expect(ErrorCode.NOT_CONFIGURED).toBeLessThan(3000);

    // Integration errors are 3xxx
    expect(ErrorCode.IGDB_ERROR).toBeGreaterThanOrEqual(3000);
    expect(ErrorCode.IGDB_ERROR).toBeLessThan(4000);

    // Database errors are 4xxx
    expect(ErrorCode.DATABASE_ERROR).toBeGreaterThanOrEqual(4000);
    expect(ErrorCode.DATABASE_ERROR).toBeLessThan(5000);

    // File system errors are 5xxx
    expect(ErrorCode.FILE_ERROR).toBeGreaterThanOrEqual(5000);
    expect(ErrorCode.FILE_ERROR).toBeLessThan(6000);
  });
});

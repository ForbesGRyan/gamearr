import { describe, expect, test, mock } from 'bun:test';
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
  SteamError,
  GogError,
  DatabaseError,
  FileSystemError,
  PathTraversalError,
  ErrorCode,
  toAppError,
  formatErrorResponse,
  getHttpStatusCode,
  routeHandler,
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

    test('SteamError should use Steam prefix', () => {
      const error = new SteamError('API unavailable');

      expect(error.message).toBe('Steam: API unavailable');
      expect(error.service).toBe('Steam');
      expect(error.code).toBe(ErrorCode.STEAM_ERROR);
    });

    test('SteamError should accept custom error code', () => {
      const error = new SteamError('Auth failed', ErrorCode.STEAM_AUTH_FAILED);

      expect(error.message).toBe('Steam: Auth failed');
      expect(error.code).toBe(ErrorCode.STEAM_AUTH_FAILED);
    });

    test('GogError should use GOG prefix', () => {
      const error = new GogError('Service unavailable');

      expect(error.message).toBe('GOG: Service unavailable');
      expect(error.service).toBe('GOG');
      expect(error.code).toBe(ErrorCode.GOG_ERROR);
    });

    test('GogError should accept custom error code', () => {
      const error = new GogError('Token expired', ErrorCode.GOG_TOKEN_EXPIRED);

      expect(error.message).toBe('GOG: Token expired');
      expect(error.code).toBe(ErrorCode.GOG_TOKEN_EXPIRED);
    });

    test('IntegrationError should accept custom error code', () => {
      const error = new IntegrationError('CustomService', 'Custom error', ErrorCode.IGDB_RATE_LIMITED, 429);

      expect(error.message).toBe('CustomService: Custom error');
      expect(error.service).toBe('CustomService');
      expect(error.code).toBe(ErrorCode.IGDB_RATE_LIMITED);
      expect(error.statusCode).toBe(429);
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

    test('should accept custom error code', () => {
      const error = new FileSystemError('Path not accessible', ErrorCode.PATH_NOT_FOUND);

      expect(error.message).toBe('Path not accessible');
      expect(error.code).toBe(ErrorCode.PATH_NOT_FOUND);
    });

    test('should accept permission denied code', () => {
      const error = new FileSystemError('Access denied', ErrorCode.PERMISSION_DENIED);

      expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });
  });

  describe('PathTraversalError', () => {
    test('should create with default message', () => {
      const error = new PathTraversalError();

      expect(error.message).toBe('Path traversal attempt detected');
      expect(error.code).toBe(ErrorCode.PATH_TRAVERSAL);
      expect(error.statusCode).toBe(403);
    });

    test('should accept custom message', () => {
      const error = new PathTraversalError('Attempted to access parent directory');

      expect(error.message).toBe('Attempted to access parent directory');
      expect(error.code).toBe(ErrorCode.PATH_TRAVERSAL);
      expect(error.statusCode).toBe(403);
    });

    test('should be instance of AppError', () => {
      const error = new PathTraversalError();

      expect(error instanceof AppError).toBe(true);
      expect(error instanceof Error).toBe(true);
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

  describe('getHttpStatusCode', () => {
    test('should return statusCode from AppError', () => {
      const error = new AppError('Test', ErrorCode.UNKNOWN, 503);
      expect(getHttpStatusCode(error)).toBe(503);
    });

    test('should return 404 for NotFoundError', () => {
      const error = new NotFoundError('Game');
      expect(getHttpStatusCode(error)).toBe(404);
    });

    test('should return 400 for ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(getHttpStatusCode(error)).toBe(400);
    });

    test('should return 409 for ConflictError', () => {
      const error = new ConflictError('Duplicate');
      expect(getHttpStatusCode(error)).toBe(409);
    });

    test('should return 502 for IntegrationError', () => {
      const error = new IntegrationError('Service', 'Error');
      expect(getHttpStatusCode(error)).toBe(502);
    });

    test('should return 403 for PathTraversalError', () => {
      const error = new PathTraversalError();
      expect(getHttpStatusCode(error)).toBe(403);
    });

    test('should return 500 for standard Error', () => {
      const error = new Error('Standard error');
      expect(getHttpStatusCode(error)).toBe(500);
    });

    test('should return 500 for non-Error types', () => {
      expect(getHttpStatusCode('string error')).toBe(500);
      expect(getHttpStatusCode(null)).toBe(500);
      expect(getHttpStatusCode(undefined)).toBe(500);
      expect(getHttpStatusCode({ message: 'object' })).toBe(500);
    });
  });

  describe('routeHandler', () => {
    // Helper to create mock Hono context
    function createMockContext(overrides = {}) {
      const jsonMock = mock((data: unknown, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      return {
        json: jsonMock,
        req: {
          json: mock(async () => ({})),
          query: mock((key: string) => undefined),
          param: mock((key: string) => undefined),
        },
        ...overrides,
      };
    }

    test('should return success response on successful handler', async () => {
      const handler = routeHandler(
        async (c) => ({ success: true, data: { id: 1 } }),
        'Test operation'
      );
      const ctx = createMockContext();

      const result = await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
    });

    test('should catch and format errors', async () => {
      const logFn = mock(() => {});
      const handler = routeHandler(
        async (c) => {
          throw new ValidationError('Invalid data');
        },
        'Test operation',
        logFn
      );
      const ctx = createMockContext();

      await handler(ctx);

      expect(logFn).toHaveBeenCalledWith('Test operation failed:', expect.any(ValidationError));
      expect(ctx.json).toHaveBeenCalledWith(
        { success: false, error: 'Invalid data', code: ErrorCode.VALIDATION_ERROR },
        400
      );
    });

    test('should pass through Response objects directly', async () => {
      const directResponse = new Response('Direct', { status: 201 });
      const handler = routeHandler(
        async (c) => directResponse,
        'Test operation'
      );
      const ctx = createMockContext();

      const result = await handler(ctx);

      expect(result).toBe(directResponse);
      expect(ctx.json).not.toHaveBeenCalled();
    });

    test('should use correct status code for different error types', async () => {
      const logFn = mock(() => {});

      // NotFoundError should return 404
      const handler404 = routeHandler(
        async (c) => {
          throw new NotFoundError('Game', 123);
        },
        'Get game',
        logFn
      );
      const ctx404 = createMockContext();
      await handler404(ctx404);
      expect(ctx404.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        404
      );

      // ConflictError should return 409
      const handler409 = routeHandler(
        async (c) => {
          throw new ConflictError('Already exists');
        },
        'Create game',
        logFn
      );
      const ctx409 = createMockContext();
      await handler409(ctx409);
      expect(ctx409.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        409
      );

      // IntegrationError should return 502
      const handler502 = routeHandler(
        async (c) => {
          throw new IGDBError('API unavailable');
        },
        'Search IGDB',
        logFn
      );
      const ctx502 = createMockContext();
      await handler502(ctx502);
      expect(ctx502.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
        502
      );
    });

    test('should handle unknown error types', async () => {
      const logFn = mock(() => {});
      const handler = routeHandler(
        async (c) => {
          throw 'string error';
        },
        'Test operation',
        logFn
      );
      const ctx = createMockContext();

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith(
        { success: false, error: 'string error', code: ErrorCode.UNKNOWN },
        500
      );
    });

    test('should include operation name in log message', async () => {
      const logFn = mock(() => {});
      const handler = routeHandler(
        async (c) => {
          throw new Error('Test error');
        },
        'Fetch games from database',
        logFn
      );
      const ctx = createMockContext();

      await handler(ctx);

      expect(logFn).toHaveBeenCalledWith('Fetch games from database failed:', expect.any(Error));
    });

    test('should work with async handlers that access context', async () => {
      const ctx = createMockContext({
        req: {
          json: mock(async () => ({ name: 'Test Game' })),
          query: mock((key: string) => key === 'limit' ? '10' : undefined),
          param: mock((key: string) => key === 'id' ? '42' : undefined),
        },
      });

      const handler = routeHandler(
        async (c) => {
          const body = await c.req.json();
          const limit = c.req.query('limit');
          const id = c.req.param('id');
          return { success: true, data: { body, limit, id } };
        },
        'Process request'
      );

      await handler(ctx);

      expect(ctx.json).toHaveBeenCalledWith({
        success: true,
        data: { body: { name: 'Test Game' }, limit: '10', id: '42' },
      });
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

  test('Steam error codes should be in 3300 range', () => {
    expect(ErrorCode.STEAM_ERROR).toBe(3300);
    expect(ErrorCode.STEAM_AUTH_FAILED).toBe(3301);
    expect(ErrorCode.STEAM_NOT_CONFIGURED).toBe(3302);
  });

  test('GOG error codes should be in 3400 range', () => {
    expect(ErrorCode.GOG_ERROR).toBe(3400);
    expect(ErrorCode.GOG_AUTH_FAILED).toBe(3401);
    expect(ErrorCode.GOG_NOT_CONFIGURED).toBe(3402);
    expect(ErrorCode.GOG_TOKEN_EXPIRED).toBe(3403);
  });
});

describe('Error Inheritance', () => {
  test('all custom errors should be instances of Error', () => {
    const errors = [
      new AppError('test'),
      new NotFoundError('Resource'),
      new ValidationError('invalid'),
      new ConflictError('conflict'),
      new NotConfiguredError('service'),
      new IntegrationError('service', 'message'),
      new IGDBError('message'),
      new ProwlarrError('message'),
      new QBittorrentError('message'),
      new SteamError('message'),
      new GogError('message'),
      new DatabaseError('message'),
      new FileSystemError('message'),
      new PathTraversalError(),
    ];

    for (const error of errors) {
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    }
  });

  test('integration errors should be instances of IntegrationError', () => {
    const integrationErrors = [
      new IGDBError('message'),
      new ProwlarrError('message'),
      new QBittorrentError('message'),
      new SteamError('message'),
      new GogError('message'),
    ];

    for (const error of integrationErrors) {
      expect(error instanceof IntegrationError).toBe(true);
    }
  });

  test('errors should have stack trace', () => {
    const error = new AppError('Test');
    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    // Stack trace should contain the test file location
    expect(error.stack!.length).toBeGreaterThan(0);
  });

  test('errors should maintain prototype chain', () => {
    const error = new NotFoundError('Game');

    expect(Object.getPrototypeOf(error)).toBe(NotFoundError.prototype);
    expect(Object.getPrototypeOf(NotFoundError.prototype)).toBe(AppError.prototype);
    expect(Object.getPrototypeOf(AppError.prototype)).toBe(Error.prototype);
  });
});

describe('Edge Cases', () => {
  test('toAppError should handle number values', () => {
    const result = toAppError(42);
    expect(result.message).toBe('42');
    expect(result instanceof AppError).toBe(true);
  });

  test('toAppError should handle boolean values', () => {
    const result = toAppError(false);
    expect(result.message).toBe('false');
  });

  test('toAppError should handle arrays', () => {
    const result = toAppError([1, 2, 3]);
    expect(result.message).toBe('1,2,3');
  });

  test('formatErrorResponse should handle null', () => {
    const response = formatErrorResponse(null);
    expect(response.success).toBe(false);
    expect(response.error).toBe('null');
    expect(response.code).toBe(ErrorCode.UNKNOWN);
  });

  test('formatErrorResponse should handle undefined', () => {
    const response = formatErrorResponse(undefined);
    expect(response.success).toBe(false);
    expect(response.error).toBe('undefined');
    expect(response.code).toBe(ErrorCode.UNKNOWN);
  });

  test('NotFoundError with empty string identifier', () => {
    const error = new NotFoundError('Game', '');
    // Empty string is falsy, so it should show just "Game not found"
    expect(error.message).toBe('Game not found');
  });

  test('NotFoundError with 0 identifier', () => {
    const error = new NotFoundError('Game', 0);
    // 0 is falsy but it's a valid identifier
    expect(error.message).toBe('Game not found');
  });

  test('AppError with empty message', () => {
    const error = new AppError('');
    expect(error.message).toBe('');
    expect(error.code).toBe(ErrorCode.UNKNOWN);
  });

  test('NotConfiguredError with various service names', () => {
    const services = ['IGDB', 'qBittorrent', 'Steam API', 'GOG Galaxy'];

    for (const service of services) {
      const error = new NotConfiguredError(service);
      expect(error.message).toContain(service);
      expect(error.message).toContain('not configured');
    }
  });
});

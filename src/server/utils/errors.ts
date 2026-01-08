/**
 * Custom error classes for Gamearr
 * Provides consistent error handling across the application
 */

export enum ErrorCode {
  // General errors (1xxx)
  UNKNOWN = 1000,
  VALIDATION_ERROR = 1001,
  NOT_FOUND = 1002,
  CONFLICT = 1003,

  // Configuration errors (2xxx)
  NOT_CONFIGURED = 2000,
  INVALID_CONFIGURATION = 2001,

  // Integration errors (3xxx)
  IGDB_ERROR = 3000,
  IGDB_AUTH_FAILED = 3001,
  IGDB_RATE_LIMITED = 3002,

  PROWLARR_ERROR = 3100,
  PROWLARR_CONNECTION_FAILED = 3101,
  PROWLARR_NOT_CONFIGURED = 3102,

  QBITTORRENT_ERROR = 3200,
  QBITTORRENT_CONNECTION_FAILED = 3201,
  QBITTORRENT_NOT_CONFIGURED = 3202,
  QBITTORRENT_AUTH_FAILED = 3203,

  STEAM_ERROR = 3300,
  STEAM_AUTH_FAILED = 3301,
  STEAM_NOT_CONFIGURED = 3302,

  // Database errors (4xxx)
  DATABASE_ERROR = 4000,
  DUPLICATE_ENTRY = 4001,

  // File system errors (5xxx)
  FILE_ERROR = 5000,
  PATH_NOT_FOUND = 5001,
  PERMISSION_DENIED = 5002,
  PATH_TRAVERSAL = 5003,
}

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with ID '${identifier}' not found`
      : `${resource} not found`;
    super(message, ErrorCode.NOT_FOUND, 404);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.VALIDATION_ERROR, 400);
  }
}

/**
 * Conflict error (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT, 409);
  }
}

/**
 * Service not configured error
 */
export class NotConfiguredError extends AppError {
  constructor(service: string) {
    super(
      `${service} is not configured. Please add your ${service} settings.`,
      ErrorCode.NOT_CONFIGURED,
      400
    );
  }
}

/**
 * Integration error base class
 */
export class IntegrationError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    statusCode: number = 502
  ) {
    super(`${service}: ${message}`, code, statusCode);
    this.service = service;
  }
}

/**
 * IGDB integration errors
 */
export class IGDBError extends IntegrationError {
  constructor(message: string, code: ErrorCode = ErrorCode.IGDB_ERROR) {
    super('IGDB', message, code);
  }
}

/**
 * Prowlarr integration errors
 */
export class ProwlarrError extends IntegrationError {
  constructor(message: string, code: ErrorCode = ErrorCode.PROWLARR_ERROR) {
    super('Prowlarr', message, code);
  }
}

/**
 * qBittorrent integration errors
 */
export class QBittorrentError extends IntegrationError {
  constructor(message: string, code: ErrorCode = ErrorCode.QBITTORRENT_ERROR) {
    super('qBittorrent', message, code);
  }
}

/**
 * Steam integration errors
 */
export class SteamError extends IntegrationError {
  constructor(message: string, code: ErrorCode = ErrorCode.STEAM_ERROR) {
    super('Steam', message, code);
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.DATABASE_ERROR) {
    super(message, code, 500);
  }
}

/**
 * File system error
 */
export class FileSystemError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCode.FILE_ERROR) {
    super(message, code, 500);
  }
}

/**
 * Path traversal attempt error (security)
 */
export class PathTraversalError extends AppError {
  constructor(message: string = 'Path traversal attempt detected') {
    super(message, ErrorCode.PATH_TRAVERSAL, 403);
  }
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message);
  }

  return new AppError(String(error));
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: unknown): {
  success: false;
  error: string;
  code?: ErrorCode;
} {
  const appError = toAppError(error);

  return {
    success: false,
    error: appError.message,
    code: appError.code,
  };
}

/**
 * Get appropriate HTTP status code for an error
 */
export function getHttpStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Type for Hono Context (simplified for route handler wrapper)
 */
interface HonoContext {
  json: (data: unknown, status?: number) => Response;
  req: {
    json: () => Promise<unknown>;
    query: (key: string) => string | undefined;
    param: (key: string) => string | undefined;
  };
}

/**
 * Route handler wrapper for consistent error handling
 * Wraps async route handlers with try-catch and standardized error responses
 *
 * @example
 * // Before:
 * games.get('/:id', async (c) => {
 *   try {
 *     const id = parseInt(c.req.param('id')!);
 *     const game = await gameRepository.findById(id);
 *     return c.json({ success: true, data: game });
 *   } catch (error) {
 *     logger.error('Get game failed:', error);
 *     return c.json(formatErrorResponse(error), getHttpStatusCode(error));
 *   }
 * });
 *
 * // After:
 * games.get('/:id', routeHandler(async (c) => {
 *   const id = parseInt(c.req.param('id')!);
 *   const game = await gameRepository.findById(id);
 *   return { success: true, data: game };
 * }, 'Get game'));
 */
export function routeHandler<T>(
  handler: (c: HonoContext) => Promise<{ success: boolean; data?: T; error?: string } | Response>,
  operationName: string,
  logFn: (message: string, ...args: unknown[]) => void = console.error
): (c: HonoContext) => Promise<Response> {
  return async (c: HonoContext): Promise<Response> => {
    try {
      const result = await handler(c);
      // If handler returns a Response directly (for special cases), pass it through
      if (result instanceof Response) {
        return result;
      }
      return c.json(result);
    } catch (error) {
      logFn(`${operationName} failed:`, error);
      return c.json(formatErrorResponse(error), getHttpStatusCode(error));
    }
  };
}

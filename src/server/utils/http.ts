/**
 * Shared HTTP utility for connection pooling and keep-alive.
 * Bun's native fetch already supports HTTP/1.1 keep-alive and HTTP/2 multiplexing,
 * but we centralize configuration here to ensure consistent behavior across all clients.
 */

/**
 * Default fetch options that enable HTTP keep-alive for connection reuse.
 * These options help maintain persistent connections to frequently accessed hosts.
 */
export const defaultFetchOptions: RequestInit = {
  // Enable keep-alive for HTTP/1.1 connections
  keepalive: true,
};

/**
 * Creates fetch options with keep-alive enabled and optional additional headers.
 * Merges default connection pooling options with provided options.
 */
export function createFetchOptions(options: RequestInit = {}): RequestInit {
  return {
    ...defaultFetchOptions,
    ...options,
    headers: {
      // Connection keep-alive header for HTTP/1.1 servers that need explicit header
      Connection: 'keep-alive',
      ...options.headers,
    },
  };
}

/**
 * Wrapper around fetch that automatically applies keep-alive options.
 * Use this instead of raw fetch() for external API calls to benefit from
 * connection pooling and reuse.
 */
export async function fetchWithPooling(
  url: string | URL | Request,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, createFetchOptions(options));
}

/**
 * Configuration for retry behavior on transient failures.
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Default retry configuration for HTTP requests.
 */
export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Determines if an error is retryable (network errors, 5xx responses, rate limits).
 */
export function isRetryableError(error: unknown, response?: Response): boolean {
  // Network errors are always retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check HTTP status codes
  if (response) {
    // 429 Too Many Requests - should retry after backoff
    if (response.status === 429) return true;
    // 5xx Server errors - may be transient
    if (response.status >= 500 && response.status < 600) return true;
    // 408 Request Timeout
    if (response.status === 408) return true;
  }

  return false;
}

/**
 * Calculates exponential backoff delay with jitter.
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig = defaultRetryConfig
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add random jitter (0-25% of delay)
  const jitter = cappedDelay * Math.random() * 0.25;
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Default rate limit configuration (4 requests per second)
 */
export const defaultRateLimitConfig: RateLimitConfig = {
  maxRequests: 4,
  windowMs: 1000,
};

/**
 * Simple in-memory rate limiter using token bucket algorithm.
 * Thread-safe for concurrent async operations.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRateMs: number;
  private waitQueue: Array<() => void> = [];

  constructor(config: RateLimitConfig = defaultRateLimitConfig) {
    this.maxTokens = config.maxRequests;
    this.tokens = config.maxRequests;
    this.refillRateMs = config.windowMs / config.maxRequests;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary.
   * Returns a promise that resolves when the request can proceed.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time until next token is available
    const waitMs = Math.max(0, this.refillRateMs - (Date.now() - this.lastRefill));

    return new Promise<void>((resolve) => {
      // Add to wait queue
      this.waitQueue.push(resolve);

      // Schedule the token grant
      setTimeout(() => {
        this.refill();
        const waiting = this.waitQueue.shift();
        if (waiting) {
          this.tokens -= 1;
          waiting();
        }
      }, waitMs);
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed / this.refillRateMs);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

/**
 * Fetch with automatic retry on transient failures.
 * Uses exponential backoff with jitter.
 */
export async function fetchWithRetry(
  url: string | URL | Request,
  options: RequestInit = {},
  retryConfig: RetryConfig = defaultRetryConfig
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetchWithPooling(url, options);

      // Check if we should retry based on response status
      if (isRetryableError(null, response) && attempt < retryConfig.maxRetries) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        let delayMs: number;

        if (retryAfter) {
          const retryAfterSeconds = parseInt(retryAfter, 10);
          if (!isNaN(retryAfterSeconds)) {
            delayMs = Math.min(retryAfterSeconds * 1000, retryConfig.maxDelayMs);
          } else {
            delayMs = calculateBackoff(attempt, retryConfig);
          }
        } else {
          delayMs = calculateBackoff(attempt, retryConfig);
        }

        await sleep(delayMs);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry network errors
      if (isRetryableError(error) && attempt < retryConfig.maxRetries) {
        const delayMs = calculateBackoff(attempt, retryConfig);
        await sleep(delayMs);
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create a rate-limited fetch function that also retries on failures.
 * Useful for API clients that need to respect rate limits.
 */
export function createRateLimitedFetch(
  rateLimitConfig: RateLimitConfig = defaultRateLimitConfig,
  retryConfig: RetryConfig = defaultRetryConfig
): (url: string | URL | Request, options?: RequestInit) => Promise<Response> {
  const rateLimiter = new RateLimiter(rateLimitConfig);

  return async (url: string | URL | Request, options: RequestInit = {}): Promise<Response> => {
    await rateLimiter.acquire();
    return fetchWithRetry(url, options, retryConfig);
  };
}

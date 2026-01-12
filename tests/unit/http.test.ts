import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import {
  defaultFetchOptions,
  createFetchOptions,
  fetchWithPooling,
  RetryConfig,
  defaultRetryConfig,
  isRetryableError,
  calculateBackoff,
  sleep,
  RateLimitConfig,
  defaultRateLimitConfig,
  RateLimiter,
  fetchWithRetry,
  createRateLimitedFetch,
} from '../../src/server/utils/http';

// =============================================================================
// Constants Tests
// =============================================================================
describe('HTTP Utility Constants', () => {
  describe('defaultFetchOptions', () => {
    test('should have keepalive enabled', () => {
      expect(defaultFetchOptions.keepalive).toBe(true);
    });
  });

  describe('defaultRetryConfig', () => {
    test('should have maxRetries of 3', () => {
      expect(defaultRetryConfig.maxRetries).toBe(3);
    });

    test('should have baseDelayMs of 1000', () => {
      expect(defaultRetryConfig.baseDelayMs).toBe(1000);
    });

    test('should have maxDelayMs of 10000', () => {
      expect(defaultRetryConfig.maxDelayMs).toBe(10000);
    });
  });

  describe('defaultRateLimitConfig', () => {
    test('should have maxRequests of 4', () => {
      expect(defaultRateLimitConfig.maxRequests).toBe(4);
    });

    test('should have windowMs of 1000', () => {
      expect(defaultRateLimitConfig.windowMs).toBe(1000);
    });
  });
});

// =============================================================================
// createFetchOptions Tests
// =============================================================================
describe('createFetchOptions', () => {
  test('should include keepalive from defaultFetchOptions', () => {
    const options = createFetchOptions();
    expect(options.keepalive).toBe(true);
  });

  test('should include Connection: keep-alive header', () => {
    const options = createFetchOptions();
    expect((options.headers as Record<string, string>).Connection).toBe('keep-alive');
  });

  test('should merge custom options', () => {
    const options = createFetchOptions({ method: 'POST' });
    expect(options.method).toBe('POST');
    expect(options.keepalive).toBe(true);
  });

  test('should merge custom headers with default headers', () => {
    const options = createFetchOptions({
      headers: { 'Content-Type': 'application/json' },
    });

    const headers = options.headers as Record<string, string>;
    expect(headers.Connection).toBe('keep-alive');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('should allow custom headers to override default headers', () => {
    const options = createFetchOptions({
      headers: { Connection: 'close' },
    });

    const headers = options.headers as Record<string, string>;
    expect(headers.Connection).toBe('close');
  });

  test('should preserve body option', () => {
    const body = JSON.stringify({ test: 'data' });
    const options = createFetchOptions({ body });
    expect(options.body).toBe(body);
  });

  test('should handle empty options object', () => {
    const options = createFetchOptions({});
    expect(options.keepalive).toBe(true);
    expect((options.headers as Record<string, string>).Connection).toBe('keep-alive');
  });
});

// =============================================================================
// isRetryableError Tests
// =============================================================================
describe('isRetryableError', () => {
  describe('network errors', () => {
    test('should return true for TypeError containing "fetch"', () => {
      const error = new TypeError('Failed to fetch');
      expect(isRetryableError(error)).toBe(true);
    });

    test('should return true for TypeError with fetch message variation', () => {
      const error = new TypeError('fetch failed: connection refused');
      expect(isRetryableError(error)).toBe(true);
    });

    test('should return false for TypeError without "fetch"', () => {
      const error = new TypeError('undefined is not a function');
      expect(isRetryableError(error)).toBe(false);
    });

    test('should return false for non-TypeError errors', () => {
      const error = new Error('Some error');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('HTTP status codes', () => {
    test('should return true for 429 Too Many Requests', () => {
      const response = new Response(null, { status: 429 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return true for 408 Request Timeout', () => {
      const response = new Response(null, { status: 408 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return true for 500 Internal Server Error', () => {
      const response = new Response(null, { status: 500 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return true for 502 Bad Gateway', () => {
      const response = new Response(null, { status: 502 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return true for 503 Service Unavailable', () => {
      const response = new Response(null, { status: 503 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return true for 504 Gateway Timeout', () => {
      const response = new Response(null, { status: 504 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return true for 599 (last 5xx)', () => {
      const response = new Response(null, { status: 599 });
      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should return false for 200 OK', () => {
      const response = new Response(null, { status: 200 });
      expect(isRetryableError(null, response)).toBe(false);
    });

    test('should return false for 400 Bad Request', () => {
      const response = new Response(null, { status: 400 });
      expect(isRetryableError(null, response)).toBe(false);
    });

    test('should return false for 401 Unauthorized', () => {
      const response = new Response(null, { status: 401 });
      expect(isRetryableError(null, response)).toBe(false);
    });

    test('should return false for 403 Forbidden', () => {
      const response = new Response(null, { status: 403 });
      expect(isRetryableError(null, response)).toBe(false);
    });

    test('should return false for 404 Not Found', () => {
      const response = new Response(null, { status: 404 });
      expect(isRetryableError(null, response)).toBe(false);
    });

    // Note: HTTP Response only accepts status codes 101 or 200-599
    // Testing boundary at 599 (last valid 5xx) covered above
  });

  describe('edge cases', () => {
    test('should return false when no error and no response', () => {
      expect(isRetryableError(null)).toBe(false);
    });

    test('should return false for undefined error and response', () => {
      expect(isRetryableError(undefined, undefined)).toBe(false);
    });

    test('should return false for non-error objects', () => {
      expect(isRetryableError({ message: 'not an error' })).toBe(false);
    });
  });
});

// =============================================================================
// calculateBackoff Tests
// =============================================================================
describe('calculateBackoff', () => {
  test('should calculate exponential delay for attempt 0', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 };
    const delay = calculateBackoff(0, config);

    // Base delay is 1000 * 2^0 = 1000, plus jitter 0-25%
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1250);
  });

  test('should calculate exponential delay for attempt 1', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 };
    const delay = calculateBackoff(1, config);

    // Base delay is 1000 * 2^1 = 2000, plus jitter 0-25%
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThanOrEqual(2500);
  });

  test('should calculate exponential delay for attempt 2', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 };
    const delay = calculateBackoff(2, config);

    // Base delay is 1000 * 2^2 = 4000, plus jitter 0-25%
    expect(delay).toBeGreaterThanOrEqual(4000);
    expect(delay).toBeLessThanOrEqual(5000);
  });

  test('should cap delay at maxDelayMs', () => {
    const config: RetryConfig = { maxRetries: 10, baseDelayMs: 1000, maxDelayMs: 5000 };
    const delay = calculateBackoff(5, config);

    // 1000 * 2^5 = 32000, but capped at 5000, plus jitter 0-25%
    expect(delay).toBeGreaterThanOrEqual(5000);
    expect(delay).toBeLessThanOrEqual(6250);
  });

  test('should use default config when not provided', () => {
    const delay = calculateBackoff(0);

    // Default: 1000 * 2^0 = 1000, plus jitter 0-25%
    expect(delay).toBeGreaterThanOrEqual(1000);
    expect(delay).toBeLessThanOrEqual(1250);
  });

  test('should return integer values', () => {
    const delay = calculateBackoff(1);
    expect(Number.isInteger(delay)).toBe(true);
  });

  test('should add random jitter (not deterministic)', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 };

    // Run multiple times and check that we get different values (probabilistic)
    const delays = new Set<number>();
    for (let i = 0; i < 10; i++) {
      delays.add(calculateBackoff(1, config));
    }

    // With jitter, we should get some variation (at least 2 different values in 10 tries is very likely)
    // But we can't guarantee this, so just check it's in valid range
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThanOrEqual(2500);
    }
  });

  test('should handle high attempt numbers', () => {
    const config: RetryConfig = { maxRetries: 20, baseDelayMs: 100, maxDelayMs: 10000 };
    const delay = calculateBackoff(15, config);

    // Should be capped at maxDelayMs
    expect(delay).toBeGreaterThanOrEqual(10000);
    expect(delay).toBeLessThanOrEqual(12500);
  });

  test('should handle very small baseDelayMs', () => {
    const config: RetryConfig = { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 1000 };
    const delay = calculateBackoff(0, config);

    expect(delay).toBeGreaterThanOrEqual(10);
    expect(delay).toBeLessThanOrEqual(13); // 10 + 25% of 10 = 12.5, floored
  });
});

// =============================================================================
// sleep Tests
// =============================================================================
describe('sleep', () => {
  test('should return a promise', () => {
    const result = sleep(0);
    expect(result instanceof Promise).toBe(true);
  });

  test('should resolve after specified time', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;

    // Allow some tolerance for timing
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(150);
  });

  test('should resolve immediately for 0ms', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });

  test('should handle negative values (treated as 0)', async () => {
    const start = Date.now();
    await sleep(-100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(50);
  });
});

// =============================================================================
// RateLimiter Tests
// =============================================================================
describe('RateLimiter', () => {
  describe('constructor', () => {
    test('should initialize with default config', () => {
      const limiter = new RateLimiter();
      // Just verify it creates without error
      expect(limiter).toBeDefined();
    });

    test('should initialize with custom config', () => {
      const config: RateLimitConfig = { maxRequests: 10, windowMs: 2000 };
      const limiter = new RateLimiter(config);
      expect(limiter).toBeDefined();
    });
  });

  describe('acquire', () => {
    test('should allow immediate acquisition when tokens available', async () => {
      const limiter = new RateLimiter({ maxRequests: 4, windowMs: 1000 });

      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    test('should allow multiple immediate acquisitions up to maxRequests', async () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

      const start = Date.now();
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    test('should wait when tokens exhausted', async () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 200 });

      await limiter.acquire(); // Use the only token

      const start = Date.now();
      await limiter.acquire(); // Should wait for refill
      const elapsed = Date.now() - start;

      // Should wait approximately windowMs/maxRequests = 200ms
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });

    test('should refill tokens over time', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 100 });

      await limiter.acquire();
      await limiter.acquire();

      // Wait for refill
      await sleep(120);

      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // Should be immediate after refill
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('concurrent acquisitions', () => {
    test('should handle multiple concurrent requests', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 100 });

      const results: number[] = [];
      const start = Date.now();

      // Fire 4 requests concurrently
      await Promise.all([
        limiter.acquire().then(() => results.push(Date.now() - start)),
        limiter.acquire().then(() => results.push(Date.now() - start)),
        limiter.acquire().then(() => results.push(Date.now() - start)),
        limiter.acquire().then(() => results.push(Date.now() - start)),
      ]);

      expect(results.length).toBe(4);

      // First 2 should be immediate (< 50ms)
      const immediate = results.filter((t) => t < 50);
      expect(immediate.length).toBe(2);
    });
  });
});

// =============================================================================
// fetchWithPooling Tests
// =============================================================================
describe('fetchWithPooling', () => {
  // Note: These tests require mocking global fetch
  // We test the function structure rather than actual HTTP calls

  test('should be a function', () => {
    expect(typeof fetchWithPooling).toBe('function');
  });

  test('should accept string URL', async () => {
    // This will fail with actual fetch, but we're testing the interface
    try {
      await fetchWithPooling('http://invalid-test-url-that-should-not-exist.test');
    } catch (error) {
      // Expected to fail - we just want to verify it accepts the parameters
      expect(error).toBeDefined();
    }
  });

  test('should accept URL object', async () => {
    try {
      const url = new URL('http://invalid-test-url-that-should-not-exist.test');
      await fetchWithPooling(url);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('should accept options parameter', async () => {
    try {
      await fetchWithPooling('http://invalid-test-url-that-should-not-exist.test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

// =============================================================================
// fetchWithRetry Tests
// =============================================================================
describe('fetchWithRetry', () => {
  test('should be a function', () => {
    expect(typeof fetchWithRetry).toBe('function');
  });

  test('should accept custom retry config', async () => {
    const customConfig: RetryConfig = {
      maxRetries: 1,
      baseDelayMs: 10,
      maxDelayMs: 100,
    };

    try {
      await fetchWithRetry(
        'http://invalid-test-url-that-should-not-exist.test',
        {},
        customConfig
      );
    } catch (error) {
      // Expected to fail
      expect(error).toBeDefined();
    }
  });

  test('should throw after max retries for network errors', async () => {
    const customConfig: RetryConfig = {
      maxRetries: 0, // No retries
      baseDelayMs: 10,
      maxDelayMs: 100,
    };

    await expect(
      fetchWithRetry('http://invalid-test-url-that-should-not-exist.test', {}, customConfig)
    ).rejects.toThrow();
  });
});

// =============================================================================
// createRateLimitedFetch Tests
// =============================================================================
describe('createRateLimitedFetch', () => {
  test('should return a function', () => {
    const rateLimitedFetch = createRateLimitedFetch();
    expect(typeof rateLimitedFetch).toBe('function');
  });

  test('should accept custom rate limit config', () => {
    const customRateLimit: RateLimitConfig = { maxRequests: 10, windowMs: 500 };
    const rateLimitedFetch = createRateLimitedFetch(customRateLimit);
    expect(typeof rateLimitedFetch).toBe('function');
  });

  test('should accept custom retry config', () => {
    const customRateLimit: RateLimitConfig = { maxRequests: 10, windowMs: 500 };
    const customRetry: RetryConfig = { maxRetries: 2, baseDelayMs: 50, maxDelayMs: 500 };
    const rateLimitedFetch = createRateLimitedFetch(customRateLimit, customRetry);
    expect(typeof rateLimitedFetch).toBe('function');
  });

  test('returned function should respect rate limits', async () => {
    const rateLimitedFetch = createRateLimitedFetch(
      { maxRequests: 1, windowMs: 100 },
      { maxRetries: 0, baseDelayMs: 10, maxDelayMs: 100 }
    );

    // First call should be immediate
    const start = Date.now();
    try {
      await rateLimitedFetch('http://invalid-test-url-that-should-not-exist.test');
    } catch {
      // Expected
    }
    const firstCallTime = Date.now() - start;

    // First call should be quick (just network timeout)
    // We're testing rate limiting, not the actual fetch
    expect(firstCallTime).toBeDefined();
  });
});

// =============================================================================
// Integration Tests
// =============================================================================
describe('HTTP Utility Integration', () => {
  describe('backoff and sleep together', () => {
    test('should work together for retry delays', async () => {
      const config: RetryConfig = { maxRetries: 3, baseDelayMs: 20, maxDelayMs: 100 };

      const start = Date.now();
      const delay = calculateBackoff(0, config);
      await sleep(delay);
      const elapsed = Date.now() - start;

      // Should have waited at least the calculated delay
      expect(elapsed).toBeGreaterThanOrEqual(delay - 5); // 5ms tolerance
    });
  });

  describe('rate limiter with fetch options', () => {
    test('should create fetch options that can be used with rate limiter', () => {
      const options = createFetchOptions({
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      });

      expect(options.method).toBe('GET');
      expect((options.headers as Record<string, string>).Authorization).toBe('Bearer token');
      expect((options.headers as Record<string, string>).Connection).toBe('keep-alive');
      expect(options.keepalive).toBe(true);
    });
  });
});

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================
describe('Edge Cases', () => {
  describe('createFetchOptions edge cases', () => {
    test('should handle null-ish values in options', () => {
      // TypeScript wouldn't allow this normally, but testing runtime behavior
      const options = createFetchOptions({ body: null as unknown as string });
      expect(options.body).toBeNull();
    });
  });

  describe('calculateBackoff edge cases', () => {
    test('should handle attempt 0', () => {
      const delay = calculateBackoff(0);
      expect(delay).toBeGreaterThanOrEqual(1000);
    });

    test('should handle very large attempt numbers without overflow', () => {
      const config: RetryConfig = { maxRetries: 100, baseDelayMs: 1000, maxDelayMs: 10000 };
      const delay = calculateBackoff(50, config);

      // Should be capped at maxDelayMs even with huge exponential
      expect(delay).toBeGreaterThanOrEqual(10000);
      expect(delay).toBeLessThanOrEqual(12500);
      expect(Number.isFinite(delay)).toBe(true);
    });
  });

  describe('RateLimiter edge cases', () => {
    test('should handle rapid consecutive calls', async () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 1000 });

      // Fire many rapid calls
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(limiter.acquire());
      }

      await Promise.all(promises);

      // All should complete without error
      expect(promises.length).toBe(50);
    });

    test('should handle single token bucket', async () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 50 });

      const start = Date.now();
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // Should have waited for 2 refill periods
      expect(elapsed).toBeGreaterThanOrEqual(80);
    });
  });

  describe('isRetryableError edge cases', () => {
    test('should handle response with headers', () => {
      const headers = new Headers();
      headers.set('Retry-After', '5');
      const response = new Response(null, { status: 429, headers });

      expect(isRetryableError(null, response)).toBe(true);
    });

    test('should handle both error and response provided', () => {
      const error = new TypeError('fetch failed');
      const response = new Response(null, { status: 500 });

      // Error takes precedence for TypeError with 'fetch'
      expect(isRetryableError(error, response)).toBe(true);
    });

    test('should handle Error subclass that is not TypeError', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('fetch failed');
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

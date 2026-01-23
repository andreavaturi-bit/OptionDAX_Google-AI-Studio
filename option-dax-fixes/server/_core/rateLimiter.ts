/**
 * Simple in-memory rate limiter for API endpoints
 *
 * This provides basic protection against abuse of public endpoints.
 * For production at scale, consider using Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimiterOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 30,       // 30 requests per minute
};

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if a request should be allowed
   * @param key - Unique identifier (usually IP address or user ID)
   * @param options - Rate limit configuration
   * @returns Object with allowed status and remaining requests
   */
  check(
    key: string,
    options: RateLimiterOptions = DEFAULT_OPTIONS
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // If no entry exists or window has expired, create new entry
    if (!entry || now > entry.resetTime) {
      this.store.set(key, {
        count: 1,
        resetTime: now + options.windowMs,
      });
      return {
        allowed: true,
        remaining: options.maxRequests - 1,
        resetTime: now + options.windowMs,
      };
    }

    // Window still active
    if (entry.count >= options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: options.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Remove expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter (cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  // Public endpoints - stricter limits
  PUBLIC_API: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 30,       // 30 requests per minute
  },
  // External API calls (Yahoo Finance, etc.)
  EXTERNAL_API: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 10,       // 10 requests per minute
  },
  // Authenticated endpoints - more lenient
  AUTHENTICATED: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 100,      // 100 requests per minute
  },
  // Heavy computation endpoints
  COMPUTATION: {
    windowMs: 60 * 1000,   // 1 minute
    maxRequests: 20,       // 20 requests per minute
  },
} as const;

/**
 * Helper to create a rate limit error response
 */
export function createRateLimitError(resetTime: number): Error {
  const waitSeconds = Math.ceil((resetTime - Date.now()) / 1000);
  const error = new Error(`Rate limit exceeded. Please try again in ${waitSeconds} seconds.`);
  (error as any).code = 'TOO_MANY_REQUESTS';
  return error;
}

/**
 * Rate limiter for provider API calls
 * Prevents exceeding provider rate limits
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Timestamp when limit resets
}

/**
 * In-memory rate limiter per provider
 * In production, this could be replaced with Redis for distributed systems
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map(); // provider -> timestamps[]

  /**
   * Check if a request is allowed
   */
  checkLimit(provider: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create request history for this provider
    let requestHistory = this.requests.get(provider) || [];

    // Filter out requests outside the time window
    requestHistory = requestHistory.filter((timestamp) => timestamp > windowStart);

    // Check if we're at the limit
    const currentCount = requestHistory.length;
    const allowed = currentCount < config.maxRequests;

    if (allowed) {
      // Add current request timestamp
      requestHistory.push(now);
      this.requests.set(provider, requestHistory);
    } else {
      // Update history without adding new request
      this.requests.set(provider, requestHistory);
    }

    // Calculate reset time (oldest request + window)
    const resetAt =
      requestHistory.length > 0
        ? Math.min(...requestHistory) + config.windowMs
        : now + config.windowMs;

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0)),
      resetAt,
    };
  }

  /**
   * Reset rate limit for a provider (for testing)
   */
  reset(provider: string): void {
    this.requests.delete(provider);
  }

  /**
   * Reset all rate limits (for testing)
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Get current request count for a provider
   */
  getCount(provider: string, windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const requestHistory = this.requests.get(provider) || [];
    return requestHistory.filter((timestamp) => timestamp > windowStart).length;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Default rate limit configurations per provider
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  "0x": {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  lifi: {
    maxRequests: 50, // 50 requests
    windowMs: 60 * 1000, // per minute
  },
  "1inch": {
    maxRequests: 60, // 60 requests (1 req/sec public API, but we'll be conservative)
    windowMs: 60 * 1000, // per minute
  },
  paraswap: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  openocean: {
    maxRequests: 120, // 120 requests (2 RPS = 20 req/10sec = 120 req/min)
    windowMs: 60 * 1000, // per minute
  },
  odos: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  kyberswap: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  bebop: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  dodo: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  sushiswap: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  okx: {
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
  },
  "uniswap-v3": {
    maxRequests: 200, // 200 requests (direct contract calls, higher limit)
    windowMs: 60 * 1000, // per minute
  },
  "uniswap-v2": {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  curve: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  pancakeswap: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  "balancer-v2": {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  traderjoe: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  velodrome: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  aerodrome: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  camelot: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  maverick: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  orca: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  raydium: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  "jupiter-direct": {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  quickswap: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  spookyswap: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  thorchain: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  phoenix: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  meteora: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  gmx: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  dydx: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  syncswap: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  velocore: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  bancor: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
  spiritswap: {
    maxRequests: 200,
    windowMs: 60 * 1000,
  },
};

/**
 * Get rate limit config for a provider
 */
export function getRateLimitConfig(provider: string): RateLimitConfig {
  return (
    DEFAULT_RATE_LIMITS[provider] || {
      maxRequests: 50,
      windowMs: 60 * 1000,
    }
  );
}

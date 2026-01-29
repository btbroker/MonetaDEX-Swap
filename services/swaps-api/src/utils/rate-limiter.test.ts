import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, getRateLimitConfig, DEFAULT_RATE_LIMITS } from "./rate-limiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  describe("checkLimit", () => {
    it("should allow requests within limit", () => {
      const config = { maxRequests: 5, windowMs: 1000 };
      const result = limiter.checkLimit("test-provider", config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should reject requests exceeding limit", () => {
      const config = { maxRequests: 2, windowMs: 1000 };

      // Make 2 requests (allowed)
      limiter.checkLimit("test-provider", config);
      limiter.checkLimit("test-provider", config);

      // 3rd request should be rejected
      const result = limiter.checkLimit("test-provider", config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should reset after time window", async () => {
      const config = { maxRequests: 1, windowMs: 100 };

      // First request allowed
      const result1 = limiter.checkLimit("test-provider", config);
      expect(result1.allowed).toBe(true);

      // Second request rejected
      const result2 = limiter.checkLimit("test-provider", config);
      expect(result2.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      const result3 = limiter.checkLimit("test-provider", config);
      expect(result3.allowed).toBe(true);
    });

    it("should track requests per provider independently", () => {
      const config = { maxRequests: 1, windowMs: 1000 };

      const result1 = limiter.checkLimit("provider-1", config);
      const result2 = limiter.checkLimit("provider-2", config);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it("should calculate reset time correctly", () => {
      const config = { maxRequests: 5, windowMs: 1000 };
      const result = limiter.checkLimit("test-provider", config);

      expect(result.resetAt).toBeGreaterThan(Date.now());
      expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 1000);
    });
  });

  describe("reset", () => {
    it("should reset rate limit for a provider", () => {
      const config = { maxRequests: 1, windowMs: 1000 };

      limiter.checkLimit("test-provider", config);
      const result1 = limiter.checkLimit("test-provider", config);
      expect(result1.allowed).toBe(false);

      limiter.reset("test-provider");

      const result2 = limiter.checkLimit("test-provider", config);
      expect(result2.allowed).toBe(true);
    });
  });

  describe("getCount", () => {
    it("should return current request count", () => {
      const config = { maxRequests: 10, windowMs: 1000 };

      limiter.checkLimit("test-provider", config);
      limiter.checkLimit("test-provider", config);
      limiter.checkLimit("test-provider", config);

      const count = limiter.getCount("test-provider", 1000);
      expect(count).toBe(3);
    });

    it("should only count requests within window", async () => {
      const config = { maxRequests: 10, windowMs: 100 };

      limiter.checkLimit("test-provider", config);
      await new Promise((resolve) => setTimeout(resolve, 150));
      limiter.checkLimit("test-provider", config);

      const count = limiter.getCount("test-provider", 100);
      expect(count).toBe(1); // Only the second request is within window
    });
  });
});

describe("getRateLimitConfig", () => {
  it("should return default config for known providers", () => {
    const config0x = getRateLimitConfig("0x");
    expect(config0x).toEqual(DEFAULT_RATE_LIMITS["0x"]);

    const configLifi = getRateLimitConfig("lifi");
    expect(configLifi).toEqual(DEFAULT_RATE_LIMITS["lifi"]);
  });

  it("should return default config for unknown providers", () => {
    const config = getRateLimitConfig("unknown-provider");
    expect(config.maxRequests).toBe(50);
    expect(config.windowMs).toBe(60 * 1000);
  });
});

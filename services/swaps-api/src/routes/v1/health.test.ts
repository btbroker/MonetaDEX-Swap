import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildFastify } from "../../index.js";
import { providerHealthTracker } from "../../utils/provider-health.js";
import { rateLimiter } from "../../utils/rate-limiter.js";
import type { FastifyInstance } from "fastify";

describe("GET /v1/health/providers", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    providerHealthTracker.resetAll();
    fastify = await buildFastify();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it("should return empty array when no health data exists", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/providers",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toEqual([]);
  });

  it("should return health status for providers with data", async () => {
    providerHealthTracker.recordSuccess("0x", 100);
    providerHealthTracker.recordSuccess("0x", 200);
    providerHealthTracker.recordFailure("lifi", "timeout");

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/providers",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toHaveLength(2);

    const provider0x = body.providers.find((p: any) => p.provider === "0x");
    expect(provider0x).toBeDefined();
    expect(provider0x.isHealthy).toBe(true);
    expect(provider0x.consecutiveFailures).toBe(0);
    expect(provider0x.totalRequests).toBe(2);
    expect(provider0x.totalFailures).toBe(0);
    expect(provider0x.failureRate).toBe(0);
    expect(provider0x.averageResponseTime).toBe(150); // (100 + 200) / 2

    const providerLifi = body.providers.find((p: any) => p.provider === "lifi");
    expect(providerLifi).toBeDefined();
    expect(providerLifi.isHealthy).toBe(true); // Only 1 failure, not enough to mark unhealthy
    expect(providerLifi.consecutiveFailures).toBe(1);
    expect(providerLifi.totalRequests).toBe(1);
    expect(providerLifi.totalFailures).toBe(1);
    expect(providerLifi.failureRate).toBe(1.0);
  });

  it("should mark provider as unhealthy after max consecutive failures", async () => {
    // Record 5 consecutive failures (max is 5)
    for (let i = 0; i < 5; i++) {
      providerHealthTracker.recordFailure("0x", "error");
    }

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/providers",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const provider = body.providers.find((p: any) => p.provider === "0x");

    expect(provider.isHealthy).toBe(false);
    expect(provider.consecutiveFailures).toBe(5);
  });

  it("should include timestamps when available", async () => {
    providerHealthTracker.recordSuccess("0x", 100);
    providerHealthTracker.recordFailure("0x", "error");

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/providers",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const provider = body.providers.find((p: any) => p.provider === "0x");

    expect(provider.lastSuccessAt).toBeDefined();
    expect(provider.lastFailureAt).toBeDefined();
    expect(new Date(provider.lastSuccessAt).getTime()).toBeGreaterThan(0);
    expect(new Date(provider.lastFailureAt).getTime()).toBeGreaterThan(0);
  });
});

describe("GET /v1/health/rate-limits", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    rateLimiter.resetAll();
    fastify = await buildFastify();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it("should return rate limit status for all known providers", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/rate-limits",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toHaveLength(2);

    const provider0x = body.providers.find((p: any) => p.provider === "0x");
    expect(provider0x).toBeDefined();
    expect(provider0x.maxRequests).toBe(100);
    expect(provider0x.windowMs).toBe(60 * 1000);
    expect(provider0x.currentCount).toBe(0);
    expect(provider0x.remaining).toBe(100);

    const providerLifi = body.providers.find((p: any) => p.provider === "lifi");
    expect(providerLifi).toBeDefined();
    expect(providerLifi.maxRequests).toBe(50);
    expect(providerLifi.windowMs).toBe(60 * 1000);
  });

  it("should show current request count", async () => {
    // Make some requests
    const config = { maxRequests: 100, windowMs: 60 * 1000 };
    rateLimiter.checkLimit("0x", config);
    rateLimiter.checkLimit("0x", config);
    rateLimiter.checkLimit("0x", config);

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/rate-limits",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const provider = body.providers.find((p: any) => p.provider === "0x");

    expect(provider.currentCount).toBe(3);
    expect(provider.remaining).toBe(97); // 100 - 3
  });

  it("should include reset time", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/health/rate-limits",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const provider = body.providers.find((p: any) => p.provider === "0x");

    expect(provider.resetAt).toBeDefined();
    expect(new Date(provider.resetAt).getTime()).toBeGreaterThan(Date.now());
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { buildFastify } from "../../index.js";
import { quoteMetricsTracker } from "../../metrics/quote-metrics.js";
import type { FastifyInstance } from "fastify";

describe("GET /v1/metrics", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    quoteMetricsTracker.resetAll();
    fastify = await buildFastify();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it("should return empty array when no metrics exist", async () => {
    const response = await fastify.inject({
      method: "GET",
      url: "/v1/metrics",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toEqual([]);
  });

  it("should return metrics for providers with data", async () => {
    // Record some metrics
    quoteMetricsTracker.recordSuccess("0x", 100, 2, "1000000");
    quoteMetricsTracker.recordSuccess("0x", 200, 3, "1000000");
    quoteMetricsTracker.recordFailure("lifi", 150);

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/metrics",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.providers).toHaveLength(2);

    const provider0x = body.providers.find((p: any) => p.provider === "0x");
    expect(provider0x).toBeDefined();
    expect(provider0x.totalQuotes).toBe(2);
    expect(provider0x.successfulQuotes).toBe(2);
    expect(provider0x.failedQuotes).toBe(0);
    expect(provider0x.successRate).toBe(1.0);
    expect(provider0x.averageRoutesPerQuote).toBe(2.5); // (2 + 3) / 2

    const providerLifi = body.providers.find((p: any) => p.provider === "lifi");
    expect(providerLifi).toBeDefined();
    expect(providerLifi.totalQuotes).toBe(1);
    expect(providerLifi.successfulQuotes).toBe(0);
    expect(providerLifi.failedQuotes).toBe(1);
    expect(providerLifi.successRate).toBe(0);
  });

  it("should calculate quality score correctly", async () => {
    // Record successful quotes with good response times
    quoteMetricsTracker.recordSuccess("0x", 100, 3, "1000000");
    quoteMetricsTracker.recordSuccess("0x", 150, 2, "1000000");

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/metrics",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const provider = body.providers.find((p: any) => p.provider === "0x");

    expect(provider.qualityScore).toBeGreaterThan(0);
    expect(provider.qualityScore).toBeLessThanOrEqual(1);
  });

  it("should include lastUpdated timestamp", async () => {
    quoteMetricsTracker.recordSuccess("0x", 100, 1, "1000000");

    const response = await fastify.inject({
      method: "GET",
      url: "/v1/metrics",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const provider = body.providers.find((p: any) => p.provider === "0x");

    expect(provider.lastUpdated).toBeDefined();
    expect(new Date(provider.lastUpdated).getTime()).toBeGreaterThan(0);
  });
});

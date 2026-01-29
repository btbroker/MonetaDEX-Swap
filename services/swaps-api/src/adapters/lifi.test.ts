import { describe, it, expect, beforeEach, vi } from "vitest";
import { LiFiAdapter } from "./lifi.js";
import type { QuoteRequest } from "@fortuna/shared";
import { rateLimiter } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";

// Mock HTTP client
vi.mock("../utils/http-client.js", () => ({
  httpRequest: vi.fn(),
  getApiKey: vi.fn(() => undefined), // Mock mode by default
}));

describe("LiFiAdapter", () => {
  let adapter: LiFiAdapter;

  beforeEach(() => {
    rateLimiter.resetAll();
    providerHealthTracker.resetAll();
    quoteMetricsTracker.resetAll();
    adapter = new LiFiAdapter();
  });

  describe("mock mode", () => {
    it("should use mock mode when API key is not set", () => {
      expect((adapter as any).useMock).toBe(true);
    });

    it("should return mock quote for cross-chain swap", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 137,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amountIn: "1000000",
        slippageTolerance: 0.5,
      };

      const routes = await adapter.getQuote(request);

      expect(routes).toHaveLength(1);
      expect(routes[0].provider).toBe("lifi");
      expect(routes[0].type).toBe("bridge");
      expect(routes[0].toolsUsed).toBeDefined();
    });

    it("should return empty array for same-chain swap", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
      };

      const routes = await adapter.getQuote(request);

      expect(routes).toHaveLength(0);
    });
  });

  describe("rate limiting", () => {
    it("should respect rate limits", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 137,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amountIn: "1000000",
      };

      // Exceed rate limit by making multiple requests
      // Default config is 50 requests per minute, so we need to exceed that
      const config = { maxRequests: 50, windowMs: 60 * 1000 };
      for (let i = 0; i < 51; i++) {
        rateLimiter.checkLimit("lifi", config);
      }

      const routes = await adapter.getQuote(request);

      expect(routes).toHaveLength(0);
    });
  });

  describe("health checks", () => {
    it("should skip unhealthy providers", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 137,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amountIn: "1000000",
      };

      // Mark provider as unhealthy
      for (let i = 0; i < 5; i++) {
        providerHealthTracker.recordFailure("lifi", "error");
      }

      const routes = await adapter.getQuote(request);

      expect(routes).toHaveLength(0);
    });
  });

  describe("metrics tracking", () => {
    it("should track successful quotes", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 137,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amountIn: "1000000",
      };

      await adapter.getQuote(request);

      const metrics = quoteMetricsTracker.getMetrics("lifi");
      expect(metrics?.totalQuotes).toBe(1);
      expect(metrics?.successfulQuotes).toBe(1);
    });
  });
});

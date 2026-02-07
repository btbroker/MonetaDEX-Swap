import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZeroXAdapter } from "./zeroX.js";
import type { QuoteRequest } from "@fortuna/shared";
import { rateLimiter } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { toWei } from "../utils/token-decimals.js";

// Mock HTTP client (default: no API key = mock mode)
const mockHttpRequest = vi.fn();
const mockGetApiKey = vi.fn(() => undefined);
vi.mock("../utils/http-client.js", () => ({
  httpRequest: (...args: unknown[]) => mockHttpRequest(...args),
  getApiKey: (key: string) => mockGetApiKey(key),
}));

describe("ZeroXAdapter", () => {
  let adapter: ZeroXAdapter;

  beforeEach(() => {
    rateLimiter.resetAll();
    providerHealthTracker.resetAll();
    quoteMetricsTracker.resetAll();
    adapter = new ZeroXAdapter();
  });

  describe("mock mode", () => {
    it("should use mock mode when API key is not set", () => {
      expect((adapter as any).useMock).toBe(true);
    });

    it("should return empty array when no API key (no mock routes)", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        slippageTolerance: 0.5,
      };

      const routes = await adapter.getQuote(request);

      expect(routes).toHaveLength(0);
    });

    it("should return empty array for cross-chain swap", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 137,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
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
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
      };

      // Exceed rate limit by making multiple requests
      // Default config is 100 requests per minute, so we need to exceed that
      const config = { maxRequests: 100, windowMs: 60 * 1000 };
      for (let i = 0; i < 101; i++) {
        rateLimiter.checkLimit("0x", config);
      }

      const routes = await adapter.getQuote(request);

      // Should return empty due to rate limit
      expect(routes).toHaveLength(0);
    });
  });

  describe("health checks", () => {
    it("should skip unhealthy providers", async () => {
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
      };

      // Mark provider as unhealthy
      for (let i = 0; i < 5; i++) {
        providerHealthTracker.recordFailure("0x", "error");
      }

      const routes = await adapter.getQuote(request);

      expect(routes).toHaveLength(0);
    });
  });

  describe("metrics tracking", () => {
    it("tracks success when real quote returns routes", async () => {
      const origTaker = process.env.TAKER_ADDRESS;
      process.env.TAKER_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      mockGetApiKey.mockReturnValue("test-key");
      rateLimiter.resetAll();
      providerHealthTracker.resetAll();
      mockHttpRequest.mockResolvedValue({
        status: 200,
        data: {
          buyAmount: "1000000",
          sellAmount: "1000000",
          sellToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          buyToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          liquidityAvailable: true,
          route: { fills: [{ source: "Uniswap_V3" }] },
          transaction: { gas: "150000", gasPrice: "1", to: "0x0", data: "0x", value: "0" },
        },
      });
      const realAdapter = new ZeroXAdapter();
      const request: QuoteRequest = {
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
      };

      await realAdapter.getQuote(request);

      const metrics = quoteMetricsTracker.getMetrics("0x");
      expect(metrics?.totalQuotes).toBe(1);
      expect(metrics?.successfulQuotes).toBe(1);
      mockGetApiKey.mockReturnValue(undefined);
      if (origTaker !== undefined) process.env.TAKER_ADDRESS = origTaker;
      else delete process.env.TAKER_ADDRESS;
    });
  });

  describe("v2 allowance-holder quote", () => {
    it("maps 200 response buyAmount to route amountOut (amountOutWei when enriched)", async () => {
      const origTaker = process.env.TAKER_ADDRESS;
      process.env.TAKER_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      mockGetApiKey.mockReturnValue("test-key");
      rateLimiter.resetAll();
      providerHealthTracker.resetAll();
      const buyAmountWei = "999000000";
      const sellAmountWei = "1000000000";
      mockHttpRequest.mockResolvedValue({
        status: 200,
        data: {
          buyAmount: buyAmountWei,
          sellAmount: sellAmountWei,
          sellToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
          buyToken: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
          liquidityAvailable: true,
          route: { fills: [{ source: "Uniswap_V3", proportionBps: "10000" }] },
          transaction: { gas: "150000", gasPrice: "20000000000", to: "0x0", data: "0x", value: "0" },
        },
      });
      const realAdapter = new ZeroXAdapter();
      const request: QuoteRequest = {
        fromChainId: 137,
        toChainId: 137,
        fromToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        toToken: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        amountIn: sellAmountWei,
      };

      const routes = await realAdapter.getQuote(request);

      expect(mockHttpRequest).toHaveBeenCalled();
      expect(routes).toHaveLength(1);
      expect(routes[0].provider).toBe("0x");
      const toDecimals = 6;
      expect(toWei(routes[0].amountOut, toDecimals)).toBe(buyAmountWei);
      expect(routes[0].amountIn).toBeDefined();
      mockGetApiKey.mockReturnValue(undefined);
      if (origTaker !== undefined) process.env.TAKER_ADDRESS = origTaker;
      else delete process.env.TAKER_ADDRESS;
    });
  });
});

import { BaseAdapter } from "./base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route, RouteStep, RouteType } from "@fortuna/shared";
import { generateRouteId } from "../utils/routeId.js";
import type { Tool } from "../registry/tool-registry.js";
import { httpRequest, getApiKey } from "../utils/http-client.js";
import { rateLimiter, getRateLimitConfig } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { logger } from "../utils/logger.js";
import { DEBUG_QUOTES, safeQueryParams, sanitizeResponseMessage } from "../utils/debug-quotes.js";
import { getFeeRecipientWithFallback, getPlatformFeeBps } from "../utils/fee-config.js";
import {
  getTokenDecimals,
  toWei,
  fromWei,
} from "../utils/token-decimals.js";

/**
 * 0x adapter for same-chain swaps
 * Integrates with 0x API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class ZeroXAdapter extends BaseAdapter {
  name = "0x";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.0x.org";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("ZEROX_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("ZeroX adapter running in mock mode (ZEROX_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that 0x can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      // Mock: Return common DEXs that 0x aggregates
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "1inch",
        "0x Native",
      ];
    }

    try {
      // In production, query 0x API for available sources
      // For now, return static list (0x API doesn't expose this directly)
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "1inch",
        "0x Native",
      ];
    } catch (error) {
      logger.warn({ error }, "Failed to get 0x tools, using default list");
      return ["Uniswap V3", "Curve"];
    }
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    if (this.useMock) {
      return ["Uniswap V3", "Curve"];
    }

    // In production, parse route steps to determine actual tools
    // For now, return default based on routeId pattern
    return ["Uniswap V3", "Curve"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    // Only handle same-chain swaps
    if (request.fromChainId !== request.toChainId) {
      return [];
    }

    const startTime = Date.now();

    // Check rate limit
    const rateLimitConfig = getRateLimitConfig(this.name);
    const rateLimit = rateLimiter.checkLimit(this.name, rateLimitConfig);

    if (!rateLimit.allowed) {
      logger.warn(
        { provider: this.name, resetAt: rateLimit.resetAt },
        "Rate limit exceeded"
      );
      providerHealthTracker.recordFailure(this.name, "Rate limit exceeded");
      return [];
    }

    // Check provider health
    if (!providerHealthTracker.isHealthy(this.name)) {
      logger.warn({ provider: this.name }, "Provider is unhealthy, skipping");
      return [];
    }

    try {
      // No key = no real quote; do not return mock/fake routes (regulated onboarding).
      if (this.useMock) {
        return [];
      }

      const routes = await this.getRealQuote(request);

      const responseTime = Date.now() - startTime;
      providerHealthTracker.recordSuccess(this.name, responseTime);
      quoteMetricsTracker.recordSuccess(
        this.name,
        responseTime,
        routes.length,
        routes[0]?.amountOut
      );

      return routes;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const statusCode = (error as Error & { statusCode?: number }).statusCode;
      providerHealthTracker.recordFailure(this.name, errorMessage, statusCode != null ? { statusCode } : undefined);
      quoteMetricsTracker.recordFailure(this.name, responseTime);

      logger.error({ error, provider: this.name }, "Failed to get quote from 0x");
      return [];
    }
  }

  /** Supported chain IDs for 0x Swap API v2 (chainId query param). */
  private static readonly SUPPORTED_CHAIN_IDS = new Set([
    1, 10, 56, 137, 8453, 42161, 43114, 534352, 5000, 81457, 34443,
  ]);

  /** v2: single base URL for all chains; chain set via chainId param. */
  private static readonly V2_BASE_URL = "https://api.0x.org";

  /** Taker address for 0x v2 /quote. Uses TAKER_ADDRESS env if valid, else feeRecipient. Returns undefined if neither is available (taker omitted from query). */
  private static getTakerAddress(feeRecipient?: string): string | undefined {
    const env = process.env.TAKER_ADDRESS?.trim();
    if (env && /^0x[a-fA-F0-9]{40}$/.test(env)) return env;
    if (feeRecipient && /^0x[a-fA-F0-9]{40}$/.test(feeRecipient)) return feeRecipient;
    return undefined;
  }

  /**
   * Get quote from 0x Swap API v2 (AllowanceHolder). Uses /swap/allowance-holder/quote with chainId, taker, sellAmount in base units.
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    const chainId = request.fromChainId;
    if (!ZeroXAdapter.SUPPORTED_CHAIN_IDS.has(chainId)) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    const sellToken = request.fromToken?.trim() ?? "";
    const buyToken = request.toToken?.trim() ?? "";
    const sellAmount = request.amountIn?.trim() ?? "";
    if (!sellToken || !buyToken || !sellAmount) {
      throw new Error("0x quote requires sellToken, buyToken, and sellAmount");
    }

    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();
    const taker = ZeroXAdapter.getTakerAddress(feeRecipient);

    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);

    const slippageBps = Math.round((request.slippageTolerance ?? 0.5) * 100);
    const params = new URLSearchParams({
      chainId: String(chainId),
      sellToken,
      buyToken,
      sellAmount,
      slippageBps: String(Math.min(10000, Math.max(0, slippageBps))),
      ...(taker ? { taker } : {}),
      ...(feeRecipient && feeBps > 0 && {
        swapFeeRecipient: feeRecipient,
        swapFeeBps: String(feeBps),
        swapFeeToken: buyToken,
      }),
    });
    const path = "/swap/allowance-holder/quote";
    const url = `${ZeroXAdapter.V2_BASE_URL}${path}`;
    const fullUrl = `${url}?${params.toString()}`;

    const headers: Record<string, string> = {
      "0x-version": "v2",
    };
    if (this.apiKey) headers["0x-api-key"] = this.apiKey;

    if (DEBUG_QUOTES) {
      logger.info(
        {
          provider: this.name,
          method: "GET",
          url,
          queryKeys: Array.from(params.keys()),
          queryParams: safeQueryParams(params),
          chainId: request.fromChainId,
          fromToken: request.fromToken,
          toToken: request.toToken,
          amountInWei: request.amountIn,
        },
        "DEBUG_QUOTES: outbound request"
      );
    }

    const response = await httpRequest<{
      buyAmount: string;
      sellAmount: string;
      buyToken: string;
      sellToken: string;
      liquidityAvailable?: boolean;
      route?: { fills: Array<{ source: string; proportionBps?: string }> };
      transaction?: { to: string; data: string; value: string; gas: string; gasPrice: string };
      gas?: string;
      gasPrice?: string;
    }>(fullUrl, {
      method: "GET",
      headers,
      timeout: 8000,
    });

    const data = response.data as Record<string, unknown> | undefined;
    const reason = data?.reason ?? data?.message ?? data?.error ?? (typeof data === "string" ? (data as string).slice(0, 200) : undefined);

    if (response.status === 404) {
      if (DEBUG_QUOTES) {
        logger.info(
          {
            provider: this.name,
            httpStatus: 404,
            didReturnRouteCount: 0,
            safeMessage: "Unsupported or deprecated endpoint (404); ensure 0x Swap API v2 allowance-holder is used",
            reason: sanitizeResponseMessage(reason),
          },
          "DEBUG_QUOTES: response"
        );
      }
      const err = new Error("0x API v2 returned 404 (unsupported or deprecated endpoint)") as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    if (response.status !== 200) {
      if (DEBUG_QUOTES) {
        const payload: Record<string, unknown> = {
          provider: this.name,
          httpStatus: response.status,
          didReturnRouteCount: 0,
          safeMessage: "provider returned 0 routes",
        };
        if (reason !== undefined) payload.reason = sanitizeResponseMessage(reason);
        logger.info(payload, "DEBUG_QUOTES: response");
      }
      const err = new Error(`0x API returned status ${response.status}`) as Error & { statusCode?: number };
      err.statusCode = response.status;
      throw err;
    }

    const quote = response.data;
    const buyAmountWei = quote?.buyAmount?.trim();
    const noLiquidity = !buyAmountWei || buyAmountWei === "0";
    const liquidityAvailable = quote?.liquidityAvailable === true;
    if (noLiquidity || !liquidityAvailable) {
      const msgReason = (data?.reason ?? data?.message ?? data?.error ?? (noLiquidity ? "No buy amount in response" : "liquidityAvailable is not true")) as unknown;
      if (DEBUG_QUOTES) {
        logger.info(
          {
            provider: this.name,
            httpStatus: response.status,
            didReturnRouteCount: 0,
            safeMessage: "provider returned 0 routes",
            reason: sanitizeResponseMessage(msgReason),
          },
          "DEBUG_QUOTES: response"
        );
      }
      const err = new Error(sanitizeResponseMessage(msgReason)) as Error & { statusCode?: number };
      err.statusCode = 200;
      throw err;
    }

    if (DEBUG_QUOTES) {
      logger.info(
        { provider: this.name, httpStatus: response.status, didReturnRouteCount: 1 },
        "DEBUG_QUOTES: response"
      );
    }

    const amountInHuman = fromWei(quote.sellAmount, fromDecimals);
    const amountOutHuman = fromWei(quote.buyAmount, toDecimals);

    const toolsUsed: Tool[] = (quote.route?.fills ?? []).map((f) => f.source);

    const gasStr = quote.transaction?.gas ?? quote.gas ?? "150000";
    const priceImpactBps = undefined;

    const sell = Number(parseFloat(amountInHuman));
    const buy = Number(parseFloat(amountOutHuman));
    const maybePrice = (quote as unknown as { price?: unknown })?.price;
    const price = typeof maybePrice === "string" ? parseFloat(maybePrice) : sell > 0 ? buy / sell : 0;
    const expectedBuyAmount = sell * price;
    const totalFees = expectedBuyAmount - buy;
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (buy * platformFeeBps) / 10000;
    const fees = totalFees + platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: amountInHuman,
      amountOut: amountOutHuman,
      estimatedGas: gasStr,
      fees: fees > 0 ? fees.toFixed(18) : "0",
      priceImpactBps,
      steps: [
        {
          type: "swap",
          provider: this.name,
          fromChainId: request.fromChainId,
          toChainId: request.toChainId,
          fromToken: request.fromToken,
          toToken: request.toToken,
          amountIn: amountInHuman,
          amountOut: amountOutHuman,
        } as RouteStep,
      ],
      toolsUsed,
    };

    return [
      {
        ...route,
        routeId: generateRouteId(route),
      },
    ];
  }

  /**
   * Get mock quote (fallback when API key not available)
   */
  private async getMockQuote(request: QuoteRequest): Promise<Route[]> {
    // Mock: request.amountIn is wei; convert to human for fee math
    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const amountIn = parseFloat(fromWei(request.amountIn, fromDecimals));
    const dexFeeRate = 0.003; // 0.3% DEX fee
    const amountAfterDexFee = amountIn * (1 - dexFeeRate);
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (amountAfterDexFee * platformFeeBps) / 10000;
    const amountOut = amountAfterDexFee - platformFee;
    const fees = (amountIn * dexFeeRate) + platformFee;

    // Calculate price impact (mock: 0.1% for same-chain swaps)
    const priceImpactBps = 10; // 0.1% = 10 basis points

    // Get tools used for this route
    const toolsUsed = this.getToolsUsed(this.name, "swap", []);

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: fromWei(request.amountIn, fromDecimals),
      amountOut: amountOut.toFixed(18),
      estimatedGas: "150000", // Mock gas estimate
      fees: fees.toFixed(18),
      priceImpactBps,
      steps: [
        {
          type: "swap",
          provider: this.name,
          fromChainId: request.fromChainId,
          toChainId: request.toChainId,
          fromToken: request.fromToken,
          toToken: request.toToken,
          amountIn: fromWei(request.amountIn, fromDecimals),
          amountOut: amountOut.toFixed(18),
        } as RouteStep,
      ],
      toolsUsed,
    };

    return [
      {
        ...route,
        routeId: generateRouteId(route),
      },
    ];
  }

  async getTx(routeId: string, request: TxRequest): Promise<TxResponse> {
    if (this.useMock) {
      // Mock transaction data
      return {
        routeId,
        txData: "0x" + "0".repeat(200), // Mock calldata
        to: "0x1234567890123456789012345678901234567890", // Mock router address
        value: "0",
        gasLimit: "200000",
        gasPrice: "20000000000", // 20 gwei
        chainId: request.fromChainId,
      };
    }

    try {
      // Get quote again to get fresh transaction data
      const routes = await this.getRealQuote(request);
      const route = routes.find((r) => r.routeId === routeId);

      if (!route) {
        throw new Error(`Route not found: ${routeId}`);
      }

      // Get transaction data from 0x API
      const chainMap: Record<number, string> = {
        1: "ethereum",
        10: "optimism",
        56: "bsc",
        137: "polygon",
        8453: "base",
        42161: "arbitrum",
        43114: "avalanche",
        534352: "scroll",
        5000: "mantle",
        81457: "blast",
        34443: "mode",
      };

      const chainName = chainMap[request.fromChainId];
      if (!chainName) {
        throw new Error(`Unsupported chain: ${request.fromChainId}`);
      }

      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();
      const taker = ZeroXAdapter.getTakerAddress(feeRecipient);
      const slippageBps = Math.round((request.slippageTolerance ?? 0.5) * 100);

      const params = new URLSearchParams({
        chainId: String(request.fromChainId),
        sellToken: request.fromToken,
        buyToken: request.toToken,
        sellAmount: request.amountIn,
        slippageBps: String(Math.min(10000, Math.max(0, slippageBps))),
        ...(taker ? { taker } : {}),
        ...(feeRecipient && feeBps > 0 && {
          swapFeeRecipient: feeRecipient,
          swapFeeBps: String(feeBps),
          swapFeeToken: request.toToken,
        }),
      });
      const url = `${ZeroXAdapter.V2_BASE_URL}/swap/allowance-holder/quote?${params.toString()}`;
      const headers: Record<string, string> = { "0x-version": "v2" };
      if (this.apiKey) headers["0x-api-key"] = this.apiKey;

      const response = await httpRequest<{
        transaction?: { to: string; data: string; value: string; gas: string; gasPrice: string };
      }>(url, { method: "GET", headers, timeout: 8000 });

      if (response.status !== 200 || !response.data.transaction) {
        throw new Error(`0x API returned status ${response.status} or missing transaction`);
      }

      const tx = response.data.transaction;
      return {
        routeId,
        txData: tx.data,
        to: tx.to,
        value: tx.value || "0",
        gasLimit: tx.gas || "200000",
        gasPrice: tx.gasPrice || "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from 0x");
      throw error;
    }
  }
}

import { BaseAdapter } from "./base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route, RouteStep, RouteType } from "@fortuna/shared";
import { generateRouteId } from "../utils/routeId.js";
import type { Tool } from "../registry/tool-registry.js";
import { httpRequest, getApiKey } from "../utils/http-client.js";
import { rateLimiter, getRateLimitConfig } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { logger } from "../utils/logger.js";
import {
  getFeeReceiversAndBpsForKyber,
  getPlatformFeeBps,
} from "../utils/fee-config.js";

/** TTL for cached routeSummary (ms). KyberSwap recommends refetch if swap is "too long ago". */
const ROUTE_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedRouteSummary {
  routeSummary: unknown;
  expiresAt: number;
}

/**
 * KyberSwap adapter for same-chain swaps
 * Integrates with KyberSwap Aggregator API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class KyberSwapAdapter extends BaseAdapter {
  name = "kyberswap";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://aggregator-api.kyberswap.com";
  private readonly useMock: boolean;
  /** Cache routeSummary by routeId so POST /route/build gets exact object from GET. */
  private readonly routeSummaryCache = new Map<string, CachedRouteSummary>();

  private static readonly CLIENT_ID = "MonetaDEX";

  constructor() {
    super();
    this.apiKey = getApiKey("KYBERSWAP_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("KyberSwap adapter running in mock mode (KYBERSWAP_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that KyberSwap can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "KyberSwap",
        "DODO",
      ];
    }

    // KyberSwap aggregates from many DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "KyberSwap",
      "DODO",
      "Bancor",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    // KyberSwap API doesn't always expose which DEXs were used
    return ["KyberSwap"];
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
      let routes: Route[];

      if (this.useMock) {
        routes = await this.getMockQuote(request);
      } else {
        routes = await this.getRealQuote(request);
      }

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
      providerHealthTracker.recordFailure(this.name, errorMessage);
      quoteMetricsTracker.recordFailure(this.name, responseTime);

      logger.error({ error, provider: this.name }, "Failed to get quote from KyberSwap");
      return [];
    }
  }

  /**
   * Get quote from real KyberSwap API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to KyberSwap chain IDs
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

    // Platform fee + revenue share: chargeFeeBy=currency_out, isInBps=true, feeAmount (bps), feeReceiver (comma-separated)
    const { receivers, bps } = getFeeReceiversAndBpsForKyber(request.fromChainId);

    // KyberSwap APIv1: GET /{chain}/api/v1/routes
    const url = `${this.baseUrl}/${chainName}/api/v1/routes`;
    const params = new URLSearchParams({
      tokenIn: request.fromToken,
      tokenOut: request.toToken,
      amountIn: request.amountIn,
    });
    if (receivers.length > 0 && bps.length > 0) {
      params.set("chargeFeeBy", "currency_out");
      params.set("isInBps", "true");
      params.set("feeReceiver", receivers.join(","));
      params.set("feeAmount", bps.join(","));
    }

    const response = await httpRequest<{
      routeSummary: {
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        amountOut: string;
        gas: string;
        gasPrice: string;
        gasUsd: string;
        extraFee?: {
          feeAmount: string;
          chargeFeeBy: string;
          isInBps: boolean;
          feeReceiver: string;
        };
        route: Array<{
          pool: string;
          tokenIn: string;
          tokenOut: string;
          limitReturnAmount?: string;
          swapAmount: string;
          amountOut: string;
          exchange: string;
          poolLength?: number;
          poolType: string;
          extra?: unknown;
        }>;
      };
    }>(`${url}?${params.toString()}`, {
      method: "GET",
      headers: {
        "x-client-id": KyberSwapAdapter.CLIENT_ID,
        ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
      },
      timeout: 8000,
    });

    if (response.status !== 200) {
      throw new Error(`KyberSwap API returned status ${response.status}`);
    }

    const quote = response.data.routeSummary;

    // Extract tools used from route
    const toolsUsed: Tool[] = [];
    quote.route.forEach((step) => {
      if (step.exchange && !toolsUsed.includes(step.exchange)) {
        toolsUsed.push(step.exchange);
      }
    });

    // Calculate price impact (KyberSwap doesn't provide this directly)
    const priceImpactBps = undefined;

    // Fees: KyberSwap embeds platform fee in quote when chargeFeeBy/feeReceiver/feeAmount are set; extraFee in response reflects it
    const amountOut = parseFloat(quote.amountOut);
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (amountOut * platformFeeBps) / 10000;
    const fees = platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut, // Already net of partner fee
      estimatedGas: quote.gas || "150000",
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
          amountIn: quote.amountIn,
          amountOut: quote.amountOut,
        } as RouteStep,
      ],
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["KyberSwap"],
    };

    const routeId = generateRouteId(route);
    // Cache routeSummary so POST /route/build receives exact object from GET (required by KyberSwap API)
    this.routeSummaryCache.set(routeId, {
      routeSummary: quote,
      expiresAt: Date.now() + ROUTE_SUMMARY_CACHE_TTL_MS,
    });

    return [{ ...route, routeId }];
  }

  /**
   * Get mock quote (fallback when API key not available)
   */
  private async getMockQuote(request: QuoteRequest): Promise<Route[]> {
    // Mock: Calculate a simple swap with 0.25% DEX fee + 0.1% platform fee
    const amountIn = parseFloat(request.amountIn);
    const dexFeeRate = 0.0025; // 0.25% DEX fee
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
      amountIn: request.amountIn,
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
          amountIn: request.amountIn,
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
    // Validate routeId matches request
    if (!routeId.startsWith(this.name)) {
      throw new Error(`Invalid routeId for ${this.name} adapter`);
    }

    if (this.useMock) {
      // Return mock transaction data
      return {
        routeId,
        txData: "0x",
        to: request.toToken,
        value: "0",
        gasLimit: "200000",
        gasPrice: "20000000000", // 20 gwei
        chainId: request.fromChainId,
      };
    }

    try {
      // Map chain IDs to KyberSwap chain names
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

      // routeSummary must be exactly as returned by GET /routes; use cache or re-fetch
      const now = Date.now();
      for (const [id, entry] of this.routeSummaryCache.entries()) {
        if (entry.expiresAt <= now) this.routeSummaryCache.delete(id);
      }
      let routeSummary: unknown = null;
      const cached = this.routeSummaryCache.get(routeId);
      if (cached && cached.expiresAt > now) {
        routeSummary = cached.routeSummary;
      }
      if (!routeSummary) {
        // Cache miss: re-fetch route with same params + fee so we get a valid routeSummary
        const { receivers, bps } = getFeeReceiversAndBpsForKyber(request.fromChainId);
        const quoteUrl = `${this.baseUrl}/${chainName}/api/v1/routes`;
        const quoteParams = new URLSearchParams({
          tokenIn: request.fromToken,
          tokenOut: request.toToken,
          amountIn: request.amountIn,
        });
        if (receivers.length > 0 && bps.length > 0) {
          quoteParams.set("chargeFeeBy", "currency_out");
          quoteParams.set("isInBps", "true");
          quoteParams.set("feeReceiver", receivers.join(","));
          quoteParams.set("feeAmount", bps.join(","));
        }
        const quoteRes = await httpRequest<{ routeSummary: unknown }>(
          `${quoteUrl}?${quoteParams.toString()}`,
          {
            method: "GET",
            headers: {
              "x-client-id": KyberSwapAdapter.CLIENT_ID,
              ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
            },
            timeout: 8000,
          }
        );
        if (quoteRes.status === 200 && quoteRes.data?.routeSummary) {
          routeSummary = quoteRes.data.routeSummary;
        }
      }
      if (!routeSummary) {
        throw new Error("KyberSwap: no routeSummary available (call getQuote first or retry)");
      }

      // KyberSwap APIv1: POST /{chain}/api/v1/route/build
      const url = `${this.baseUrl}/${chainName}/api/v1/route/build`;
      const body = {
        routeSummary,
        sender: request.recipient,
        recipient: request.recipient,
        slippageTolerance: Math.round((request.slippageTolerance ?? 0.5) * 100), // percent to bps (0.5% = 50 bps)
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        source: KyberSwapAdapter.CLIENT_ID,
        referral: "partner=MonetaDEX|revshare=platform",
      };

      const response = await httpRequest<{
        code?: number;
        data?: {
          data: string;
          routerAddress: string;
          transactionValue: string;
          gas: string;
          gasPrice?: string;
        };
      }>(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": KyberSwapAdapter.CLIENT_ID,
          ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
        },
        body,
        timeout: 8000,
      });

      if (response.status !== 200) {
        throw new Error(`KyberSwap API returned status ${response.status}`);
      }

      // API returns { code, message, data: { data, routerAddress, transactionValue, gas, ... } }
      const tx = response.data?.data ?? response.data;
      const txPayload = tx && typeof tx === "object" && "data" in tx ? tx : null;

      return {
        routeId,
        txData: txPayload?.data ?? "",
        to: txPayload?.routerAddress ?? request.toToken,
        value: txPayload?.transactionValue ?? "0",
        gasLimit: txPayload?.gas ?? "200000",
        gasPrice: txPayload?.gasPrice ?? "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from KyberSwap");
      throw error;
    }
  }
}

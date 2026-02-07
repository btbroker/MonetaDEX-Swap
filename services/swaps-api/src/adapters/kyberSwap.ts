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
import {
  getFeeReceiversAndBpsForKyber,
  getPlatformFeeBps,
} from "../utils/fee-config.js";
import {
  getTokenDecimals,
  toWei,
  fromWei,
} from "../utils/token-decimals.js";

/** TTL for cached routeSummary (ms). KyberSwap recommends refetch if swap is "too long ago". */
const ROUTE_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedRouteSummary {
  routeSummary: unknown;
  expiresAt: number;
}

/**
 * KyberSwap adapter for same-chain swaps.
 * - Public mode (no KYBERSWAP_API_KEY): no fee params, no auth; avoids 403 on public endpoint.
 * - Partner mode (KYBERSWAP_API_KEY set): fee params + x-client-id + X-API-KEY; safe-logged.
 */
export class KyberSwapAdapter extends BaseAdapter {
  name = "kyberswap";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://aggregator-api.kyberswap.com";
  /** When false we use public endpoint (no fee params, no auth). When true we use partner-fee + auth. */
  private readonly hasKyberKey: boolean;
  /** Cache routeSummary by routeId so POST /route/build gets exact object from GET. */
  private readonly routeSummaryCache = new Map<string, CachedRouteSummary>();

  /** For partner mode only; never log the value. */
  private static getClientId(): string | undefined {
    const v = process.env.KYBERSWAP_CLIENT_ID;
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
  }

  constructor() {
    super();
    this.apiKey = getApiKey("KYBERSWAP_API_KEY");
    this.hasKyberKey = !!this.apiKey;

    if (!this.hasKyberKey) {
      logger.warn("KyberSwap: no API key; using public endpoint (no fee params, no auth)");
    }
  }

  /**
   * Get available tools/exchanges that KyberSwap can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (!this.hasKyberKey) {
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
    if (request.fromChainId !== request.toChainId) {
      return [];
    }

    const startTime = Date.now();
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

    if (!providerHealthTracker.isHealthy(this.name)) {
      logger.warn({ provider: this.name }, "Provider is unhealthy, skipping");
      return [];
    }

    try {
      let routes: Route[];
      try {
        routes = await this.getRealQuote(request);
      } catch (realError) {
        logger.warn(
          { provider: this.name, error: realError instanceof Error ? realError.message : String(realError) },
          "KyberSwap API failed; returning no routes"
        );
        routes = [];
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
   * Get quote from KyberSwap API. Public mode (no API key): no fee params, no auth. Partner mode: fee params + x-client-id + X-API-KEY.
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    if (this.hasKyberKey) {
      const clientId = KyberSwapAdapter.getClientId();
      if (!clientId) {
        throw new Error("KYBERSWAP_CLIENT_ID required when using KyberSwap partner mode (KYBERSWAP_API_KEY is set)");
      }
    }

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

    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);

    const url = `${this.baseUrl}/${chainName}/api/v1/routes`;
    const params = new URLSearchParams({
      tokenIn: request.fromToken,
      tokenOut: request.toToken,
      amountIn: request.amountIn,
    });

    if (this.hasKyberKey) {
      const { receivers, bps } = getFeeReceiversAndBpsForKyber(request.fromChainId);
      if (receivers.length > 0 && bps.length > 0) {
        params.set("chargeFeeBy", "currency_out");
        params.set("isInBps", "true");
        params.set("feeReceiver", receivers.join(","));
        params.set("feeAmount", bps.map((b) => String(Math.max(0, Math.floor(Number(b))))).join(","));
      }
    }

    const headers: Record<string, string> = {};
    if (this.hasKyberKey) {
      const clientId = KyberSwapAdapter.getClientId();
      if (clientId) headers["x-client-id"] = clientId;
      if (this.apiKey) headers["X-API-KEY"] = this.apiKey;
    }

    if (DEBUG_QUOTES) {
      const queryKeys = Array.from(params.keys());
      logger.info(
        {
          provider: this.name,
          chainName,
          amountIn: request.amountIn,
          queryKeys,
          queryParams: safeQueryParams(params),
          hasKyberKey: this.hasKyberKey,
          feeParamsInQuery: this.hasKyberKey && queryKeys.some((k) => ["feeReceiver", "feeAmount", "chargeFeeBy", "isInBps"].includes(k)),
        },
        "DEBUG_QUOTES: outbound request"
      );
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
      headers,
      timeout: 8000,
    });

    const hasRouteSummary = !!response.data?.routeSummary;
    const didReturnRouteCount = response.status === 200 && hasRouteSummary ? 1 : 0;
    if (DEBUG_QUOTES) {
      const data = response.data as Record<string, unknown> | undefined;
      const reason = data?.message ?? data?.error ?? data?.errorMsg ?? data?.msg;
      logger.info(
        {
          provider: this.name,
          httpStatus: response.status,
          didReturnRouteCount,
          reason: reason !== undefined ? sanitizeResponseMessage(reason) : undefined,
        },
        "DEBUG_QUOTES: response"
      );
    }

    if (response.status !== 200) {
      throw new Error(`KyberSwap API returned status ${response.status}`);
    }

    const quote = response.data.routeSummary;

    // KyberSwap returns amounts in wei; normalize to human-readable for display and ranking
    const amountInHuman = fromWei(quote.amountIn, fromDecimals);
    const amountOutHuman = fromWei(quote.amountOut, toDecimals);

    // Extract tools used from route
    const toolsUsed: Tool[] = [];
    quote.route.forEach((step) => {
      if (step.exchange && !toolsUsed.includes(step.exchange)) {
        toolsUsed.push(step.exchange);
      }
    });

    const priceImpactBps = undefined;
    const amountOutNum = parseFloat(amountOutHuman);
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (amountOutNum * platformFeeBps) / 10000;
    const fees = platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: amountInHuman,
      amountOut: amountOutHuman,
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
          amountIn: amountInHuman,
          amountOut: amountOutHuman,
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
    // Mock: request.amountIn is wei; convert to human for fee math
    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const amountIn = parseFloat(fromWei(request.amountIn, fromDecimals));
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
    if (!routeId.startsWith(this.name)) {
      throw new Error(`Invalid routeId for ${this.name} adapter`);
    }

    try {
      const clientId = this.hasKyberKey ? KyberSwapAdapter.getClientId() : undefined;
      if (this.hasKyberKey && !clientId) {
        throw new Error("KYBERSWAP_CLIENT_ID required for KyberSwap partner mode (getTx)");
      }

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
        const quoteUrl = `${this.baseUrl}/${chainName}/api/v1/routes`;
        const quoteParams = new URLSearchParams({
          tokenIn: request.fromToken,
          tokenOut: request.toToken,
          amountIn: request.amountIn,
        });
        if (this.hasKyberKey) {
          const { receivers, bps } = getFeeReceiversAndBpsForKyber(request.fromChainId);
          if (receivers.length > 0 && bps.length > 0) {
            quoteParams.set("chargeFeeBy", "currency_out");
            quoteParams.set("isInBps", "true");
            quoteParams.set("feeReceiver", receivers.join(","));
            quoteParams.set("feeAmount", bps.map((b) => String(Math.max(0, Math.floor(Number(b))))).join(","));
          }
        }
        const buildHeaders: Record<string, string> = {};
        if (clientId) buildHeaders["x-client-id"] = clientId;
        if (this.apiKey) buildHeaders["X-API-KEY"] = this.apiKey;
        const quoteRes = await httpRequest<{ routeSummary: unknown }>(
          `${quoteUrl}?${quoteParams.toString()}`,
          {
            method: "GET",
            headers: Object.keys(buildHeaders).length > 0 ? buildHeaders : undefined,
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

      const url = `${this.baseUrl}/${chainName}/api/v1/route/build`;
      const body: Record<string, unknown> = {
        routeSummary,
        sender: request.recipient,
        recipient: request.recipient,
        slippageTolerance: Math.round((request.slippageTolerance ?? 0.5) * 100),
        deadline: Math.floor(Date.now() / 1000) + 1800,
        source: clientId ?? "MonetaDEX",
        referral: this.hasKyberKey ? "partner=MonetaDEX|revshare=platform" : undefined,
      };
      if (body.referral === undefined) delete body.referral;

      const postHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (clientId) postHeaders["x-client-id"] = clientId;
      if (this.apiKey) postHeaders["X-API-KEY"] = this.apiKey;

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
        headers: postHeaders,
        body,
        timeout: 8000,
      });

      if (response.status !== 200) {
        throw new Error(`KyberSwap API returned status ${response.status}`);
      }

      // API returns { code, message, data: { data, routerAddress, transactionValue, gas, ... } }
      const payload = response.data?.data;

      return {
        routeId,
        txData: payload?.data ?? "",
        to: payload?.routerAddress ?? request.toToken,
        value: payload?.transactionValue ?? "0",
        gasLimit: payload?.gas ?? "200000",
        gasPrice: payload?.gasPrice ?? "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from KyberSwap");
      throw error;
    }
  }
}

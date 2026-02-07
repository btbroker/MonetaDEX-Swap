import { createHmac } from "crypto";
import { BaseAdapter } from "./base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route, RouteStep, RouteType } from "@fortuna/shared";
import { generateRouteId } from "../utils/routeId.js";
import type { Tool } from "../registry/tool-registry.js";
import { httpRequest } from "../utils/http-client.js";
import { rateLimiter, getRateLimitConfig } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { logger } from "../utils/logger.js";
import { DEBUG_QUOTES, sanitizeResponseMessage } from "../utils/debug-quotes.js";
import { getFeeRecipientWithFallback, getPlatformFeeBps } from "../utils/fee-config.js";
import { getTokenDecimals, fromWei } from "../utils/token-decimals.js";

/** OKX env vars: OKX_ACCESS_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE. OKX_PROJECT_ID optional. */
function getOkxCreds(): { apiKey: string; secretKey: string; passphrase: string } | undefined {
  const apiKey = process.env.OKX_ACCESS_KEY?.trim();
  const secretKey = process.env.OKX_SECRET_KEY?.trim();
  const passphrase = process.env.OKX_PASSPHRASE?.trim();
  if (!apiKey || !secretKey || !passphrase) return undefined;
  return { apiKey, secretKey, passphrase };
}

/**
 * Compute OKX HMAC SHA256 + Base64 signature for prehash string.
 * prehash = timestamp + method + pathWithQuery + (body ?? "").
 * Exported for unit tests.
 */
export function computeOkxSignature(prehash: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(prehash).digest("base64");
}

/**
 * Build OKX REST auth headers per OKX docs (HMAC SHA256 + Base64).
 * Prehash = timestamp + method + pathWithQuery + body. Never log secrets.
 */
function buildOkxHeaders(
  method: string,
  path: string,
  queryString: string,
  body: string | undefined,
  creds: { apiKey: string; secretKey: string; passphrase: string }
): Record<string, string> {
  const pathWithQuery = queryString ? `${path}?${queryString}` : path;
  const timestamp = new Date().toISOString();
  const prehash = timestamp + method.toUpperCase() + pathWithQuery + (body ?? "");
  const sign = computeOkxSignature(prehash, creds.secretKey);
  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": creds.apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": creds.passphrase,
  };
  const projectId = process.env.OKX_PROJECT_ID?.trim();
  if (projectId) headers["OK-ACCESS-PROJECT"] = projectId;
  return headers;
}

/**
 * OKX DEX Aggregator adapter for same-chain swaps.
 * Requires OKX_ACCESS_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE. If any missing, no requests are made and provider shows missing-key.
 */
export class OkxAdapter extends BaseAdapter {
  name = "okx";
  private readonly creds: { apiKey: string; secretKey: string; passphrase: string } | undefined;
  private readonly baseUrl = "https://web3.okx.com";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.creds = getOkxCreds();
    this.useMock = !this.creds;

    if (this.useMock) {
      logger.warn("OKX adapter disabled: OKX_ACCESS_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE required");
    }
  }

  /**
   * Get available tools/exchanges that OKX can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "OKX",
      ];
    }

    // OKX aggregates from multiple DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "OKX",
      "DODO",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["OKX"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    if (!this.creds) return [];

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
      if (this.useMock) return [];
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
      providerHealthTracker.recordFailure(this.name, errorMessage);
      quoteMetricsTracker.recordFailure(this.name, responseTime);

      logger.error({ error, provider: this.name }, "Failed to get quote from OKX");
      return [];
    }
  }

  /**
   * Get quote from real OKX DEX Aggregator API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to OKX chain indices
    const chainMap: Record<number, string> = {
      1: "1", // Ethereum
      10: "10", // Optimism
      56: "56", // BSC
      137: "137", // Polygon
      8453: "8453", // Base
      42161: "42161", // Arbitrum
      43114: "43114", // Avalanche
      534352: "534352", // Scroll
      5000: "5000", // Mantle
      81457: "81457", // Blast
      34443: "34443", // Mode
    };

    const chainIndex = chainMap[request.fromChainId];
    if (!chainIndex) {
      throw new Error(`Unsupported chain: ${request.fromChainId}`);
    }

    // OKX API expects amounts in minimal units; request.amountIn is already base units
    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);

    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();

    const path = "/api/v6/dex/aggregator/quote";
    const params = new URLSearchParams({
      chainIndex: chainIndex,
      amount: request.amountIn,
      fromTokenAddress: request.fromToken,
      toTokenAddress: request.toToken,
      swapMode: "exactIn",
      ...(feeRecipient && {
        feeRecipient: feeRecipient,
        feeBps: feeBps.toString(),
      }),
    });
    const queryString = params.toString();
    const headers = buildOkxHeaders("GET", path, queryString, undefined, this.creds!);

    if (DEBUG_QUOTES) {
      logger.info(
        {
          provider: this.name,
          chainIndex,
          amountIn: request.amountIn,
          headerNames: Object.keys(headers),
        },
        "DEBUG_QUOTES: outbound request"
      );
    }

    const response = await httpRequest<{
      code: string;
      data: Array<{
        amountOut: string;
        priceImpact: string; // Percentage
        gas: number;
        route: Array<{
          name: string;
          percentage: number;
        }>;
      }>;
    }>(`${this.baseUrl}${path}?${queryString}`, {
      method: "GET",
      headers,
      timeout: 8000,
    });

    const quotes = response.data?.data;
    const didReturnRouteCount =
      response.status === 200 && response.data?.code === "0" && Array.isArray(quotes) ? quotes.length : 0;
    if (DEBUG_QUOTES) {
      const data = response.data as Record<string, unknown> | undefined;
      const reason = data?.msg ?? data?.message ?? data?.error;
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

    if (response.status === 401 || response.status === 403) {
      const err = new Error("OKX API auth required") as Error & { statusCode?: number };
      err.statusCode = response.status;
      throw err;
    }
    if (response.status !== 200 || response.data.code !== "0") {
      throw new Error(`OKX API returned status ${response.status} or code ${response.data.code}`);
    }

    if (!quotes || quotes.length === 0) {
      throw new Error("No quotes returned from OKX");
    }

    const quote = quotes[0];

    // OKX returns amountOut in wei; normalize to human for correct display and ranking
    const amountOutHuman = fromWei(quote.amountOut, toDecimals);

    const toolsUsed: Tool[] = [];
    if (quote.route) {
      quote.route.forEach((step) => {
        if (step.name && !toolsUsed.includes(step.name)) {
          toolsUsed.push(step.name);
        }
      });
    }

    const priceImpactBps = quote.priceImpact
      ? Math.round(parseFloat(quote.priceImpact) * 100)
      : undefined;

    const platformFeeBps = getPlatformFeeBps();
    const amountOutNum = parseFloat(amountOutHuman);
    const platformFee = (amountOutNum * platformFeeBps) / 10000;
    const fees = platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: request.amountIn,
      amountOut: amountOutHuman,
      estimatedGas: quote.gas?.toString() || "150000",
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
          amountIn: request.amountIn,
          amountOut: amountOutHuman,
        } as RouteStep,
      ],
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["OKX"],
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
      // Map chain IDs to OKX chain indices
      const chainMap: Record<number, string> = {
        1: "1",
        10: "10",
        56: "56",
        137: "137",
        8453: "8453",
        42161: "42161",
        43114: "43114",
        534352: "534352",
        5000: "5000",
        81457: "81457",
        34443: "34443",
      };

      const chainIndex = chainMap[request.fromChainId];
      if (!chainIndex) {
        throw new Error(`Unsupported chain: ${request.fromChainId}`);
      }

      // Get fee recipient for partner fees
      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();

      const path = "/api/v6/dex/aggregator/swap";
      const params = new URLSearchParams({
        chainIndex: chainIndex,
        amount: request.amountIn,
        fromTokenAddress: request.fromToken,
        toTokenAddress: request.toToken,
        swapMode: "exactIn",
        slippage: ((request.slippageTolerance || 0.5) / 100).toString(),
        userWalletAddress: request.recipient,
        ...(feeRecipient && {
          feeRecipient: feeRecipient,
          feeBps: feeBps.toString(),
        }),
      });
      const queryString = params.toString();
      const headers = buildOkxHeaders("GET", path, queryString, undefined, this.creds!);

      const response = await httpRequest<{
        code: string;
        data: {
          to: string;
          data: string;
          value: string;
          gas: number;
          gasPrice: string;
        };
      }>(`${this.baseUrl}${path}?${queryString}`, {
        method: "GET",
        headers,
        timeout: 8000,
      });

      if (response.status === 401 || response.status === 403) {
        const err = new Error("OKX API auth required") as Error & { statusCode?: number };
        err.statusCode = response.status;
        throw err;
      }
      if (response.status !== 200 || response.data.code !== "0") {
        throw new Error(`OKX API returned status ${response.status} or code ${response.data.code}`);
      }

      const tx = response.data.data;

      return {
        routeId,
        txData: tx.data,
        to: tx.to,
        value: tx.value || "0",
        gasLimit: tx.gas?.toString() || "200000",
        gasPrice: tx.gasPrice || "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from OKX");
      throw error;
    }
  }
}

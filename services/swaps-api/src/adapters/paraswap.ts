import { BaseAdapter } from "./base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route, RouteStep, RouteType } from "@fortuna/shared";
import { generateRouteId } from "../utils/routeId.js";
import type { Tool } from "../registry/tool-registry.js";
import { httpRequest, getApiKey } from "../utils/http-client.js";
import { rateLimiter, getRateLimitConfig } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { logger } from "../utils/logger.js";
import { getFeeRecipientWithFallback, getPlatformFeeBps } from "../utils/fee-config.js";
import { getTokenDecimals, toWei, fromWei } from "../utils/token-decimals.js";

/**
 * Paraswap (Velora) adapter for same-chain swaps
 * Integrates with Paraswap API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class ParaswapAdapter extends BaseAdapter {
  name = "paraswap";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.paraswap.io";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("PARASWAP_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.info("Paraswap adapter: no API key; will attempt public (unauthenticated) requests");
    }
  }

  /**
   * Get available tools/exchanges that Paraswap can use
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
        "Paraswap",
      ];
    }

    // Paraswap aggregates from many DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "KyberSwap",
      "Paraswap",
      "DODO",
      "Bancor",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    // Paraswap API doesn't always expose which DEXs were used in the quote
    return ["Paraswap"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    if (!this.apiKey) return [];

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

      logger.error({ error, provider: this.name }, "Failed to get quote from Paraswap");
      return [];
    }
  }

  /**
   * Get quote from real Paraswap API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to Paraswap chain IDs
    const chainMap: Record<number, number> = {
      1: 1, // Ethereum
      10: 10, // Optimism
      56: 56, // BSC
      137: 137, // Polygon
      8453: 8453, // Base
      42161: 42161, // Arbitrum
      43114: 43114, // Avalanche
      534352: 534352, // Scroll
      5000: 5000, // Mantle
      81457: 81457, // Blast
      34443: 34443, // Mode
    };

    const chainId = chainMap[request.fromChainId];
    if (!chainId) {
      throw new Error(`Unsupported chain: ${request.fromChainId}`);
    }

    // Get fee recipient for partner fees
    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();

    // Paraswap expects amount in wei; request.amountIn is already base units
    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);

    // Paraswap prices endpoint
    const url = `${this.baseUrl}/prices`;
    const params = new URLSearchParams({
      srcToken: request.fromToken,
      destToken: request.toToken,
      amount: request.amountIn,
      srcDecimals: fromDecimals.toString(),
      destDecimals: toDecimals.toString(),
      side: "SELL",
      network: chainId.toString(),
      ...(feeRecipient && {
        partner: feeRecipient,
        partnerFee: feeBps.toString(), // Paraswap expects basis points
      }),
    });

    const response = await httpRequest<{
      priceRoute: {
        blockNumber: number;
        network: number;
        srcToken: string;
        srcDecimals: number;
        srcAmount: string;
        destToken: string;
        destDecimals: number;
        destAmount: string;
        bestRoute: Array<{
          percent: number;
          swaps: Array<{
            srcToken: string;
            destToken: string;
            srcAmount: string;
            destAmount: string;
            exchange: string;
          }>;
        }>;
        gasCostUSD: string;
        gasCost: string;
        side: string;
        tokenTransferProxy: string;
        contractAddress: string;
        contractMethod: string;
        partnerFee?: number;
        srcUSD: string;
        destUSD: string;
        partner?: string;
        maxImpactReached: boolean;
        hmac: string;
      };
    }>(`${url}?${params.toString()}`, {
      method: "GET",
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      timeout: 8000,
    });

    if (response.status === 401 || response.status === 403) {
      const err = new Error("Paraswap API auth required") as Error & { statusCode?: number };
      err.statusCode = response.status;
      throw err;
    }
    if (response.status === 404) {
      const err = new Error("Paraswap API unsupported") as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    if (response.status !== 200) {
      throw new Error(`Paraswap API returned status ${response.status}`);
    }

    const quote = response.data.priceRoute;

    // Extract tools used from bestRoute
    const toolsUsed: Tool[] = [];
    quote.bestRoute.forEach((route) => {
      route.swaps.forEach((swap) => {
        if (swap.exchange && !toolsUsed.includes(swap.exchange)) {
          toolsUsed.push(swap.exchange);
        }
      });
    });

    // Calculate price impact (Paraswap provides maxImpactReached flag)
    const priceImpactBps = quote.maxImpactReached ? 100 : undefined; // If max impact reached, it's high

    // Paraswap returns amounts in wei; normalize to human for consistent display/ranking
    const amountInHuman = fromWei(quote.srcAmount, fromDecimals);
    const amountOutHuman = fromWei(quote.destAmount, toDecimals);

    // Calculate fees
    // Paraswap includes partner fee in the quote, so destAmount already accounts for it
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
      amountIn: amountInHuman,
      amountOut: amountOutHuman,
      estimatedGas: quote.gasCost || "150000",
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
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["Paraswap"],
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
      // Map chain IDs to Paraswap chain IDs
      const chainMap: Record<number, number> = {
        1: 1,
        10: 10,
        56: 56,
        137: 137,
        8453: 8453,
        42161: 42161,
        43114: 43114,
        534352: 534352,
        5000: 5000,
        81457: 81457,
        34443: 34443,
      };

      const chainId = chainMap[request.fromChainId];
      if (!chainId) {
        throw new Error(`Unsupported chain: ${request.fromChainId}`);
      }

      // Get fee recipient for partner fees
      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();

      // First get the price route
      const priceUrl = `${this.baseUrl}/prices`;
      const priceParams = new URLSearchParams({
        srcToken: request.fromToken,
        destToken: request.toToken,
        amount: request.amountIn,
        srcDecimals: "18",
        destDecimals: "18",
        side: "SELL",
        network: chainId.toString(),
        ...(feeRecipient && {
          partner: feeRecipient,
          partnerFee: feeBps.toString(),
        }),
      });

      const priceResponse = await httpRequest<{
        priceRoute: {
          blockNumber: number;
          network: number;
          srcToken: string;
          srcDecimals: number;
          srcAmount: string;
          destToken: string;
          destDecimals: number;
          destAmount: string;
          bestRoute: Array<{
            percent: number;
            swaps: Array<{
              srcToken: string;
              destToken: string;
              srcAmount: string;
              destAmount: string;
              exchange: string;
            }>;
          }>;
          gasCostUSD: string;
          gasCost: string;
          side: string;
          tokenTransferProxy: string;
          contractAddress: string;
          contractMethod: string;
          partnerFee?: number;
          srcUSD: string;
          destUSD: string;
          partner?: string;
          maxImpactReached: boolean;
          hmac: string;
        };
      }>(`${priceUrl}?${priceParams.toString()}`, {
        method: "GET",
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        timeout: 8000,
      });

      if (priceResponse.status !== 200) {
        throw new Error(`Paraswap price API returned status ${priceResponse.status}`);
      }

      const priceRouteData = priceResponse.data.priceRoute;

      // Then get the transaction data
      const swapUrl = `${this.baseUrl}/transactions/${chainId}`;
      const swapBody = {
        srcToken: request.fromToken,
        destToken: request.toToken,
        srcAmount: request.amountIn,
        destAmount: priceRouteData.destAmount,
        priceRoute: priceRouteData,
        userAddress: request.recipient,
        partner: feeRecipient || undefined,
        partnerFee: feeRecipient ? feeBps : undefined,
        slippage: request.slippageTolerance || 0.5,
      };

      const swapResponse = await httpRequest<{
        data: string;
        to: string;
        value: string;
        gas: string;
        gasPrice: string;
      }>(swapUrl, {
        method: "POST",
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: swapBody,
        timeout: 8000,
      });

      if (swapResponse.status !== 200) {
        throw new Error(`Paraswap swap API returned status ${swapResponse.status}`);
      }

      const tx = swapResponse.data;

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
      logger.error({ error, routeId }, "Failed to get tx from Paraswap");
      throw error;
    }
  }
}

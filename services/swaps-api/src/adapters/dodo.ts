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
 * DODO adapter for same-chain swaps
 * Integrates with DODO SmartTrade API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class DodoAdapter extends BaseAdapter {
  name = "dodo";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.dodoex.io";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("DODO_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("DODO adapter running in mock mode (DODO_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that DODO can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "DODO",
      ];
    }

    // DODO aggregates from multiple sources
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "DODO",
      "DODO PMM",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["DODO"];
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

      if (this.useMock) return [];
      routes = await this.getRealQuote(request);

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

      logger.error({ error, provider: this.name }, "Failed to get quote from DODO");
      return [];
    }
  }

  /**
   * Get quote from real DODO SmartTrade API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to DODO chain IDs
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

    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();

    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);
    const amountWei = toWei(request.amountIn, fromDecimals);

    const url = `${this.baseUrl}/smart-route/v1/quote`;
    const body = {
      fromTokenAddress: request.fromToken,
      toTokenAddress: request.toToken,
      fromTokenAmount: amountWei,
      chainId: chainId,
      userAddr: feeRecipient || "0x0000000000000000000000000000000000000000",
      ...(feeRecipient && {
        feeAddress: feeRecipient,
        feeAmount: feeBps.toString(), // DODO may use different fee format
      }),
    };

    const response = await httpRequest<{
      resAmount: string;
      resPrice: string;
      priceImpact: number; // Percentage
      gas: number;
      path: Array<{
        name: string;
        part: number;
      }>;
    }>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
      },
      body,
      timeout: 8000,
    });

    if (response.status !== 200) {
      throw new Error(`DODO API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used from path
    const toolsUsed: Tool[] = [];
    if (quote.path) {
      quote.path.forEach((step) => {
        if (step.name && !toolsUsed.includes(step.name)) {
          toolsUsed.push(step.name);
        }
      });
    }

    // Calculate price impact in basis points
    const priceImpactBps = quote.priceImpact
      ? Math.round(quote.priceImpact * 100) // Convert percentage to basis points
      : undefined;

    const amountInHuman = fromWei(amountWei, fromDecimals);
    const amountOutHuman = fromWei(quote.resAmount, toDecimals);

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
          amountIn: amountInHuman,
          amountOut: amountOutHuman,
        } as RouteStep,
      ],
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["DODO"],
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
      // Map chain IDs to DODO chain IDs
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

      // DODO SmartTrade swap endpoint
      const url = `${this.baseUrl}/smart-route/v1/swap`;
      const body = {
        fromTokenAddress: request.fromToken,
        toTokenAddress: request.toToken,
        fromTokenAmount: request.amountIn,
        chainId: chainId,
        userAddr: request.recipient,
        slippage: request.slippageTolerance || 0.5,
        ...(feeRecipient && {
          feeAddress: feeRecipient,
          feeAmount: feeBps.toString(),
        }),
      };

      const response = await httpRequest<{
        to: string;
        data: string;
        value: string;
        gas: number;
        gasPrice: string;
      }>(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
        },
        body,
        timeout: 8000,
      });

      if (response.status !== 200) {
        throw new Error(`DODO API returned status ${response.status}`);
      }

      const tx = response.data;

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
      logger.error({ error, routeId }, "Failed to get tx from DODO");
      throw error;
    }
  }
}

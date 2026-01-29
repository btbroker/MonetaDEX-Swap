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

/**
 * SushiSwap adapter for same-chain swaps
 * Integrates with SushiSwap Aggregator API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class SushiSwapAdapter extends BaseAdapter {
  name = "sushiswap";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.sushi.com";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("SUSHISWAP_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("SushiSwap adapter running in mock mode (SUSHISWAP_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that SushiSwap can use
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

    // SushiSwap aggregates from many DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "DODO",
      "Bancor",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["SushiSwap"];
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

      logger.error({ error, provider: this.name }, "Failed to get quote from SushiSwap");
      return [];
    }
  }

  /**
   * Get quote from real SushiSwap API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to SushiSwap chain IDs
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

    // SushiSwap quote endpoint
    const url = `${this.baseUrl}/quote/v7/${chainId}`;
    const params = new URLSearchParams({
      tokenIn: request.fromToken,
      tokenOut: request.toToken,
      amount: request.amountIn,
      maxSlippage: ((request.slippageTolerance || 0.5) / 100).toString(),
      ...(feeRecipient && {
        feeRecipient: feeRecipient,
        feeBps: feeBps.toString(),
      }),
      ...(this.apiKey && { apiKey: this.apiKey }),
    });

    const response = await httpRequest<{
      amountIn: string;
      amountOut: string;
      priceImpact: string; // Fraction (e.g., "0.001" for 0.1%)
      route: Array<{
        pool: string;
        tokenIn: string;
        tokenOut: string;
      }>;
    }>(`${url}?${params.toString()}`, {
      method: "GET",
      timeout: 8000,
    });

    if (response.status !== 200) {
      throw new Error(`SushiSwap API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used from route
    const toolsUsed: Tool[] = [];
    if (quote.route) {
      quote.route.forEach((step) => {
        // SushiSwap route may contain pool information
        if (!toolsUsed.includes("SushiSwap")) {
          toolsUsed.push("SushiSwap");
        }
      });
    }

    // Calculate price impact in basis points
    const priceImpactBps = quote.priceImpact
      ? Math.round(parseFloat(quote.priceImpact) * 10000) // Convert fraction to basis points
      : undefined;

    // Calculate fees
    const platformFeeBps = getPlatformFeeBps();
    const amountOut = parseFloat(quote.amountOut);
    const platformFee = (amountOut * platformFeeBps) / 10000;

    // Total fees = platform fee (DEX fees are already in the price difference)
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
      estimatedGas: "150000", // SushiSwap doesn't provide gas estimate in quote
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
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["SushiSwap"],
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
      // Map chain IDs to SushiSwap chain IDs
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

      // SushiSwap swap endpoint
      const url = `${this.baseUrl}/swap/v7/${chainId}`;
      const params = new URLSearchParams({
        tokenIn: request.fromToken,
        tokenOut: request.toToken,
        amount: request.amountIn,
        maxSlippage: ((request.slippageTolerance || 0.5) / 100).toString(),
        sender: request.recipient,
        ...(feeRecipient && {
          feeRecipient: feeRecipient,
          feeBps: feeBps.toString(),
        }),
        ...(this.apiKey && { apiKey: this.apiKey }),
      });

      const response = await httpRequest<{
        status: "Success" | "Partial" | "NoWay";
        transaction: {
          from: string;
          to: string;
          data: string;
          value: string;
          gas?: number;
        };
      }>(`${url}?${params.toString()}`, {
        method: "GET",
        timeout: 8000,
      });

      if (response.status !== 200 || response.data.status !== "Success") {
        throw new Error(`SushiSwap API returned status ${response.status} or ${response.data.status}`);
      }

      const tx = response.data.transaction;

      return {
        routeId,
        txData: tx.data,
        to: tx.to,
        value: tx.value || "0",
        gasLimit: tx.gas?.toString() || "200000",
        gasPrice: "20000000000", // SushiSwap doesn't provide gasPrice
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from SushiSwap");
      throw error;
    }
  }
}

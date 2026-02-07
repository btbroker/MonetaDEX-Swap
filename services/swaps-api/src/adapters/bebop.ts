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
 * Bebop adapter for same-chain swaps
 * Integrates with Bebop Router API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class BebopAdapter extends BaseAdapter {
  name = "bebop";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.bebop.xyz";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("BEBOP_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("Bebop adapter running in mock mode (BEBOP_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that Bebop can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "Bebop",
      ];
    }

    // Bebop aggregates from multiple sources
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "Bebop",
      "PMM",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["Bebop"];
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

      logger.error({ error, provider: this.name }, "Failed to get quote from Bebop");
      return [];
    }
  }

  /**
   * Get quote from real Bebop Router API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to Bebop chain names
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

    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);
    const amountWei = toWei(request.amountIn, fromDecimals);

    const url = `${this.baseUrl}/router/${chainName}/v1/quote`;
    const body = {
      sellToken: request.fromToken,
      buyToken: request.toToken,
      sellAmount: amountWei,
      takerAddress: feeRecipient || "0x0000000000000000000000000000000000000000",
      ...(feeRecipient && {
        feeRecipient: feeRecipient,
        feeBps: feeBps.toString(),
      }),
    };

    const response = await httpRequest<{
      buyAmount: string;
      sellAmount: string;
      buyToken: string;
      sellToken: string;
      estimatedGas: number;
      route: Array<{
        source: string;
        percentage: number;
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
      throw new Error(`Bebop API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used from route
    const toolsUsed: Tool[] = [];
    if (quote.route) {
      quote.route.forEach((step) => {
        if (step.source && !toolsUsed.includes(step.source)) {
          toolsUsed.push(step.source);
        }
      });
    }

    // Calculate price impact (Bebop doesn't provide this directly)
    const priceImpactBps = undefined;

    const amountInHuman = fromWei(quote.sellAmount, fromDecimals);
    const amountOutHuman = fromWei(quote.buyAmount, toDecimals);

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
      estimatedGas: quote.estimatedGas?.toString() || "150000",
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
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["Bebop"],
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
      // Map chain IDs to Bebop chain names
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

      // Get fee recipient for partner fees
      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();

      // Bebop Router API build transaction endpoint
      const url = `${this.baseUrl}/router/${chainName}/v1/swap`;
      const body = {
        sellToken: request.fromToken,
        buyToken: request.toToken,
        sellAmount: request.amountIn,
        takerAddress: request.recipient,
        slippageTolerance: request.slippageTolerance || 0.5,
        ...(feeRecipient && {
          feeRecipient: feeRecipient,
          feeBps: feeBps.toString(),
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
        throw new Error(`Bebop API returned status ${response.status}`);
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
      logger.error({ error, routeId }, "Failed to get tx from Bebop");
      throw error;
    }
  }
}

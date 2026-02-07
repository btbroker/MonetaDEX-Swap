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
 * 1inch adapter for same-chain swaps
 * Integrates with 1inch API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class OneInchAdapter extends BaseAdapter {
  name = "1inch";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.1inch.io";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("ONEINCH_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("1inch adapter running in mock mode (ONEINCH_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that 1inch can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "1inch",
        "KyberSwap",
      ];
    }

    // 1inch aggregates from many DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "1inch",
      "KyberSwap",
      "DODO",
      "Bancor",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    // 1inch API doesn't always expose which DEXs were used in the quote
    // Return generic 1inch aggregation
    return ["1inch"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    // Only handle same-chain swaps
    if (request.fromChainId !== request.toChainId) {
      return [];
    }

    const startTime = Date.now();

    // Check rate limit (1inch public API: 1 req/sec)
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

      logger.error({ error, provider: this.name }, "Failed to get quote from 1inch");
      return [];
    }
  }

  /**
   * Get quote from real 1inch API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to 1inch chain names
    const chainMap: Record<number, string> = {
      1: "eth",
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

    // Get fee recipient for referrer fees
    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();

    // 1inch expects amount in wei (smallest unit)
    const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
    const toDecimals = getTokenDecimals(request.toChainId, request.toToken);
    const amountWei = toWei(request.amountIn, fromDecimals);

    // 1inch quote endpoint
    const url = `${this.baseUrl}/v5.2/${chainName}/quote`;
    const params = new URLSearchParams({
      fromTokenAddress: request.fromToken,
      toTokenAddress: request.toToken,
      amount: amountWei,
      ...(feeRecipient && {
        referrerAddress: feeRecipient,
        fee: (feeBps / 100).toFixed(2), // 1inch expects percentage (0.1 for 10 BPS)
      }),
    });

    const response = await httpRequest<{
      fromToken: { address: string; symbol: string; decimals: number };
      toToken: { address: string; symbol: string; decimals: number };
      toTokenAmount: string;
      fromTokenAmount: string;
      protocols: Array<Array<Array<{ name: string; part: number; fromTokenAddress: string; toTokenAddress: string }>>>;
      estimatedGas: number;
    }>(`${url}?${params.toString()}`, {
      method: "GET",
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      timeout: 8000,
    });

    if (response.status !== 200) {
      throw new Error(`1inch API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used from protocols
    const toolsUsed: Tool[] = [];
    quote.protocols.forEach((protocolGroup) => {
      protocolGroup.forEach((protocol) => {
        protocol.forEach((step) => {
          if (step.name && !toolsUsed.includes(step.name)) {
            toolsUsed.push(step.name);
          }
        });
      });
    });

    // 1inch returns amounts in wei; normalize to human for consistent display/ranking
    const amountInHuman = fromWei(quote.fromTokenAmount, fromDecimals);
    const amountOutHuman = fromWei(quote.toTokenAmount, toDecimals);

    const priceImpactBps = undefined; // 1inch doesn't provide price impact in quote

    // Calculate fees
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
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["1inch"],
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
    // 1inch often finds slightly better prices than 0x
    const amountIn = parseFloat(request.amountIn);
    const dexFeeRate = 0.0025; // 0.25% DEX fee (slightly better than 0x mock)
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
    const expectedRouteId = generateRouteId({
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: request.amountIn,
      amountOut: "0", // We'll get this from the API
      estimatedGas: "0",
      fees: "0",
      steps: [],
    });

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
      // Map chain IDs to 1inch chain names
      const chainMap: Record<number, string> = {
        1: "eth",
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

      // Get fee recipient for referrer fees
      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();

      // 1inch swap endpoint
      const url = `${this.baseUrl}/v5.2/${chainName}/swap`;
      const params = new URLSearchParams({
        fromTokenAddress: request.fromToken,
        toTokenAddress: request.toToken,
        amount: request.amountIn,
        fromAddress: request.recipient,
        slippageTolerance: ((request.slippageTolerance || 0.5) / 100).toString(), // Convert to decimal
        ...(feeRecipient && {
          referrerAddress: feeRecipient,
          fee: (feeBps / 100).toFixed(2),
        }),
      });

      const response = await httpRequest<{
        tx: {
          to: string;
          data: string;
          value: string;
          gas: number;
          gasPrice: string;
        };
        toTokenAmount: string;
        fromTokenAmount: string;
      }>(`${url}?${params.toString()}`, {
        method: "GET",
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
        timeout: 8000,
      });

      if (response.status !== 200) {
        throw new Error(`1inch API returned status ${response.status}`);
      }

      const swap = response.data;

      return {
        routeId,
        txData: swap.tx.data,
        to: swap.tx.to,
        value: swap.tx.value || "0",
        gasLimit: swap.tx.gas?.toString() || "200000",
        gasPrice: swap.tx.gasPrice || "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from 1inch");
      throw error;
    }
  }
}

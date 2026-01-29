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

      logger.error({ error, provider: this.name }, "Failed to get quote from 0x");
      return [];
    }
  }

  /**
   * Get quote from real 0x API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to 0x chain names
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

    // Get fee recipient for affiliate fees
    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();

    const url = `${this.baseUrl}/swap/v1/quote`;
    const params = new URLSearchParams({
      sellToken: request.fromToken,
      buyToken: request.toToken,
      sellAmount: request.amountIn,
      slippagePercentage: (request.slippageTolerance || 0.5).toString(),
      ...(feeRecipient && {
        affiliateAddress: feeRecipient,
        feeRecipient: feeRecipient,
        buyTokenPercentageFee: (feeBps / 100).toFixed(4), // 0x expects percentage (0.1 for 10 BPS)
      }),
    });

    const response = await httpRequest<{
      price: string;
      guaranteedPrice: string;
      estimatedPriceImpact: string;
      buyAmount: string;
      sellAmount: string;
      buyToken: string;
      sellToken: string;
      allowanceTarget: string;
      to: string;
      data: string;
      value: string;
      gas: string;
      gasPrice: string;
      sources: Array<{ name: string; proportion: string }>;
    }>(`${url}?${params.toString()}`, {
      method: "GET",
      headers: this.apiKey ? { "0x-api-key": this.apiKey } : {},
      timeout: 8000,
    });

    if (response.status !== 200) {
      throw new Error(`0x API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used from sources
    const toolsUsed: Tool[] = quote.sources.map((source) => source.name);

    // Calculate price impact (0x returns as decimal, convert to bps)
    const priceImpactBps = quote.estimatedPriceImpact
      ? Math.round(parseFloat(quote.estimatedPriceImpact) * 10000)
      : undefined;

    // Calculate fees
    // Note: With affiliate fees, 0x automatically routes fees to our recipient
    // The fees shown here are the total DEX fees, not our platform fee
    const sellAmount = parseFloat(quote.sellAmount);
    const buyAmount = parseFloat(quote.buyAmount);
    const price = parseFloat(quote.price);
    const expectedBuyAmount = sellAmount * price;
    const totalFees = expectedBuyAmount - buyAmount;
    
    // Calculate our platform fee (10 BPS of output)
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (buyAmount * platformFeeBps) / 10000;
    
    // Total fees = DEX fees + our platform fee
    const fees = totalFees + platformFee;

    // Note: With 0x affiliate fees, the buyAmount already accounts for our platform fee
    // 0x automatically routes the fee to our recipient address
    // The amountOut shown to users is the net amount they receive
    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: quote.sellAmount,
      amountOut: quote.buyAmount, // Already net of platform fee via affiliate
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
          amountIn: quote.sellAmount,
          amountOut: quote.buyAmount,
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
    // Mock: Calculate a simple swap with 0.3% DEX fee + 0.1% platform fee
    const amountIn = parseFloat(request.amountIn);
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

      // Get fee recipient for affiliate fees
      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();

      const url = `${this.baseUrl}/swap/v1/quote`;
      const params = new URLSearchParams({
        sellToken: request.fromToken,
        buyToken: request.toToken,
        sellAmount: request.amountIn,
        slippagePercentage: (request.slippageTolerance || 0.5).toString(),
        takerAddress: request.recipient,
        ...(feeRecipient && {
          affiliateAddress: feeRecipient,
          feeRecipient: feeRecipient,
          buyTokenPercentageFee: (feeBps / 100).toFixed(4), // 0x expects percentage (0.1 for 10 BPS)
        }),
      });

      const response = await httpRequest<{
        to: string;
        data: string;
        value: string;
        gas: string;
        gasPrice: string;
      }>(`${url}?${params.toString()}`, {
        method: "GET",
        headers: this.apiKey ? { "0x-api-key": this.apiKey } : {},
        timeout: 8000,
      });

      if (response.status !== 200) {
        throw new Error(`0x API returned status ${response.status}`);
      }

      const tx = response.data;

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

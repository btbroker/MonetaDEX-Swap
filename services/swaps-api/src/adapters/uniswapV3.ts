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
 * Uniswap V3 adapter for same-chain swaps
 * Direct integration with Uniswap V3 protocol
 * Uses Uniswap V3 Quoter V2 for quotes and SwapRouter for transactions
 * Falls back to mock mode if API key is not provided (for future API usage)
 */
export class UniswapV3Adapter extends BaseAdapter {
  name = "uniswap-v3";
  private readonly apiKey?: string;
  private readonly useMock: boolean;

  // Uniswap V3 contract addresses (same across all EVM chains)
  private readonly routerAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // SwapRouter02
  private readonly quoterV2Address = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"; // QuoterV2

  constructor() {
    super();
    this.apiKey = getApiKey("UNISWAP_V3_API_KEY"); // Optional for future API usage
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("Uniswap V3 adapter running in mock mode (will use contract calls)");
    }
  }

  /**
   * Get available tools/exchanges that Uniswap V3 can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    return ["Uniswap V3"];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["Uniswap V3"];
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

      // For now, use mock mode (will implement contract calls next)
      // TODO: Implement QuoterV2 contract calls via viem
      routes = await this.getMockQuote(request);

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

      logger.error({ error, provider: this.name }, "Failed to get quote from Uniswap V3");
      return [];
    }
  }

  /**
   * Get quote from real Uniswap V3 QuoterV2 contract
   * TODO: Implement using viem to call QuoterV2 contract
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // TODO: Implement QuoterV2 contract calls
    // Use viem to call quoterV2.quoteExactInputSingle()
    // This requires:
    // 1. RPC provider for the chain
    // 2. QuoterV2 ABI
    // 3. Contract call via viem
    throw new Error("Real quote not yet implemented - use aggregators for now");
  }

  /**
   * Get mock quote (temporary until contract calls are implemented)
   */
  private async getMockQuote(request: QuoteRequest): Promise<Route[]> {
    // Mock: Calculate a simple swap with 0.3% Uniswap V3 fee + 0.1% platform fee
    const amountIn = parseFloat(request.amountIn);
    const dexFeeRate = 0.003; // 0.3% Uniswap V3 fee (typical)
    const amountAfterDexFee = amountIn * (1 - dexFeeRate);
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (amountAfterDexFee * platformFeeBps) / 10000;
    const amountOut = amountAfterDexFee - platformFee;
    const fees = (amountIn * dexFeeRate) + platformFee;

    // Calculate price impact (mock: 0.1% for same-chain swaps)
    const priceImpactBps = 10; // 0.1% = 10 basis points

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: request.amountIn,
      amountOut: amountOut.toFixed(18),
      estimatedGas: "180000", // Uniswap V3 gas estimate
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
      toolsUsed: ["Uniswap V3"],
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
      amountOut: "0",
      estimatedGas: "0",
      fees: "0",
      steps: [],
    });

    if (!routeId.startsWith(this.name)) {
      throw new Error(`Invalid routeId for ${this.name} adapter`);
    }

    // TODO: Implement SwapRouter contract call via viem
    // For now, return mock transaction data
    return {
      routeId,
      txData: "0x", // TODO: Build actual swap transaction
      to: this.routerAddress,
      value: "0",
      gasLimit: "200000",
      gasPrice: "20000000000", // 20 gwei
      chainId: request.fromChainId,
    };
  }
}

import { BaseAdapter } from "./base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route, RouteStep, RouteType } from "@fortuna/shared";
import { generateRouteId } from "../utils/routeId.js";
import type { Tool } from "../registry/tool-registry.js";
import { rateLimiter, getRateLimitConfig } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { logger } from "../utils/logger.js";
import { getFeeRecipientWithFallback, getPlatformFeeBps } from "../utils/fee-config.js";

/**
 * Uniswap V2 adapter for same-chain swaps
 * Direct integration with Uniswap V2 protocol
 * Uses Uniswap V2 Router for quotes and transactions
 */
export class UniswapV2Adapter extends BaseAdapter {
  name = "uniswap-v2";
  private readonly routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 Router02

  async getAvailableTools(): Promise<Tool[]> {
    return ["Uniswap V2"];
  }

  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["Uniswap V2"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    if (request.fromChainId !== request.toChainId) return [];

    const startTime = Date.now();
    const rateLimit = rateLimiter.checkLimit(this.name, getRateLimitConfig(this.name));

    if (!rateLimit.allowed || !providerHealthTracker.isHealthy(this.name)) {
      if (!rateLimit.allowed) providerHealthTracker.recordFailure(this.name, "Rate limit exceeded");
      return [];
    }

    try {
      const routes = await this.getMockQuote(request);
      const responseTime = Date.now() - startTime;
      providerHealthTracker.recordSuccess(this.name, responseTime);
      quoteMetricsTracker.recordSuccess(this.name, responseTime, routes.length, routes[0]?.amountOut);
      return routes;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      providerHealthTracker.recordFailure(this.name, errorMessage);
      quoteMetricsTracker.recordFailure(this.name, responseTime);
      logger.error({ error, provider: this.name }, "Failed to get quote from Uniswap V2");
      return [];
    }
  }

  private async getMockQuote(request: QuoteRequest): Promise<Route[]> {
    const amountIn = parseFloat(request.amountIn);
    const dexFeeRate = 0.003; // 0.3% Uniswap V2 fee
    const amountAfterDexFee = amountIn * (1 - dexFeeRate);
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (amountAfterDexFee * platformFeeBps) / 10000;
    const amountOut = amountAfterDexFee - platformFee;
    const fees = (amountIn * dexFeeRate) + platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: request.amountIn,
      amountOut: amountOut.toFixed(18),
      estimatedGas: "150000",
      fees: fees.toFixed(18),
      priceImpactBps: 10,
      steps: [{
        type: "swap",
        provider: this.name,
        fromChainId: request.fromChainId,
        toChainId: request.toChainId,
        fromToken: request.fromToken,
        toToken: request.toToken,
        amountIn: request.amountIn,
        amountOut: amountOut.toFixed(18),
      } as RouteStep],
      toolsUsed: ["Uniswap V2"],
    };

    return [{ ...route, routeId: generateRouteId(route) }];
  }

  async getTx(routeId: string, request: TxRequest): Promise<TxResponse> {
    if (!routeId.startsWith(this.name)) {
      throw new Error(`Invalid routeId for ${this.name} adapter`);
    }

    return {
      routeId,
      txData: "0x",
      to: this.routerAddress,
      value: "0",
      gasLimit: "180000",
      gasPrice: "20000000000",
      chainId: request.fromChainId,
    };
  }
}

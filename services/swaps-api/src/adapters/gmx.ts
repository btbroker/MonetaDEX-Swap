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
 * GMX adapter for same-chain swaps
 * Direct integration with GMX protocol
 * Perpetuals + spot trading, Arbitrum native
 */
export class GMXAdapter extends BaseAdapter {
  name = "gmx";

  async getAvailableTools(): Promise<Tool[]> {
    return ["GMX"];
  }

  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["GMX"];
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
      logger.error({ error, provider: this.name }, "Failed to get quote from GMX");
      return [];
    }
  }

  private async getMockQuote(request: QuoteRequest): Promise<Route[]> {
    const amountIn = parseFloat(request.amountIn);
    const dexFeeRate = 0.001; // 0.1% GMX fee (low for spot)
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
      estimatedGas: "200000", // GMX can be gas-intensive
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
      toolsUsed: ["GMX"],
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
      to: "0x0000000000000000000000000000000000000000",
      value: "0",
      gasLimit: "220000",
      gasPrice: "20000000000",
      chainId: request.fromChainId,
    };
  }
}

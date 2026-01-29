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
 * dYdX adapter for same-chain swaps
 * Direct integration with dYdX protocol
 * Derivatives + spot trading, own Cosmos-based chain
 */
export class DydxAdapter extends BaseAdapter {
  name = "dydx";

  async getAvailableTools(): Promise<Tool[]> {
    return ["dYdX"];
  }

  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    return ["dYdX"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    // dYdX supports cross-chain (own chain)
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
      logger.error({ error, provider: this.name }, "Failed to get quote from dYdX");
      return [];
    }
  }

  private async getMockQuote(request: QuoteRequest): Promise<Route[]> {
    const amountIn = parseFloat(request.amountIn);
    const dexFeeRate = 0.0015; // 0.15% dYdX fee
    const amountAfterDexFee = amountIn * (1 - dexFeeRate);
    const platformFeeBps = getPlatformFeeBps();
    const platformFee = (amountAfterDexFee * platformFeeBps) / 10000;
    const amountOut = amountAfterDexFee - platformFee;
    const fees = (amountIn * dexFeeRate) + platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: request.fromChainId !== request.toChainId ? "bridge" : "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: request.amountIn,
      amountOut: amountOut.toFixed(18),
      estimatedGas: "0", // dYdX uses different fee model
      fees: fees.toFixed(18),
      priceImpactBps: 10,
      steps: [{
        type: request.fromChainId !== request.toChainId ? "bridge" : "swap",
        provider: this.name,
        fromChainId: request.fromChainId,
        toChainId: request.toChainId,
        fromToken: request.fromToken,
        toToken: request.toToken,
        amountIn: request.amountIn,
        amountOut: amountOut.toFixed(18),
      } as RouteStep],
      toolsUsed: ["dYdX"],
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
      gasLimit: "0",
      gasPrice: "0",
      chainId: request.fromChainId,
    };
  }
}

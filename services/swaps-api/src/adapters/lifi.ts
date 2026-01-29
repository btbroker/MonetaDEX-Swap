import { BaseAdapter } from "./base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route, RouteStep, RouteType } from "@fortuna/shared";
import { generateRouteId } from "../utils/routeId.js";
import type { Tool } from "../registry/tool-registry.js";
import { httpRequest, getApiKey } from "../utils/http-client.js";
import { rateLimiter, getRateLimitConfig } from "../utils/rate-limiter.js";
import { providerHealthTracker } from "../utils/provider-health.js";
import { quoteMetricsTracker } from "../metrics/quote-metrics.js";
import { logger } from "../utils/logger.js";
import { calculatePlatformFee, getPlatformFeeBps } from "../utils/fee-config.js";

/**
 * LI.FI adapter for cross-chain bridges
 * Integrates with LI.FI API for bridge aggregation
 * Falls back to mock mode if API key is not provided
 */
export class LiFiAdapter extends BaseAdapter {
  name = "lifi";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://li.quest/v1";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("LIFI_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("LiFi adapter running in mock mode (LIFI_API_KEY not set)");
    }
  }

  /**
   * Get available bridge tools that LI.FI can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      // Mock: Return common bridges that LI.FI aggregates
      return [
        "Stargate",
        "Hop Protocol",
        "Across",
        "Synapse",
        "Arbitrum Bridge",
        "Optimism Bridge",
        "Polygon Bridge",
        "LI.FI Native",
      ];
    }

    try {
      // In production, query LI.FI API for available bridges
      // For now, return static list
      return [
        "Stargate",
        "Hop Protocol",
        "Across",
        "Synapse",
        "Arbitrum Bridge",
        "Optimism Bridge",
        "Polygon Bridge",
        "LI.FI Native",
      ];
    } catch (error) {
      logger.warn({ error }, "Failed to get LiFi tools, using default list");
      return ["Stargate", "Hop Protocol"];
    }
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(provider: string, type: RouteType, steps: RouteStep[]): Tool[] {
    if (this.useMock) {
      return ["Stargate", "Hop Protocol"];
    }

    // In production, parse route steps to determine actual bridges
    return ["Stargate", "Hop Protocol"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    // Only handle cross-chain swaps
    if (request.fromChainId === request.toChainId) {
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

      logger.error({ error, provider: this.name }, "Failed to get quote from LiFi");
      return [];
    }
  }

  /**
   * Get quote from real LI.FI API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    const url = `${this.baseUrl}/quote`;
    const body = {
      fromChain: request.fromChainId,
      toChain: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      fromAmount: request.amountIn,
      slippage: request.slippageTolerance || 0.5,
    };

    const response = await httpRequest<{
      estimate: {
        fromAmount: string;
        toAmount: string;
        toAmountMin: string;
        approvalAddress: string;
        bridgeFee: string;
        gasCosts: Array<{
          estimate: string;
          limit: string;
          token: {
            address: string;
            symbol: string;
            decimals: number;
          };
        }>;
      };
      action: {
        to: string;
        data: string;
        value: string;
        gas: string;
        gasPrice: string;
      };
      tool: string;
      toolDetails: {
        key: string;
        name: string;
        logoURI: string;
      };
    }>(url, {
      method: "POST",
      headers: this.apiKey
        ? {
            Authorization: `Bearer ${this.apiKey}`,
          }
        : {},
      body,
      timeout: 15000, // 15 seconds for bridges
    });

    if (response.status !== 200) {
      throw new Error(`LI.FI API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used
    const toolsUsed: Tool[] = [quote.toolDetails.name || quote.tool];

    // Calculate total gas cost
    const totalGas = quote.estimate.gasCosts.reduce(
      (sum, gas) => sum + parseFloat(gas.estimate),
      0
    );

    // Calculate price impact (estimate based on slippage)
    const fromAmount = parseFloat(quote.estimate.fromAmount);
    const toAmount = parseFloat(quote.estimate.toAmount);
    const toAmountMin = parseFloat(quote.estimate.toAmountMin);
    
    // Calculate fees (bridge fee + platform fee)
    const bridgeFee = parseFloat(quote.estimate.bridgeFee || "0");
    const platformFee = calculatePlatformFee(toAmount);
    const fees = bridgeFee + platformFee;
    const slippageBps = ((toAmount - toAmountMin) / toAmount) * 10000;
    const priceImpactBps = Math.round(slippageBps);

    // Calculate amount out after platform fee
    // Note: For LI.FI, we deduct platform fee from output since they don't support affiliate fees
    const amountOutAfterFee = toAmount - platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "bridge",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: quote.estimate.fromAmount,
      amountOut: amountOutAfterFee.toFixed(18),
      estimatedGas: totalGas.toFixed(0),
      fees: fees.toFixed(18),
      priceImpactBps,
      steps: [
        {
          type: "bridge",
          provider: this.name,
          fromChainId: request.fromChainId,
          toChainId: request.toChainId,
          fromToken: request.fromToken,
          toToken: request.toToken,
          amountIn: quote.estimate.fromAmount,
          amountOut: quote.estimate.toAmount,
        } as RouteStep,
      ],
      warnings: ["Cross-chain bridge may take 10-30 minutes"],
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
    // Mock: Calculate a bridge with 0.5% bridge fee + 0.1% platform fee
    const amountIn = parseFloat(request.amountIn);
    const bridgeFeeRate = 0.005; // 0.5% bridge fee
    const amountAfterBridgeFee = amountIn * (1 - bridgeFeeRate);
    const platformFee = calculatePlatformFee(amountAfterBridgeFee);
    const amountOut = amountAfterBridgeFee - platformFee;
    const fees = (amountIn * bridgeFeeRate) + platformFee;

    // Calculate price impact (mock: 0.2% for cross-chain bridges)
    const priceImpactBps = 20; // 0.2% = 20 basis points

    // Get tools used for this route
    const toolsUsed = this.getToolsUsed(this.name, "bridge", []);

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "bridge",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: request.amountIn,
      amountOut: amountOut.toFixed(18),
      estimatedGas: "300000", // Higher gas for cross-chain
      fees: fees.toFixed(18),
      priceImpactBps,
      steps: [
        {
          type: "bridge",
          provider: this.name,
          fromChainId: request.fromChainId,
          toChainId: request.toChainId,
          fromToken: request.fromToken,
          toToken: request.toToken,
          amountIn: request.amountIn,
          amountOut: amountOut.toFixed(18),
        } as RouteStep,
      ],
      warnings: ["Cross-chain bridge may take 10-30 minutes"],
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
      // Mock transaction data for bridge
      return {
        routeId,
        txData: "0x" + "1".repeat(200), // Mock calldata
        to: "0x9876543210987654321098765432109876543210", // Mock bridge contract
        value: "0",
        gasLimit: "400000",
        gasPrice: "20000000000", // 20 gwei
        chainId: request.fromChainId,
      };
    }

    try {
      // Get quote to get transaction data
      const routes = await this.getRealQuote(request);
      const route = routes.find((r) => r.routeId === routeId);

      if (!route) {
        throw new Error(`Route not found: ${routeId}`);
      }

      // Get transaction data from LI.FI API
      const url = `${this.baseUrl}/quote`;
      const body = {
        fromChain: request.fromChainId,
        toChain: request.toChainId,
        fromToken: request.fromToken,
        toToken: request.toToken,
        fromAmount: request.amountIn,
        slippage: request.slippageTolerance || 0.5,
        fromAddress: request.recipient,
      };

      const response = await httpRequest<{
        action: {
          to: string;
          data: string;
          value: string;
          gas: string;
          gasPrice: string;
        };
      }>(url, {
        method: "POST",
        headers: this.apiKey
          ? {
              Authorization: `Bearer ${this.apiKey}`,
            }
          : {},
        body,
        timeout: 15000,
      });

      if (response.status !== 200) {
        throw new Error(`LI.FI API returned status ${response.status}`);
      }

      const tx = response.data.action;

      return {
        routeId,
        txData: tx.data,
        to: tx.to,
        value: tx.value || "0",
        gasLimit: tx.gas || "400000",
        gasPrice: tx.gasPrice || "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from LiFi");
      throw error;
    }
  }
}

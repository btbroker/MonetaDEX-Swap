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
 * Odos adapter for same-chain swaps
 * Integrates with Odos API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class OdosAdapter extends BaseAdapter {
  name = "odos";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://api.odos.xyz";
  private readonly useMock: boolean;
  private readonly partnerCode?: number; // Partner code for affiliate fees

  constructor() {
    super();
    this.apiKey = getApiKey("ODOS_API_KEY");
    this.useMock = !this.apiKey;
    
    // Partner code for affiliate fees (optional)
    // Range: 2,147,483,649-4,294,967,296 for codes with fees
    // For now, we'll use a tracking-only code (0-2,147,483,648) or get from env
    const partnerCodeEnv = process.env.ODOS_PARTNER_CODE;
    this.partnerCode = partnerCodeEnv ? parseInt(partnerCodeEnv, 10) : undefined;

    if (this.useMock) {
      logger.warn("Odos adapter running in mock mode (ODOS_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that Odos can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "Odos",
        "KyberSwap",
      ];
    }

    // Odos aggregates from many DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "Odos",
      "KyberSwap",
      "DODO",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    // Odos API doesn't always expose which DEXs were used in the quote
    return ["Odos"];
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

      logger.error({ error, provider: this.name }, "Failed to get quote from Odos");
      return [];
    }
  }

  /**
   * Get quote from real Odos API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to Odos chain IDs
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

    // Odos quote endpoint (V2)
    const url = `${this.baseUrl}/sor/quote/v2`;
    const body = {
      chainId: chainId,
      inputTokens: [
        {
          tokenAddress: request.fromToken,
          amount: request.amountIn,
        },
      ],
      outputTokens: [
        {
          tokenAddress: request.toToken,
          proportion: 1.0,
        },
      ],
      slippageLimitPercent: 0.5, // Default 0.5% slippage
      userAddr: feeRecipient || "0x0000000000000000000000000000000000000000",
      ...(this.partnerCode && { referralCode: this.partnerCode }),
    };

    const response = await httpRequest<{
      pathId: string;
      inputTokens: Array<{
        tokenAddress: string;
        amount: string;
      }>;
      outputTokens: Array<{
        tokenAddress: string;
        amount: string;
      }>;
      netOutValue: string;
      gasEstimate: number;
      pathViz: Array<{
        dexName: string;
        percent: number;
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
      throw new Error(`Odos API returned status ${response.status}`);
    }

    const quote = response.data;

    // Extract tools used from pathViz
    const toolsUsed: Tool[] = [];
    if (quote.pathViz) {
      quote.pathViz.forEach((path) => {
        if (path.dexName && !toolsUsed.includes(path.dexName)) {
          toolsUsed.push(path.dexName);
        }
      });
    }

    // Calculate price impact (Odos doesn't provide this directly)
    const priceImpactBps = undefined;

    // Calculate fees
    // Odos includes partner fee in the quote if partner code is set
    // We calculate our platform fee separately
    const platformFeeBps = getPlatformFeeBps();
    const netOut = parseFloat(quote.netOutValue || quote.outputTokens[0]?.amount || "0");
    const platformFee = (netOut * platformFeeBps) / 10000;

    // Total fees = platform fee (DEX fees are already in the price difference)
    const fees = platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: quote.inputTokens[0]?.amount || request.amountIn,
      amountOut: quote.netOutValue || quote.outputTokens[0]?.amount || "0",
      estimatedGas: quote.gasEstimate?.toString() || "150000",
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
          amountIn: quote.inputTokens[0]?.amount || request.amountIn,
          amountOut: quote.netOutValue || quote.outputTokens[0]?.amount || "0",
        } as RouteStep,
      ],
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["Odos"],
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
    // Odos often finds competitive prices, especially for complex routes
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
      // Map chain IDs to Odos chain IDs
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

      // First get the quote to get pathId
      const quoteUrl = `${this.baseUrl}/sor/quote/v2`;
      const quoteBody = {
        chainId: chainId,
        inputTokens: [
          {
            tokenAddress: request.fromToken,
            amount: request.amountIn,
          },
        ],
        outputTokens: [
          {
            tokenAddress: request.toToken,
            proportion: 1.0,
          },
        ],
        slippageLimitPercent: request.slippageTolerance || 0.5,
        userAddr: request.recipient,
        ...(this.partnerCode && { referralCode: this.partnerCode }),
      };

      const quoteResponse = await httpRequest<{
        pathId: string;
      }>(quoteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
        },
        body: quoteBody,
        timeout: 8000,
      });

      if (quoteResponse.status !== 200) {
        throw new Error(`Odos quote API returned status ${quoteResponse.status}`);
      }

      const pathId = quoteResponse.data.pathId;

      // Then assemble the transaction
      const assembleUrl = `${this.baseUrl}/sor/assemble`;
      const assembleBody = {
        userAddr: request.recipient,
        pathId: pathId,
        simulate: false,
        ...(this.partnerCode && { referralCode: this.partnerCode }),
      };

      const assembleResponse = await httpRequest<{
        transaction: {
          to: string;
          data: string;
          value: string;
          gas: number;
          gasPrice: string;
        };
      }>(assembleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "X-API-KEY": this.apiKey } : {}),
        },
        body: assembleBody,
        timeout: 8000,
      });

      if (assembleResponse.status !== 200) {
        throw new Error(`Odos assemble API returned status ${assembleResponse.status}`);
      }

      const tx = assembleResponse.data.transaction;

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
      logger.error({ error, routeId }, "Failed to get tx from Odos");
      throw error;
    }
  }
}

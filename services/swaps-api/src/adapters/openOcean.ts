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
 * OpenOcean adapter for same-chain swaps
 * Integrates with OpenOcean API for aggregated liquidity
 * Falls back to mock mode if API key is not provided
 */
export class OpenOceanAdapter extends BaseAdapter {
  name = "openocean";
  private readonly apiKey?: string;
  private readonly baseUrl = "https://open-api.openocean.finance";
  private readonly useMock: boolean;

  constructor() {
    super();
    this.apiKey = getApiKey("OPENOCEAN_API_KEY");
    this.useMock = !this.apiKey;

    if (this.useMock) {
      logger.warn("OpenOcean adapter running in mock mode (OPENOCEAN_API_KEY not set)");
    }
  }

  /**
   * Get available tools/exchanges that OpenOcean can use
   */
  async getAvailableTools(): Promise<Tool[]> {
    if (this.useMock) {
      return [
        "Uniswap V3",
        "Uniswap V2",
        "Curve",
        "Balancer V2",
        "SushiSwap",
        "OpenOcean",
        "KyberSwap",
        "DODO",
      ];
    }

    // OpenOcean aggregates from 200+ DEXs
    return [
      "Uniswap V3",
      "Uniswap V2",
      "Curve",
      "Balancer V2",
      "SushiSwap",
      "OpenOcean",
      "KyberSwap",
      "DODO",
      "Bancor",
      "PancakeSwap",
    ];
  }

  /**
   * Get tools used for a specific route
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    // OpenOcean API doesn't always expose which DEXs were used in the quote
    return ["OpenOcean"];
  }

  async getQuote(request: QuoteRequest): Promise<Route[]> {
    // Only handle same-chain swaps
    if (request.fromChainId !== request.toChainId) {
      return [];
    }

    const startTime = Date.now();

    // Check rate limit (OpenOcean free tier: 2 RPS = 20 req/10sec = 120 req/min)
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

      logger.error({ error, provider: this.name }, "Failed to get quote from OpenOcean");
      return [];
    }
  }

  /**
   * Get quote from real OpenOcean API
   */
  private async getRealQuote(request: QuoteRequest): Promise<Route[]> {
    // Map chain IDs to OpenOcean chain names/IDs
    const chainMap: Record<number, string> = {
      1: "1", // Ethereum
      10: "10", // Optimism
      56: "56", // BSC
      137: "137", // Polygon
      8453: "8453", // Base
      42161: "42161", // Arbitrum
      43114: "43114", // Avalanche
      534352: "534352", // Scroll
      5000: "5000", // Mantle
      81457: "81457", // Blast
      34443: "34443", // Mode
    };

    const chainId = chainMap[request.fromChainId];
    if (!chainId) {
      throw new Error(`Unsupported chain: ${request.fromChainId}`);
    }

    // Get fee recipient for referral fees
    const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
    const feeBps = getPlatformFeeBps();

    // OpenOcean quote endpoint (V4 API)
    const url = `${this.baseUrl}/v4/${chainId}/quote`;
    const params = new URLSearchParams({
      inTokenAddress: request.fromToken,
      outTokenAddress: request.toToken,
      amountDecimals: request.amountIn,
      gasPrice: "20000000000", // 20 gwei default
      ...(feeRecipient && {
        referrer: feeRecipient,
        referrerFee: (feeBps / 100).toFixed(2), // OpenOcean expects percentage (0.1 for 10 BPS)
      }),
    });

    const response = await httpRequest<{
      code: number;
      data: {
        inToken: { address: string; symbol: string; decimals: number };
        outToken: { address: string; symbol: string; decimals: number };
        inAmount: string;
        outAmount: string;
        estimatedGas: number;
        gasPrice: string;
        priceImpact: number; // Percentage (e.g., 0.1 for 0.1%)
        routes?: Array<{
          name: string;
          part: number;
        }>;
      };
    }>(`${url}?${params.toString()}`, {
      method: "GET",
      headers: this.apiKey ? { "X-API-KEY": this.apiKey } : {},
      timeout: 8000,
    });

    if (response.status !== 200 || response.data.code !== 200) {
      throw new Error(`OpenOcean API returned status ${response.status} or code ${response.data.code}`);
    }

    const quote = response.data.data;

    // Extract tools used from routes
    const toolsUsed: Tool[] = [];
    if (quote.routes) {
      quote.routes.forEach((route) => {
        if (route.name && !toolsUsed.includes(route.name)) {
          toolsUsed.push(route.name);
        }
      });
    }

    // Calculate price impact in basis points
    const priceImpactBps = quote.priceImpact
      ? Math.round(quote.priceImpact * 100) // Convert percentage to basis points
      : undefined;

    // Calculate fees
    // OpenOcean includes referrer fee in the quote, so outAmount already accounts for it
    // We calculate our platform fee separately
    const platformFeeBps = getPlatformFeeBps();
    const outAmount = parseFloat(quote.outAmount);
    const platformFee = (outAmount * platformFeeBps) / 10000;

    // Total fees = platform fee (DEX fees are already in the price difference)
    const fees = platformFee;

    const route: Omit<Route, "routeId"> = {
      provider: this.name,
      type: "swap",
      fromChainId: request.fromChainId,
      toChainId: request.toChainId,
      fromToken: request.fromToken,
      toToken: request.toToken,
      amountIn: quote.inAmount,
      amountOut: quote.outAmount, // Already net of referrer fee
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
          amountIn: quote.inAmount,
          amountOut: quote.outAmount,
        } as RouteStep,
      ],
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : ["OpenOcean"],
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
    // OpenOcean often finds competitive prices, especially on newer chains
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
      // Map chain IDs to OpenOcean chain IDs
      const chainMap: Record<number, string> = {
        1: "1",
        10: "10",
        56: "56",
        137: "137",
        8453: "8453",
        42161: "42161",
        43114: "43114",
        534352: "534352",
        5000: "5000",
        81457: "81457",
        34443: "34443",
      };

      const chainId = chainMap[request.fromChainId];
      if (!chainId) {
        throw new Error(`Unsupported chain: ${request.fromChainId}`);
      }

      // Get fee recipient for referral fees
      const feeRecipient = getFeeRecipientWithFallback(request.fromChainId);
      const feeBps = getPlatformFeeBps();

      // OpenOcean swap endpoint (V4 API)
      const url = `${this.baseUrl}/v4/${chainId}/swap`;
      const params = new URLSearchParams({
        inTokenAddress: request.fromToken,
        outTokenAddress: request.toToken,
        amountDecimals: request.amountIn,
        gasPrice: "20000000000",
        slippage: ((request.slippageTolerance || 0.5) / 100).toString(), // Convert to decimal
        account: request.recipient,
        ...(feeRecipient && {
          referrer: feeRecipient,
          referrerFee: (feeBps / 100).toFixed(2),
        }),
      });

      const response = await httpRequest<{
        code: number;
        data: {
          to: string;
          data: string;
          value: string;
          gas: number;
          gasPrice: string;
        };
      }>(`${url}?${params.toString()}`, {
        method: "GET",
        headers: this.apiKey ? { "X-API-KEY": this.apiKey } : {},
        timeout: 8000,
      });

      if (response.status !== 200 || response.data.code !== 200) {
        throw new Error(`OpenOcean API returned status ${response.status} or code ${response.data.code}`);
      }

      const swap = response.data.data;

      return {
        routeId,
        txData: swap.data,
        to: swap.to,
        value: swap.value || "0",
        gasLimit: swap.gas?.toString() || "200000",
        gasPrice: swap.gasPrice || "20000000000",
        chainId: request.fromChainId,
      };
    } catch (error) {
      logger.error({ error, routeId }, "Failed to get tx from OpenOcean");
      throw error;
    }
  }
}

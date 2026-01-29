import type {
  Route,
  QuoteRequest,
  ChainId,
  TokenAddress,
} from "@fortuna/shared";
import type {
  PolicyConfig,
  AllowlistConfig,
  DenylistConfig,
  SanctionsHook,
  PolicyResult,
} from "./types.js";

export interface PolicyEngineConfig {
  allowlist?: AllowlistConfig;
  denylist?: DenylistConfig;
  policy?: PolicyConfig;
  sanctionsHook?: SanctionsHook;
  // For price calculation (stub - in production would use price oracle)
  getTokenPriceUsd?: (token: TokenAddress, chainId: ChainId) => Promise<number>;
}

export class PolicyEngine {
  private allowlist?: AllowlistConfig;
  private denylist?: DenylistConfig;
  private policy?: PolicyConfig;
  private sanctionsHook?: SanctionsHook;
  private getTokenPriceUsd?: (token: TokenAddress, chainId: ChainId) => Promise<number>;

  constructor(config: PolicyEngineConfig) {
    this.allowlist = config.allowlist;
    this.denylist = config.denylist;
    this.policy = config.policy;
    this.sanctionsHook = config.sanctionsHook;
    this.getTokenPriceUsd = config.getTokenPriceUsd;
  }

  /**
   * Evaluate a route against all policies
   */
  async evaluateRoute(
    route: Route,
    request: QuoteRequest
  ): Promise<PolicyResult> {
    const warnings: string[] = [];

    // Check allowlist
    if (this.allowlist) {
      if (
        this.allowlist.chains.length > 0 &&
        !this.allowlist.chains.includes(route.fromChainId)
      ) {
        return {
          allowed: false,
          reason: "Chain not supported",
          warnings: [],
        };
      }
      if (
        this.allowlist.chains.length > 0 &&
        !this.allowlist.chains.includes(route.toChainId)
      ) {
        return {
          allowed: false,
          reason: "Chain not supported",
          warnings: [],
        };
      }
      if (
        this.allowlist.tokens.length > 0 &&
        !this.allowlist.tokens.includes(route.fromToken)
      ) {
        return {
          allowed: false,
          reason: "Token not supported",
          warnings: [],
        };
      }
      if (
        this.allowlist.tokens.length > 0 &&
        !this.allowlist.tokens.includes(route.toToken)
      ) {
        return {
          allowed: false,
          reason: "Token not supported",
          warnings: [],
        };
      }
      // Check tool allowlist
      if (this.allowlist.tools && this.allowlist.tools.length > 0) {
        // If route has no toolsUsed, reject if allowlist requires tools
        if (!route.toolsUsed || route.toolsUsed.length === 0) {
          return {
            allowed: false,
            reason: "Route does not specify tools used",
            warnings: [],
          };
        }
        // Check if at least one tool in route is in allowlist
        const hasAllowedTool = route.toolsUsed.some((tool) =>
          this.allowlist!.tools!.includes(tool)
        );
        if (!hasAllowedTool) {
          return {
            allowed: false,
            reason: "Route uses tools not in allowlist",
            warnings: [],
          };
        }
      }
    }

    // Check denylist
    if (this.denylist) {
      if (this.denylist.chains.includes(route.fromChainId)) {
        return {
          allowed: false,
          reason: "Route not available",
          warnings: [],
        };
      }
      if (this.denylist.chains.includes(route.toChainId)) {
        return {
          allowed: false,
          reason: "Route not available",
          warnings: [],
        };
      }
      if (this.denylist.tokens.includes(route.fromToken)) {
        return {
          allowed: false,
          reason: "Route not available",
          warnings: [],
        };
      }
      if (this.denylist.tokens.includes(route.toToken)) {
        return {
          allowed: false,
          reason: "Route not available",
          warnings: [],
        };
      }
      // Check tool denylist
      if (this.denylist.tools && this.denylist.tools.length > 0 && route.toolsUsed) {
        const hasDeniedTool = route.toolsUsed.some((tool) =>
          this.denylist!.tools!.includes(tool)
        );
        if (hasDeniedTool) {
          return {
            allowed: false,
            reason: "Route uses denied tool/exchange",
            warnings: [],
          };
        }
      }
    }

    // Check sanctions
    if (this.sanctionsHook) {
      const fromSanctioned = await this.sanctionsHook.isSanctioned(
        route.fromToken,
        route.fromChainId
      );
      const toSanctioned = await this.sanctionsHook.isSanctioned(
        route.toToken,
        route.toChainId
      );

      if (fromSanctioned || toSanctioned) {
        return {
          allowed: false,
          reason: "Route not available",
          warnings: [],
        };
      }
    }

    // Apply policy rules
    if (this.policy) {
      // Check price impact
      if (this.policy.maxPriceImpactBps !== undefined) {
        const priceImpactBps = route.priceImpactBps;
        if (priceImpactBps === undefined) {
          // Unknown price impact - filter if policy requires it
          if (this.policy.maxPriceImpactBps === 0) {
            return {
              allowed: false,
              reason: "Price impact unknown",
              warnings: [],
            };
          }
          // Otherwise allow but warn
          if (this.policy.routeWarnings?.highPriceImpact) {
            warnings.push("Price impact unknown");
          }
        } else if (priceImpactBps > this.policy.maxPriceImpactBps) {
          return {
            allowed: false,
            reason: "Price impact too high",
            warnings: [],
          };
        } else if (
          priceImpactBps > this.policy.maxPriceImpactBps * 0.8 &&
          this.policy.routeWarnings?.highPriceImpact
        ) {
          warnings.push(`High price impact: ${priceImpactBps / 100}%`);
        }
      }

      // Check slippage
      if (this.policy.maxSlippageBps !== undefined && request.slippageTolerance) {
        const slippageBps = request.slippageTolerance * 100;
        if (slippageBps > this.policy.maxSlippageBps) {
          return {
            allowed: false,
            reason: "Slippage tolerance too high",
            warnings: [],
          };
        }
      }

      // Check minimum amount
      if (this.policy.minAmountUsd !== undefined && this.getTokenPriceUsd) {
        try {
          const tokenPrice = await this.getTokenPriceUsd(
            request.fromToken,
            request.fromChainId
          );
          const amountUsd = parseFloat(request.amountIn) * tokenPrice;
          if (amountUsd < this.policy.minAmountUsd) {
            return {
              allowed: false,
              reason: "Amount below minimum",
              warnings: [],
            };
          }
        } catch (error) {
          // If price lookup fails, allow but warn
          if (this.policy.routeWarnings?.lowLiquidity) {
            warnings.push("Unable to verify minimum amount");
          }
        }
      }

      // Add route-specific warnings
      if (route.type === "bridge" && this.policy.routeWarnings?.crossChain) {
        warnings.push("Cross-chain transactions may take longer");
      }
    }

    return {
      allowed: true,
      warnings,
    };
  }

  /**
   * Apply policies to multiple routes, filtering and annotating them
   */
  async applyPolicies(
    routes: Route[],
    request: QuoteRequest
  ): Promise<{
    allowed: Route[];
    rejected: Array<{ routeId: string; reason: string }>;
  }> {
    const allowed: Route[] = [];
    const rejected: Array<{ routeId: string; reason: string }> = [];

    for (const route of routes) {
      const result = await this.evaluateRoute(route, request);

      if (result.allowed) {
        // Add warnings to route
        const annotatedRoute: Route = {
          ...route,
          warnings: [
            ...(route.warnings || []),
            ...result.warnings,
          ],
        };
        allowed.push(annotatedRoute);
      } else {
        rejected.push({
          routeId: route.routeId,
          reason: result.reason || "Policy violation",
        });
      }
    }

    return { allowed, rejected };
  }
}

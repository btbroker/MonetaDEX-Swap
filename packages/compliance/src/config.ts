import type { PolicyEngineConfig } from "./policy.js";
import { StubSanctionsHook } from "./sanctions.js";
import type { PolicyConfig } from "./types.js";

/**
 * Get policy configuration based on environment
 */
export function getPolicyConfig(env: string = "development"): PolicyEngineConfig {
  const basePolicy: PolicyConfig = {
    maxPriceImpactBps: 500, // 5%
    maxSlippageBps: 100, // 1%
    minAmountUsd: 1, // $1 minimum
    routeWarnings: {
      highPriceImpact: true,
      lowLiquidity: true,
      crossChain: true,
    },
  };

  // Environment-specific overrides
  const envPolicies: Record<string, Partial<PolicyConfig>> = {
    development: {
      ...basePolicy,
      maxPriceImpactBps: 1000, // More lenient in dev
      minAmountUsd: 0.1, // Lower minimum in dev
    },
    staging: {
      ...basePolicy,
      maxPriceImpactBps: 500,
      minAmountUsd: 1,
    },
    production: {
      ...basePolicy,
      maxPriceImpactBps: 300, // Stricter in prod
      maxSlippageBps: 50, // 0.5% max slippage
      minAmountUsd: 10, // Higher minimum in prod
    },
  };

  const policy = envPolicies[env] || basePolicy;

  return {
    policy,
    sanctionsHook: new StubSanctionsHook(),
    // Stub token price function - in production would use price oracle
    getTokenPriceUsd: async () => {
      // Mock: return $1 for all tokens
      // In production, integrate with CoinGecko, CoinMarketCap, or on-chain oracles
      return 1.0;
    },
    // Default allowlist/denylist (empty - can be overridden via query params)
    allowlist: {
      chains: [],
      tokens: [],
      tools: [],
    },
    denylist: {
      chains: [],
      tokens: [],
      tools: [],
    },
  };
}

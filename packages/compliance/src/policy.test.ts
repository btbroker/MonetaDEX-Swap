import { describe, it, expect } from "vitest";
import { PolicyEngine } from "./policy.js";
import { StubSanctionsHook } from "./sanctions.js";
import type { Route, QuoteRequest } from "@fortuna/shared";
import type { PolicyConfig, AllowlistConfig, DenylistConfig } from "./types.js";

describe("PolicyEngine", () => {
  const createMockRoute = (overrides?: Partial<Route>): Route => ({
    routeId: "test-route-1",
    provider: "0x",
    type: "swap",
    fromChainId: 1,
    toChainId: 1,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    amountIn: "1000000",
    amountOut: "997000",
    estimatedGas: "150000",
    fees: "3000",
    priceImpactBps: 10,
    steps: [],
    ...overrides,
  });

  const createMockRequest = (overrides?: Partial<QuoteRequest>): QuoteRequest => ({
    fromChainId: 1,
    toChainId: 1,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    amountIn: "1000000",
    slippageTolerance: 0.5,
    ...overrides,
  });

  describe("allowlist", () => {
    it("should allow routes when chain is in allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [1, 137],
        tokens: [],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should reject routes when chain is not in allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [137], // Only Polygon
        tokens: [],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ fromChainId: 1 }); // Ethereum
      const request = createMockRequest({ fromChainId: 1 });

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Chain not supported");
    });

    it("should allow routes when token is in allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC (fromToken)
          "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT (toToken)
        ],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should reject routes when token is not in allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7"], // Only USDT
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }); // USDC
      const request = createMockRequest({ fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" });

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Token not supported");
    });

    it("should allow all routes when allowlist is empty", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });
  });

  describe("denylist", () => {
    it("should reject routes when chain is in denylist", async () => {
      const denylist: DenylistConfig = {
        chains: [1],
        tokens: [],
      };

      const engine = new PolicyEngine({ denylist });
      const route = createMockRoute({ fromChainId: 1 });
      const request = createMockRequest({ fromChainId: 1 });

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Route not available");
    });

    it("should reject routes when token is in denylist", async () => {
      const denylist: DenylistConfig = {
        chains: [],
        tokens: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
      };

      const engine = new PolicyEngine({ denylist });
      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Route not available");
    });
  });

  describe("price impact", () => {
    it("should allow routes with price impact below threshold", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 500, // 5%
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ priceImpactBps: 100 }); // 1%
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should reject routes with price impact above threshold", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 500, // 5%
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ priceImpactBps: 600 }); // 6%
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Price impact too high");
    });

    it("should reject routes with unknown price impact when policy requires it", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 0, // Require known price impact
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ priceImpactBps: undefined });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Price impact unknown");
    });

    it("should warn on high price impact near threshold", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 500, // 5%
        routeWarnings: {
          highPriceImpact: true,
          lowLiquidity: false,
          crossChain: false,
        },
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ priceImpactBps: 450 }); // 4.5% (80% of threshold)
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain("High price impact: 4.5%");
    });

    it("should warn on unknown price impact when policy allows it", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 500,
        routeWarnings: {
          highPriceImpact: true,
          lowLiquidity: false,
          crossChain: false,
        },
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ priceImpactBps: undefined });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain("Price impact unknown");
    });
  });

  describe("slippage", () => {
    it("should allow routes with slippage below threshold", async () => {
      const policy: PolicyConfig = {
        maxSlippageBps: 100, // 1%
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute();
      const request = createMockRequest({ slippageTolerance: 0.5 }); // 0.5%

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should reject routes with slippage above threshold", async () => {
      const policy: PolicyConfig = {
        maxSlippageBps: 100, // 1%
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute();
      const request = createMockRequest({ slippageTolerance: 2.0 }); // 2%

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Slippage tolerance too high");
    });
  });

  describe("minimum amount", () => {
    it("should allow routes above minimum amount", async () => {
      const policy: PolicyConfig = {
        minAmountUsd: 10,
      };

      // Note: getTokenPriceUsd returns price per smallest unit (wei-like)
      // For USDC (6 decimals), $1 per token = $0.000001 per smallest unit
      // So 10,000,000 smallest units * $0.000001 = $10
      const getTokenPriceUsd = async () => 0.000001; // $1 per token = $0.000001 per smallest unit (6 decimals)

      const engine = new PolicyEngine({
        policy,
        getTokenPriceUsd,
      });

      const route = createMockRoute();
      const request = createMockRequest({ amountIn: "10000000" }); // 10 USDC = $10 worth

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should reject routes below minimum amount", async () => {
      const policy: PolicyConfig = {
        minAmountUsd: 10,
      };

      // Note: getTokenPriceUsd returns price per smallest unit (wei-like)
      // For USDC (6 decimals), $1 per token = $0.000001 per smallest unit
      // So 5,000,000 smallest units * $0.000001 = $5
      const getTokenPriceUsd = async () => 0.000001; // $1 per token = $0.000001 per smallest unit (6 decimals)

      const engine = new PolicyEngine({
        policy,
        getTokenPriceUsd,
      });

      const route = createMockRoute();
      const request = createMockRequest({ amountIn: "5000000" }); // 5 USDC = $5 worth

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Amount below minimum");
    });

    it("should warn when price lookup fails", async () => {
      const policy: PolicyConfig = {
        minAmountUsd: 10,
        routeWarnings: {
          highPriceImpact: false,
          lowLiquidity: true,
          crossChain: false,
        },
      };

      const getTokenPriceUsd = async () => {
        throw new Error("Price lookup failed");
      };

      const engine = new PolicyEngine({
        policy,
        getTokenPriceUsd,
      });

      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain("Unable to verify minimum amount");
    });
  });

  describe("route warnings", () => {
    it("should add cross-chain warning when enabled", async () => {
      const policy: PolicyConfig = {
        routeWarnings: {
          highPriceImpact: false,
          lowLiquidity: false,
          crossChain: true,
        },
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ type: "bridge" });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain("Cross-chain transactions may take longer");
    });

    it("should not add cross-chain warning when disabled", async () => {
      const policy: PolicyConfig = {
        routeWarnings: {
          highPriceImpact: false,
          lowLiquidity: false,
          crossChain: false,
        },
      };

      const engine = new PolicyEngine({ policy });
      const route = createMockRoute({ type: "bridge" });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
      expect(result.warnings).not.toContain("Cross-chain transactions may take longer");
    });
  });

  describe("sanctions", () => {
    it("should reject sanctioned tokens", async () => {
      const sanctionsHook = {
        async isSanctioned() {
          return true; // Sanctioned
        },
      };

      const engine = new PolicyEngine({ sanctionsHook });
      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Route not available");
    });

    it("should allow non-sanctioned tokens", async () => {
      const sanctionsHook = new StubSanctionsHook();

      const engine = new PolicyEngine({ sanctionsHook });
      const route = createMockRoute();
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });
  });

  describe("applyPolicies", () => {
    it("should filter and annotate multiple routes", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 500,
      };

      const engine = new PolicyEngine({ policy });

      const routes: Route[] = [
        createMockRoute({ routeId: "route-1", priceImpactBps: 100 }), // Allowed
        createMockRoute({ routeId: "route-2", priceImpactBps: 600 }), // Rejected
        createMockRoute({ routeId: "route-3", priceImpactBps: 200 }), // Allowed
      ];

      const request = createMockRequest();

      const result = await engine.applyPolicies(routes, request);

      expect(result.allowed).toHaveLength(2);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].routeId).toBe("route-2");
      expect(result.rejected[0].reason).toBe("Price impact too high");
    });

    it("should preserve existing warnings and add new ones", async () => {
      const policy: PolicyConfig = {
        maxPriceImpactBps: 500,
        routeWarnings: {
          highPriceImpact: true,
          lowLiquidity: false,
          crossChain: true,
        },
      };

      const engine = new PolicyEngine({ policy });

      const route = createMockRoute({
        type: "bridge",
        priceImpactBps: 450,
        warnings: ["Existing warning"],
      });

      const request = createMockRequest();

      const result = await engine.applyPolicies([route], request);

      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].warnings).toContain("Existing warning");
      expect(result.allowed[0].warnings).toContain("High price impact: 4.5%");
      expect(result.allowed[0].warnings).toContain("Cross-chain transactions may take longer");
    });
  });
});

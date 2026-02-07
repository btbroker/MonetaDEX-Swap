import { describe, it, expect } from "vitest";
import { PolicyEngine } from "./policy.js";
import type { Route, QuoteRequest } from "@fortuna/shared";
import type { AllowlistConfig, DenylistConfig } from "./types.js";

describe("PolicyEngine - Tool Filtering", () => {
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
    toolsUsed: ["Uniswap V3", "Curve"],
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

  describe("tool allowlist", () => {
    it("should allow routes when tool is in allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
        tools: ["Uniswap V3", "Curve"],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should reject routes when no tools match allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
        tools: ["SushiSwap", "Balancer"],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3", "Curve"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Route uses tools not in allowlist");
    });

    it("should reject routes without toolsUsed when allowlist requires tools", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
        tools: ["Uniswap V3"],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ toolsUsed: undefined });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Route does not specify tools used");
    });

    it("should allow all routes when tool allowlist is empty", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
        tools: [],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should allow routes when tool allowlist is undefined", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
      };

      const engine = new PolicyEngine({ allowlist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });
  });

  describe("tool denylist", () => {
    it("should reject routes when tool is in denylist", async () => {
      const denylist: DenylistConfig = {
        chains: [],
        tokens: [],
        tools: ["Uniswap V3"],
      };

      const engine = new PolicyEngine({ denylist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3", "Curve"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Route uses denied tool/exchange");
    });

    it("should allow routes when no tools are in denylist", async () => {
      const denylist: DenylistConfig = {
        chains: [],
        tokens: [],
        tools: ["SushiSwap"],
      };

      const engine = new PolicyEngine({ denylist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3", "Curve"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });

    it("should allow routes without toolsUsed when denylist is set", async () => {
      const denylist: DenylistConfig = {
        chains: [],
        tokens: [],
        tools: ["Uniswap V3"],
      };

      const engine = new PolicyEngine({ denylist });
      const route = createMockRoute({ toolsUsed: undefined });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      // Routes without toolsUsed are allowed if denylist is set
      // (denylist only filters routes that explicitly use denied tools)
      expect(result.allowed).toBe(true);
    });

    it("should allow all routes when tool denylist is empty", async () => {
      const denylist: DenylistConfig = {
        chains: [],
        tokens: [],
        tools: [],
      };

      const engine = new PolicyEngine({ denylist });
      const route = createMockRoute({ toolsUsed: ["Uniswap V3"] });
      const request = createMockRequest();

      const result = await engine.evaluateRoute(route, request);

      expect(result.allowed).toBe(true);
    });
  });

  describe("tool filtering with applyPolicies", () => {
    it("should filter routes by tool allowlist", async () => {
      const allowlist: AllowlistConfig = {
        chains: [],
        tokens: [],
        tools: ["Uniswap V3"],
      };

      const engine = new PolicyEngine({ allowlist });
      const routes = [
        createMockRoute({ routeId: "route-1", toolsUsed: ["Uniswap V3"] }),
        createMockRoute({ routeId: "route-2", toolsUsed: ["SushiSwap"] }),
        createMockRoute({ routeId: "route-3", toolsUsed: ["Curve"] }),
      ];
      const request = createMockRequest();

      const { allowed, rejected } = await engine.applyPolicies(routes, request);

      expect(allowed).toHaveLength(1);
      expect(allowed[0].routeId).toBe("route-1");
      expect(rejected).toHaveLength(2);
    });

    it("should filter routes by tool denylist", async () => {
      const denylist: DenylistConfig = {
        chains: [],
        tokens: [],
        tools: ["SushiSwap"],
      };

      const engine = new PolicyEngine({ denylist });
      const routes = [
        createMockRoute({ routeId: "route-1", toolsUsed: ["Uniswap V3"] }),
        createMockRoute({ routeId: "route-2", toolsUsed: ["SushiSwap"] }),
        createMockRoute({ routeId: "route-3", toolsUsed: ["Curve"] }),
      ];
      const request = createMockRequest();

      const { allowed, rejected } = await engine.applyPolicies(routes, request);

      expect(allowed).toHaveLength(2);
      expect(allowed.map((r) => r.routeId)).toContain("route-1");
      expect(allowed.map((r) => r.routeId)).toContain("route-3");
      expect(rejected).toHaveLength(1);
      expect(rejected[0].routeId).toBe("route-2");
    });
  });
});

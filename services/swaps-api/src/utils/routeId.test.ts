import { describe, it, expect } from "vitest";
import { generateRouteId } from "./routeId.js";
import type { Route } from "@fortuna/shared";

describe("generateRouteId", () => {
  it("should generate stable routeId for same route data", () => {
    const route: Omit<Route, "routeId"> = {
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
      steps: [],
    };

    const routeId1 = generateRouteId(route);
    const routeId2 = generateRouteId(route);

    expect(routeId1).toBe(routeId2);
    expect(routeId1).toHaveLength(16);
  });

  it("should generate different routeId for different routes", () => {
    const route1: Omit<Route, "routeId"> = {
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
      steps: [],
    };

    const route2: Omit<Route, "routeId"> = {
      ...route1,
      amountIn: "2000000", // Different amount
    };

    const routeId1 = generateRouteId(route1);
    const routeId2 = generateRouteId(route2);

    expect(routeId1).not.toBe(routeId2);
  });
});

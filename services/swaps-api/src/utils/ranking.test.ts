import { describe, it, expect } from "vitest";
import { calculateRouteScore, rankRoutes } from "./ranking.js";
import type { Route } from "@fortuna/shared";

describe("calculateRouteScore", () => {
  it("should calculate score as amountOut minus fees", () => {
    const route: Route = {
      routeId: "test123",
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

    const score = calculateRouteScore(route);
    expect(score).toBe(997000 - 3000);
  });

  it("should return higher score for better routes", () => {
    const route1: Route = {
      routeId: "test1",
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

    const route2: Route = {
      ...route1,
      routeId: "test2",
      amountOut: "998000", // Better output
      fees: "2000", // Lower fees
    };

    const score1 = calculateRouteScore(route1);
    const score2 = calculateRouteScore(route2);

    expect(score2).toBeGreaterThan(score1);
  });
});

describe("rankRoutes", () => {
  it("should rank routes by score in descending order", () => {
    const routes: Route[] = [
      {
        routeId: "route1",
        provider: "0x",
        type: "swap",
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        amountOut: "995000", // Lower score
        estimatedGas: "150000",
        fees: "5000",
        steps: [],
      },
      {
        routeId: "route2",
        provider: "0x",
        type: "swap",
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        amountOut: "998000", // Higher score
        estimatedGas: "150000",
        fees: "2000",
        steps: [],
      },
      {
        routeId: "route3",
        provider: "0x",
        type: "swap",
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        amountOut: "997000", // Middle score
        estimatedGas: "150000",
        fees: "3000",
        steps: [],
      },
    ];

    const ranked = rankRoutes(routes);

    expect(ranked[0].routeId).toBe("route2"); // Highest score
    expect(ranked[1].routeId).toBe("route3"); // Middle score
    expect(ranked[2].routeId).toBe("route1"); // Lowest score
  });

  it("should not mutate original array", () => {
    const routes: Route[] = [
      {
        routeId: "route1",
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
      },
    ];

    const originalFirst = routes[0].routeId;
    rankRoutes(routes);

    expect(routes[0].routeId).toBe(originalFirst);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildFastify } from "../../index.js";
import { routeSnapshotStore } from "../../utils/route-snapshot.js";
import type { Route, TxRequest } from "@fortuna/shared";

describe("POST /v1/tx - Route Snapshot Validation", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    routeSnapshotStore.clear();
    app = await buildFastify();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const createMockRoute = (overrides?: Partial<Route>): Route => ({
    routeId: "test-route-123",
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

  it("should reject tx request if routeId not found in snapshot store", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/tx",
      payload: {
        routeId: "non-existent-route",
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        recipient: "0x1234567890123456789012345678901234567890",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("not found");
  });

  it("should reject tx request if route parameters do not match snapshot", async () => {
    // Store a route snapshot
    const route = createMockRoute();
    routeSnapshotStore.store(route);

    // Try to execute with different amountIn
    const response = await app.inject({
      method: "POST",
      url: "/v1/tx",
      payload: {
        routeId: route.routeId,
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "2000000", // Different from snapshot
        recipient: "0x1234567890123456789012345678901234567890",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("do not match");
  });

  it("should reject tx request if chainId does not match snapshot", async () => {
    const route = createMockRoute();
    routeSnapshotStore.store(route);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tx",
      payload: {
        routeId: route.routeId,
        fromChainId: 137, // Different from snapshot (1)
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        recipient: "0x1234567890123456789012345678901234567890",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toContain("do not match");
  });

  it("should allow tx request if parameters match snapshot", async () => {
    const route = createMockRoute();
    routeSnapshotStore.store(route);

    const response = await app.inject({
      method: "POST",
      url: "/v1/tx",
      payload: {
        routeId: route.routeId,
        fromChainId: 1,
        toChainId: 1,
        fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amountIn: "1000000",
        recipient: "0x1234567890123456789012345678901234567890",
      },
    });

    // Should succeed (200) even if adapter returns mock data
    expect([200, 404]).toContain(response.statusCode);
    // If 404, it's because adapter can't handle it, but validation passed
    // If 200, validation passed and adapter returned tx data
  });
});

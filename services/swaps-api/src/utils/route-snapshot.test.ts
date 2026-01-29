import { describe, it, expect, beforeEach } from "vitest";
import { routeSnapshotStore, RouteSnapshotStore } from "./route-snapshot.js";
import type { Route, TxRequest } from "@fortuna/shared";

describe("RouteSnapshotStore", () => {
  beforeEach(() => {
    routeSnapshotStore.clear();
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

  const createMockTxRequest = (overrides?: Partial<TxRequest>): TxRequest => ({
    routeId: "test-route-123",
    fromChainId: 1,
    toChainId: 1,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    amountIn: "1000000",
    recipient: "0x1234567890123456789012345678901234567890",
    slippageTolerance: 0.5,
    ...overrides,
  });

  describe("store", () => {
    it("should store a route snapshot", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const snapshot = routeSnapshotStore.get(route.routeId);
      expect(snapshot).toBeDefined();
      expect(snapshot?.routeId).toBe(route.routeId);
      expect(snapshot?.fromChainId).toBe(route.fromChainId);
      expect(snapshot?.amountIn).toBe(route.amountIn);
    });

    it("should overwrite existing snapshot with same routeId", () => {
      const route1 = createMockRoute({ amountIn: "1000000" });
      const route2 = createMockRoute({ amountIn: "2000000" });

      routeSnapshotStore.store(route1);
      routeSnapshotStore.store(route2);

      const snapshot = routeSnapshotStore.get(route1.routeId);
      expect(snapshot?.amountIn).toBe("2000000");
    });
  });

  describe("validate", () => {
    it("should validate a matching tx request", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest();
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(true);
      expect(validation.snapshot).toBeDefined();
      expect(validation.reason).toBeUndefined();
    });

    it("should reject if routeId not found", () => {
      const txRequest = createMockTxRequest({ routeId: "non-existent" });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("not found");
    });

    it("should reject if fromChainId does not match", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({ fromChainId: 137 });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("do not match");
    });

    it("should reject if toChainId does not match", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({ toChainId: 137 });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("do not match");
    });

    it("should reject if fromToken does not match", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({
        fromToken: "0x1111111111111111111111111111111111111111",
      });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("do not match");
    });

    it("should reject if toToken does not match", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({
        toToken: "0x1111111111111111111111111111111111111111",
      });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("do not match");
    });

    it("should reject if amountIn does not match", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({ amountIn: "2000000" });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain("do not match");
    });

    it("should allow different recipient (user can change recipient)", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({
        recipient: "0x9999999999999999999999999999999999999999",
      });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(true);
    });

    it("should allow different slippageTolerance (user can change slippage)", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const txRequest = createMockTxRequest({ slippageTolerance: 1.0 });
      const validation = routeSnapshotStore.validate(txRequest);

      expect(validation.valid).toBe(true);
    });
  });

  describe("clearExpired", () => {
    it("should clear expired snapshots", async () => {
      const { RouteSnapshotStore } = await import("./route-snapshot.js");
      const store = new RouteSnapshotStore();
      // Override TTL to 1ms for testing
      (store as any).TTL_MS = 1;

      const route = createMockRoute();
      store.store(route);

      // Wait for expiration
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleared = store.clearExpired();
          expect(cleared).toBe(1);
          expect(store.get(route.routeId)).toBeUndefined();
          resolve();
        }, 10);
      });
    });

    it("should not clear non-expired snapshots", () => {
      const route = createMockRoute();
      routeSnapshotStore.store(route);

      const cleared = routeSnapshotStore.clearExpired();
      expect(cleared).toBe(0);
      expect(routeSnapshotStore.get(route.routeId)).toBeDefined();
    });
  });

  describe("size", () => {
    it("should return correct snapshot count", () => {
      expect(routeSnapshotStore.size()).toBe(0);

      routeSnapshotStore.store(createMockRoute({ routeId: "route-1" }));
      expect(routeSnapshotStore.size()).toBe(1);

      routeSnapshotStore.store(createMockRoute({ routeId: "route-2" }));
      expect(routeSnapshotStore.size()).toBe(2);

      routeSnapshotStore.clear();
      expect(routeSnapshotStore.size()).toBe(0);
    });
  });
});

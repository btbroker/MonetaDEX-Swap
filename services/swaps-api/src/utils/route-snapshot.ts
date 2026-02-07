import type { Route, TxRequest } from "@fortuna/shared";

/**
 * Route snapshot data stored when a quote is generated
 */
export interface RouteSnapshot {
  routeId: string;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  provider: string;
  type: "swap" | "bridge";
  // Timestamp for expiration (optional TTL in production)
  createdAt: number;
}

/**
 * In-memory route snapshot storage
 * In production, this could be replaced with Redis for distributed systems
 */
export class RouteSnapshotStore {
  private snapshots: Map<string, RouteSnapshot> = new Map();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL

  /**
   * Store a route snapshot
   */
  store(route: Route): void {
    const routeWithWei = route as Route & { amountInWei?: string; amountOutWei?: string };
    const amountInWei = routeWithWei.amountInWei ?? route.amountIn;
    const amountOutWei = routeWithWei.amountOutWei ?? route.amountOut;
    const snapshot: RouteSnapshot = {
      routeId: route.routeId,
      fromChainId: route.fromChainId,
      toChainId: route.toChainId,
      fromToken: route.fromToken,
      toToken: route.toToken,
      amountIn: amountInWei,
      amountOut: amountOutWei,
      provider: route.provider,
      type: route.type,
      createdAt: Date.now(),
    };

    this.snapshots.set(route.routeId, snapshot);
  }

  /**
   * Retrieve and validate a route snapshot
   * Returns the snapshot if it exists and matches the request parameters
   */
  validate(txRequest: TxRequest): { valid: boolean; snapshot?: RouteSnapshot; reason?: string } {
    const snapshot = this.snapshots.get(txRequest.routeId);

    if (!snapshot) {
      return {
        valid: false,
        reason: "Route snapshot not found. Route may have expired or was never created.",
      };
    }

    // Check if snapshot has expired
    const age = Date.now() - snapshot.createdAt;
    if (age > this.TTL_MS) {
      this.snapshots.delete(txRequest.routeId);
      return {
        valid: false,
        reason: "Route snapshot has expired. Please request a new quote.",
      };
    }

    // Validate that request parameters match the snapshot
    // Note: recipient and slippageTolerance are allowed to differ (user can change recipient)
    if (
      snapshot.fromChainId !== txRequest.fromChainId ||
      snapshot.toChainId !== txRequest.toChainId ||
      snapshot.fromToken !== txRequest.fromToken ||
      snapshot.toToken !== txRequest.toToken ||
      snapshot.amountIn !== txRequest.amountIn
    ) {
      return {
        valid: false,
        reason: "Route parameters do not match the quoted route. Route may have been modified.",
      };
    }

    return {
      valid: true,
      snapshot,
    };
  }

  /**
   * Get a snapshot without validation (for testing/debugging)
   */
  get(routeId: string): RouteSnapshot | undefined {
    return this.snapshots.get(routeId);
  }

  /**
   * Clear expired snapshots (cleanup method)
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [routeId, snapshot] of this.snapshots.entries()) {
      if (now - snapshot.createdAt > this.TTL_MS) {
        this.snapshots.delete(routeId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear all snapshots (for testing)
   */
  clear(): void {
    this.snapshots.clear();
  }

  /**
   * Get snapshot count (for monitoring)
   */
  size(): number {
    return this.snapshots.size;
  }
}

// Singleton instance
export const routeSnapshotStore = new RouteSnapshotStore();

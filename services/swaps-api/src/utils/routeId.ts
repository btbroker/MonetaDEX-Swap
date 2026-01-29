import { createHash } from "crypto";
import type { Route } from "@fortuna/shared";

/**
 * Generate a stable routeId from route data
 * Uses hash of provider + key transaction fields
 */
export function generateRouteId(route: Omit<Route, "routeId">): string {
  const data = [
    route.provider,
    route.type,
    route.fromChainId.toString(),
    route.toChainId.toString(),
    route.fromToken,
    route.toToken,
    route.amountIn,
    route.amountOut,
  ].join("|");

  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

import type { Route } from "@fortuna/shared";

type RouteWithWei = Route & { amountOutWei?: string };

/**
 * Compare two routes by amountOut in base units (wei). Uses amountOutWei when present for exact BigInt comparison.
 */
function compareAmountOutWei(a: RouteWithWei, b: RouteWithWei): number {
  const weiA = a.amountOutWei ?? a.amountOut;
  const weiB = b.amountOutWei ?? b.amountOut;
  try {
    const bigA = BigInt(weiA);
    const bigB = BigInt(weiB);
    if (bigA > bigB) return -1;
    if (bigA < bigB) return 1;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Calculate route score for tie-breaking (amountOut - fees when not using wei)
 */
export function calculateRouteScore(route: Route): number {
  const amountOut = parseFloat(route.amountOut);
  const fees = parseFloat(route.fees);
  return amountOut - fees;
}

/**
 * Rank routes by amountOutWei (BigInt, descending) when present, else by score. Deterministic tie-break by routeId then provider.
 */
export function rankRoutes(routes: Route[]): Route[] {
  return [...routes].sort((a, b) => {
    const aWithWei = a as RouteWithWei;
    const bWithWei = b as RouteWithWei;
    const weiCmp = compareAmountOutWei(aWithWei, bWithWei);
    if (weiCmp !== 0) return weiCmp;

    const scoreA = calculateRouteScore(a);
    const scoreB = calculateRouteScore(b);
    if (scoreB !== scoreA) return scoreB - scoreA;

    if (a.routeId < b.routeId) return -1;
    if (a.routeId > b.routeId) return 1;
    return a.provider.localeCompare(b.provider);
  });
}

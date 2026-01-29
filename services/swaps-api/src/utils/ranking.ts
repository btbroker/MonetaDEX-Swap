import type { Route } from "@fortuna/shared";

/**
 * Calculate route score for ranking
 * Higher score = better route
 * Score = amountOut - fees - estimatedGas (normalized)
 */
export function calculateRouteScore(route: Route): number {
  const amountOut = parseFloat(route.amountOut);
  const fees = parseFloat(route.fees);
  const estimatedGas = parseFloat(route.estimatedGas);

  // Simple scoring: amountOut minus fees
  // Gas is considered separately as it's paid in native token
  return amountOut - fees;
}

/**
 * Rank routes by score (highest first)
 * Uses deterministic tie-breaking for consistent ordering
 */
export function rankRoutes(routes: Route[]): Route[] {
  return [...routes].sort((a, b) => {
    const scoreA = calculateRouteScore(a);
    const scoreB = calculateRouteScore(b);

    // Primary sort: by score (descending)
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Tie-breaking: use routeId for deterministic ordering
    // This ensures same routes always rank in the same order
    if (a.routeId < b.routeId) {
      return -1;
    }
    if (a.routeId > b.routeId) {
      return 1;
    }

    // If routeIds are identical (shouldn't happen), use provider as final tie-breaker
    return a.provider.localeCompare(b.provider);
  });
}

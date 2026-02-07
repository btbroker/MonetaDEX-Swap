import { formatUnits } from "viem";
import type { QuoteRequest } from "@fortuna/shared";

/**
 * Convert human-readable amount to base units (wei) as integer string.
 * API and aggregators (0x, LiFi, etc.) expect amountIn in wei.
 * This is the only place human -> wei conversion happens for quote requests.
 */
export function toWei(amountHuman: string, decimals: number): string {
  const s = amountHuman.trim();
  if (!s || s === ".") return "0";
  const [whole = "0", frac = ""] = s.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  const combined = whole + fracPadded;
  return combined.replace(/^0+/, "") || "0";
}

/** True if string is non-empty and digits-only (integer-like base units). */
export function isIntegerLike(s: string): boolean {
  return typeof s === "string" && s.length > 0 && /^[0-9]+$/.test(s);
}

/** Assert amountIn is base-units integer string before sending to API. Throws if not. */
export function assertIsWeiString(amountIn: string): void {
  const s = (amountIn ?? "").trim();
  if (s.length === 0 || !/^[0-9]+$/.test(s)) {
    throw new Error(
      "amountIn must be base units integer string (digits only). Use toWei(amountHuman, fromToken.decimals) before POST /v1/quote."
    );
  }
}

/** Dev-only: warn if amountInWei is not integer-like (catches human amounts slipping through). */
export function warnIfNotIntegerLike(amountInWei: string): void {
  if (typeof process === "undefined" || process.env.NODE_ENV === "production") return;
  if (isIntegerLike(amountInWei)) return;
  console.warn(
    "[amount-utils] amountInWei should be base-units integer string; got non-integer-like value. API will reject. Fix: use buildQuoteRequest with amountHuman.",
    amountInWei
  );
}

export type BuildQuoteRequestParams = {
  amountHuman: string;
  fromTokenDecimals: number;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  slippageTolerance?: number;
};

/**
 * Single entry point for building a quote request. Ensures amountIn is always wei.
 * Never pass human amount to API; always use this or UI will send wrong units.
 */
export function buildQuoteRequest(params: BuildQuoteRequestParams): QuoteRequest {
  const { amountHuman, fromTokenDecimals, ...rest } = params;
  const amountInWei = toWei(amountHuman, fromTokenDecimals);
  warnIfNotIntegerLike(amountInWei);
  return {
    ...rest,
    amountIn: amountInWei,
    slippageTolerance: rest.slippageTolerance ?? 0.5,
  };
}

/**
 * Format amountOutWei (base units) to human string using decimals.
 * Use this for "You receive" so BRLA (18 decimals) and USDT (6 decimals) display correctly.
 */
export function formatAmountOutWeiToHuman(amountOutWei: string, toDecimals: number): string {
  return formatUnits(BigInt(amountOutWei), toDecimals);
}

export type RouteAmountOut = {
  amountOutWei?: string;
  toDecimals?: number;
  amountOut: string;
  amountOutHuman?: string;
  steps?: Array<{ amountOutHuman?: string; amountOutWei?: string; toDecimals?: number }>;
};

export type NormalizeBranch = "A" | "B" | "C" | "D";

/**
 * Normalize route output amount for display. Uses top-level fields first, then last step as fallback.
 * Priority: A) route.amountOutHuman, B) route.amountOutWei+toDecimals, C) lastStep.amountOutHuman,
 * D) lastStep.amountOutWei + (route.toDecimals or lastStep.toDecimals).
 * Returns { display, branch } or { display: null, branch: null }.
 */
export function normalizeRouteAmountOut(route: RouteAmountOut): {
  display: string | null;
  branch: NormalizeBranch | null;
} {
  if (route.amountOutHuman != null && route.amountOutHuman !== "") {
    return { display: route.amountOutHuman, branch: "A" };
  }
  if (
    route.amountOutWei != null &&
    route.amountOutWei !== "" &&
    route.toDecimals != null
  ) {
    return {
      display: formatAmountOutWeiToHuman(route.amountOutWei, route.toDecimals),
      branch: "B",
    };
  }
  const steps = route.steps;
  if (steps && steps.length > 0) {
    const last = steps[steps.length - 1];
    if (last.amountOutHuman != null && last.amountOutHuman !== "") {
      return { display: last.amountOutHuman, branch: "C" };
    }
    const decimals = route.toDecimals ?? last.toDecimals;
    if (
      last.amountOutWei != null &&
      last.amountOutWei !== "" &&
      decimals != null
    ) {
      return {
        display: formatAmountOutWeiToHuman(last.amountOutWei, decimals),
        branch: "D",
      };
    }
  }
  return { display: null, branch: null };
}

/** @deprecated Use normalizeRouteAmountOut. Returns display string or null. */
export function normalizeRoute(route: RouteAmountOut): string | null {
  return normalizeRouteAmountOut(route).display;
}

/** True if route has a displayable output (amountOutHuman or amountOutWei+toDecimals or last step). UI must not display wei. */
export function hasDisplayableAmountOut(route: RouteAmountOut): boolean {
  return normalizeRoute(route) != null;
}

let _lastLogged: { routeId: string; branch: NormalizeBranch } | null = null;

/**
 * Get display string for route output amount. Uses normalizeRouteAmountOut (A/B/C/D priority).
 * Never displays raw wei. When no displayable amount, returns noDisplay: true and "No quote".
 */
export function formatRouteAmountOut(route: RouteAmountOut): {
  display: string;
  isFromWei: boolean;
  noDisplay?: boolean;
} {
  const { display, branch } = normalizeRouteAmountOut(route);
  const routeId = (route as { routeId?: string }).routeId ?? "?";

  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    branch != null
  ) {
    const key = { routeId, branch };
    if (
      _lastLogged == null ||
      _lastLogged.routeId !== key.routeId ||
      _lastLogged.branch !== key.branch
    ) {
      _lastLogged = key;
      console.log(
        "[amount-utils] formatRouteAmountOut",
        { routeId, provider: (route as { provider?: string }).provider, branch }
      );
    }
  }

  if (display != null && display !== "") {
    return { display, isFromWei: true };
  }
  return { display: "No quote", isFromWei: false, noDisplay: true };
}

/** Format step amountOut for display: amountOutHuman (preferred) or formatUnits(amountOutWei, toDecimals). Never use amountOut (deprecated; may be wei). */
export function formatStepAmountOut(
  step: { amountOutHuman?: string; amountOutWei?: string },
  toDecimals: number
): string {
  if (step.amountOutHuman != null && step.amountOutHuman !== "") return step.amountOutHuman;
  if (step.amountOutWei != null && step.amountOutWei !== "") {
    return formatAmountOutWeiToHuman(step.amountOutWei, toDecimals);
  }
  return "—";
}

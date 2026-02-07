"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./use-debounce";
import { apiClient } from "../lib/api-client";
import { assertIsWeiString } from "../lib/amount-utils";
import type { QuoteRequest } from "@fortuna/shared";

/**
 * Stable query key so identical requests don't trigger refetch loops.
 * Same (chainId, tokens, amountIn, slippage) → same key → one fetch; no refetch storm.
 */
function quoteRequestKey(req: QuoteRequest | null): string | null {
  if (!req) return null;
  return [
    req.fromChainId,
    req.toChainId,
    req.fromToken.toLowerCase(),
    req.toToken.toLowerCase(),
    req.amountIn,
    req.slippageTolerance ?? 0.5,
  ].join("|");
}

export function useQuote(request: QuoteRequest | null, enabled: boolean) {
  const debouncedRequest = useDebounce(request, 500);
  const stableKey = useMemo(() => quoteRequestKey(debouncedRequest), [debouncedRequest]);

  const isQuoteDebug =
    typeof window !== "undefined" &&
    (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEBUG_QUOTES === "1");

  return useQuery({
    queryKey: ["quote", stableKey],
    retry: false,
    queryFn: async () => {
      if (!debouncedRequest) {
        throw new Error("Quote request is required");
      }
      assertIsWeiString(debouncedRequest.amountIn);
      if (isQuoteDebug) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        console.log("[DEBUG_QUOTES] request", {
          url: `${baseUrl}/v1/quote`,
          fromChainId: debouncedRequest.fromChainId,
          toChainId: debouncedRequest.toChainId,
          fromToken: debouncedRequest.fromToken,
          toToken: debouncedRequest.toToken,
          amountIn: debouncedRequest.amountIn,
        });
      }
      try {
        const res = await apiClient.getQuote(debouncedRequest);
        if (isQuoteDebug) {
          console.log("[DEBUG_QUOTES] response", {
            routesCount: res.routes?.length ?? 0,
            requestId: res.requestId,
            warning: (res as { warning?: string }).warning,
            firstRoute: res.routes?.[0] ? { provider: res.routes[0].provider, amountOut: res.routes[0].amountOut } : undefined,
          });
        }
        return res;
      } catch (err) {
        if (isQuoteDebug) {
          console.log("[DEBUG_QUOTES] error", { message: err instanceof Error ? err.message : String(err) });
        }
        throw err;
      }
    },
    enabled: enabled && !!debouncedRequest && stableKey !== null,
    staleTime: 1000 * 15,
    gcTime: 1000 * 60,
  });
}

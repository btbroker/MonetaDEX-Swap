"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./use-debounce";
import { apiClient } from "../lib/api-client";
import type { QuoteRequest } from "@fortuna/shared";

export function useQuote(request: QuoteRequest | null, enabled: boolean) {
  const debouncedRequest = useDebounce(request, 500);

  return useQuery({
    queryKey: ["quote", debouncedRequest],
    queryFn: () => {
      if (!debouncedRequest) {
        throw new Error("Quote request is required");
      }
      return apiClient.getQuote(debouncedRequest);
    },
    enabled: enabled && !!debouncedRequest,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60, // 1 minute
  });
}

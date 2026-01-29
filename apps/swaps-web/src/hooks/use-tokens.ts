"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useTokens(chainId: number | undefined) {
  return useQuery({
    queryKey: ["tokens", chainId],
    queryFn: () => {
      if (!chainId) {
        throw new Error("Chain ID is required");
      }
      return apiClient.getTokens(chainId);
    },
    enabled: !!chainId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

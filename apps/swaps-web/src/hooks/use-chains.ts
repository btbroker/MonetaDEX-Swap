"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useChains() {
  return useQuery({
    queryKey: ["chains"],
    queryFn: () => apiClient.getChains(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

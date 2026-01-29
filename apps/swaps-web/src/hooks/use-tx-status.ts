"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";

export function useTxStatus(txHash: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["tx-status", txHash],
    queryFn: () => {
      if (!txHash) {
        throw new Error("Transaction hash is required");
      }
      return apiClient.getStatus(txHash);
    },
    enabled: enabled && !!txHash,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "pending" || data?.status === "unknown") {
        return 3000; // Poll every 3 seconds
      }
      return false; // Stop polling when completed or failed
    },
  });
}

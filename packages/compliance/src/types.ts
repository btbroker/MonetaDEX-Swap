import { z } from "zod";
import type { ChainId, TokenAddress } from "@fortuna/shared";

// Policy Configuration Schema
export const PolicyConfigSchema = z.object({
  maxPriceImpactBps: z.number().int().min(0).max(10000).optional(),
  maxSlippageBps: z.number().int().min(0).max(10000).optional(),
  minAmountUsd: z.number().min(0).optional(),
  routeWarnings: z
    .object({
      highPriceImpact: z.boolean().default(true),
      lowLiquidity: z.boolean().default(true),
      crossChain: z.boolean().default(true),
    })
    .optional(),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

// Allowlists and Denylists
export interface AllowlistConfig {
  chains: ChainId[];
  tokens: TokenAddress[];
  tools?: string[]; // Tool/exchange names (e.g., "Uniswap V3", "Stargate")
}

export interface DenylistConfig {
  chains: ChainId[];
  tokens: TokenAddress[];
  tools?: string[]; // Tool/exchange names (e.g., "Uniswap V3", "Stargate")
}

// Sanctions Hook Interface
export interface SanctionsHook {
  /**
   * Check if an address is sanctioned
   * @param address - Address to check
   * @param chainId - Chain ID for context
   * @returns true if sanctioned, false otherwise
   */
  isSanctioned(address: TokenAddress, chainId: ChainId): Promise<boolean>;
}

// Policy Result
export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
}

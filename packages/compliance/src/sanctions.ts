import type { SanctionsHook } from "./types.js";
import type { TokenAddress, ChainId } from "@fortuna/shared";

/**
 * Stub implementation of sanctions hook
 * In production, this would integrate with TRM, Chainalysis, or similar services
 */
export class StubSanctionsHook implements SanctionsHook {
  async isSanctioned(_address: TokenAddress, _chainId: ChainId): Promise<boolean> {
    // Stub: Always return false (not sanctioned)
    // In production, this would make API calls to sanctions screening services
    return false;
  }
}

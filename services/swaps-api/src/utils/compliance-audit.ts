/**
 * Compliance audit logging for provider usage.
 * Only allowlisted fields are accepted — never log API keys or user/wallet addresses.
 */

import type { FastifyBaseLogger } from "fastify";

/** Safe fields only: no API keys, no wallet or token addresses. */
export interface ProviderQuoteAuditPayload {
  requestId: string;
  provider: string;
  chainId: number;
  timestamp: string;
  routeCount?: number;
  error?: boolean;
}

const AUDIT_MESSAGE = "Compliance: provider quote usage";

/**
 * Log provider usage for a quote. Use this for every provider attempt (success or failure).
 * Ensures audit trail contains only: provider name, chainId, timestamp, requestId, routeCount/error.
 */
export function logProviderQuoteUsage(log: FastifyBaseLogger, payload: ProviderQuoteAuditPayload): void {
  log.info(payload, AUDIT_MESSAGE);
}

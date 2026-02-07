/**
 * Provider capability matrix for compliance.
 * Single source of truth for partners and regulators.
 * Enforce capability checks before using a provider (region, cross-chain, fiat, KYC).
 */

export interface ProviderCapabilities {
  /** Can route cross-chain (fromChainId !== toChainId). */
  supportsCrossChain: boolean;
  /** Supports fiat-backed or regulated stablecoin pairs (e.g. USDC, BRLA). */
  supportsFiatPairs: boolean;
  /** Provider requires KYC/KYB approval for commercial use or certain regions. */
  requiresKYC: boolean;
  /** Regions where the provider is allowed. Use "GLOBAL" for no restriction. */
  supportedRegions: string[];
  /** Human-readable notes for compliance review (e.g. KYB, regional restrictions). */
  complianceNotes: string[];
  /** Can do same-chain swaps (fromChainId === toChainId). All aggregators support this. */
  sameChain: boolean;
  /** Alias for supportsCrossChain for /v1/providers capability flags. */
  crossChain: boolean;
  /** Partner/API mode requires a client-id header (e.g. KyberSwap partner). */
  requiresClientId: boolean;
  /** API requires request signing (e.g. OKX HMAC). Never call without full credentials. */
  requiresSignature: boolean;
}

/** Default capabilities when provider is not in the matrix (permissive for DEX-only adapters). */
const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  supportsCrossChain: false,
  supportsFiatPairs: true,
  requiresKYC: false,
  supportedRegions: ["GLOBAL"],
  complianceNotes: [],
  sameChain: true,
  crossChain: false,
  requiresClientId: false,
  requiresSignature: false,
};

/**
 * Provider capability matrix.
 * Keep this updated as provider terms or regional rules change.
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderCapabilities> = {
  "0x": {
    supportsCrossChain: false,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: [
      "0x API terms apply; check 0x.org for regional restrictions.",
      "To restrict by region: set supportedRegions (e.g. US, EU, BR) and add note e.g. 'Provider X not allowed in region Z'.",
    ],
    sameChain: true,
    crossChain: false,
    requiresClientId: false,
    requiresSignature: false,
  },
  okx: {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: ["OKX DEX Aggregator; commercial use may require partner agreement."],
    sameChain: true,
    crossChain: true,
    requiresClientId: false,
    requiresSignature: true,
  },
  paraswap: {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: ["Paraswap API terms apply; check paraswap.io for compliance."],
    sameChain: true,
    crossChain: true,
    requiresClientId: false,
    requiresSignature: false,
  },
  "1inch": {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: ["1inch API may require approval for high volume or fiat pairs in some regions."],
    sameChain: true,
    crossChain: true,
    requiresClientId: false,
    requiresSignature: false,
  },
  kyberswap: {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: [
      "Public mode (no API key): no fee params, no auth. Partner mode (KYBERSWAP_API_KEY + KYBERSWAP_CLIENT_ID): fee params + auth.",
      "KyberSwap partner fees require wallet validation and approval (see KyberSwap docs).",
    ],
    sameChain: true,
    crossChain: true,
    requiresClientId: true,
    requiresSignature: false,
  },
  openocean: {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: [],
    sameChain: true,
    crossChain: true,
    requiresClientId: false,
    requiresSignature: false,
  },
  odos: {
    supportsCrossChain: false,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: [],
    sameChain: true,
    crossChain: false,
    requiresClientId: false,
    requiresSignature: false,
  },
  lifi: {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: ["LI.FI bridges; ensure bridge providers are allowed in target regions."],
    sameChain: true,
    crossChain: true,
    requiresClientId: false,
    requiresSignature: false,
  },
  bebop: {
    supportsCrossChain: false,
    supportsFiatPairs: true,
    requiresKYC: true,
    supportedRegions: ["GLOBAL"],
    complianceNotes: ["Provider Bebop requires KYB approval for institutional/commercial use."],
    sameChain: true,
    crossChain: false,
    requiresClientId: false,
    requiresSignature: false,
  },
  dodo: {
    supportsCrossChain: false,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: [],
    sameChain: true,
    crossChain: false,
    requiresClientId: false,
    requiresSignature: false,
  },
  sushiswap: {
    supportsCrossChain: true,
    supportsFiatPairs: true,
    requiresKYC: false,
    supportedRegions: ["GLOBAL"],
    complianceNotes: ["SushiSwap Aggregator; check Sushi terms for commercial use."],
    sameChain: true,
    crossChain: true,
    requiresClientId: false,
    requiresSignature: false,
  },
};

/**
 * Get capabilities for a provider. Returns default (permissive) if unknown.
 */
export function getProviderCapabilities(providerName: string): ProviderCapabilities {
  const key = providerName.toLowerCase();
  return PROVIDER_CAPABILITIES[key] ?? { ...DEFAULT_CAPABILITIES };
}

/**
 * Context derived from a quote request (and optional query params) for capability checks.
 */
export interface QuoteRequestContext {
  isCrossChain: boolean;
  region?: string;
  isFiatPair?: boolean;
}

/**
 * Whether the provider is allowed for this request given capability and region rules.
 * Use when region is set (e.g. ?region=BR) to enforce supportedRegions.
 */
export function isProviderAllowedForRequest(
  providerName: string,
  context: QuoteRequestContext
): boolean {
  const cap = getProviderCapabilities(providerName);

  if (context.isCrossChain && !cap.supportsCrossChain) {
    return false;
  }

  if (context.isFiatPair === true && !cap.supportsFiatPairs) {
    return false;
  }

  if (context.region) {
    const regionUpper = context.region.toUpperCase();
    const supported = cap.supportedRegions.map((r) => r.toUpperCase());
    if (!supported.includes("GLOBAL") && !supported.includes(regionUpper)) {
      return false;
    }
  }

  return true;
}

/**
 * All provider names that have an explicit capability entry (for /v1/providers).
 */
export function getProvidersWithCapabilities(): string[] {
  return [...new Set(Object.keys(PROVIDER_CAPABILITIES))];
}

/**
 * Full capability matrix for export to partners/regulators (e.g. GET /v1/providers).
 */
export function getProviderCapabilityMatrix(): Record<
  string,
  ProviderCapabilities & { provider: string; kyberFeeMode?: "public" | "partner" }
> {
  const matrix: Record<string, ProviderCapabilities & { provider: string; kyberFeeMode?: "public" | "partner" }> = {};
  const names = getProvidersWithCapabilities();
  for (const name of names) {
    matrix[name] = { provider: name, ...getProviderCapabilities(name) };
    if (name === "kyberswap") {
      matrix[name].kyberFeeMode = process.env.KYBERSWAP_API_KEY?.trim() ? "partner" : "public";
    }
  }
  return matrix;
}

/**
 * Filter adapters to those allowed for the given request context (cross-chain, region).
 * Use after orderAdaptersForQuote so capability checks do not block other providers.
 */
export function filterAdaptersByCapabilities<T extends { name: string }>(
  adapters: T[],
  context: QuoteRequestContext
): T[] {
  return adapters.filter((a) => isProviderAllowedForRequest(a.name, context));
}

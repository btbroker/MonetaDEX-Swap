import { envPresent } from "../load-env.js";

/**
 * When true, only providers with ENABLE_<PROVIDER>=true are used (whitelist).
 * When false, all providers are used unless ENABLE_<PROVIDER>=false.
 */
export function isComplianceMode(): boolean {
  const v = process.env.COMPLIANCE_MODE;
  return v === "true" || v === "1";
}

/**
 * When true, quote route returns only routes from real aggregator adapters (API-backed).
 * Synthetic / dex-list adapters are excluded; if no real routes exist, returns routes: [] with a warning.
 */
export function isRealQuotesOnly(): boolean {
  const v = process.env.REAL_QUOTES_ONLY;
  return v === "true" || v === "1";
}

/** Names of adapters that are real aggregators (API-backed quotes). All others are treated as SYNTHETIC (dex list / tool list). */
export const REAL_AGGREGATOR_NAMES = new Set([
  "0x",
  "1inch",
  "bebop",
  "dodo",
  "kyberswap",
  "lifi",
  "odos",
  "okx",
  "openocean",
  "paraswap",
  "sushiswap",
]);

/** Providers that MAY attempt unauthenticated requests when API key is missing. When key missing, still attempt; on 401/403 return [] with auth-error. */
export const PUBLIC_ATTEMPT_PROVIDERS = new Set(["paraswap", "openocean", "odos"]);

export function hasPublicAttempt(adapterName: string): boolean {
  return PUBLIC_ATTEMPT_PROVIDERS.has(adapterName.toLowerCase());
}

export function isRealAggregator(adapterName: string): boolean {
  return REAL_AGGREGATOR_NAMES.has(adapterName.toLowerCase());
}

/** Sorted list of real aggregator names (for stable diagnostics order). */
export function getRealAggregatorNames(): string[] {
  return [...REAL_AGGREGATOR_NAMES].sort((a, b) => a.localeCompare(b));
}

/**
 * Environment variable name for per-provider enable flag (e.g. ENABLE_ZEROX).
 * Used for gradual rollout and compliance whitelisting.
 */
export function getEnableEnvVar(adapterName: string): string {
  const special: Record<string, string> = {
    "0x": "ZEROX",
    "1inch": "ONEINCH",
  };
  const n = adapterName.toLowerCase();
  const base = special[n] ?? adapterName.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
  return base ? `ENABLE_${base}` : "ENABLE_UNKNOWN";
}

/**
 * True if this provider is allowed by enable flag and compliance mode.
 * - COMPLIANCE_MODE=false: allowed unless ENABLE_*=false (default allow).
 * - COMPLIANCE_MODE=true: allowed only if ENABLE_*=true (whitelist).
 */
export function isProviderAllowedByFlag(adapterName: string): boolean {
  const envVar = getEnableEnvVar(adapterName);
  const val = process.env[envVar];
  if (isComplianceMode()) {
    return val === "true" || val === "1";
  }
  return val !== "false" && val !== "0";
}

/**
 * Standardized provider configuration for regulated onboarding.
 * - requiredEnvVars: ALL must be present for provider to be "withKeys"; otherwise missingKeys/disabled.
 * - supportedChains: chain IDs the provider supports; empty = not restricted by chain in config.
 * Never log or expose env var values; use envPresent() for presence only.
 */
export interface ProviderConfig {
  name: string;
  /** All required env var names. When all are present, provider is "withKeys". Empty = public (no keys required). */
  requiredEnvVars: string[];
  supportedChains: number[];
}

/** Chain IDs commonly supported by aggregators (for config; adapters may have their own map). */
const COMMON_CHAINS = [1, 10, 56, 137, 8453, 42161, 43114, 534352, 5000, 81457, 34443];

/**
 * Registry of provider configs. withKeys only when ALL requiredEnvVars are present.
 * OKX: API key + secret + passphrase (signing). KyberSwap: CLIENT_ID required header; API key optional.
 */
export const PROVIDER_CONFIGS: ProviderConfig[] = [
  { name: "0x", requiredEnvVars: ["ZEROX_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "lifi", requiredEnvVars: ["LIFI_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "okx", requiredEnvVars: ["OKX_ACCESS_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"], supportedChains: COMMON_CHAINS },
  { name: "kyberswap", requiredEnvVars: [], supportedChains: COMMON_CHAINS },
  { name: "paraswap", requiredEnvVars: ["PARASWAP_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "1inch", requiredEnvVars: ["ONEINCH_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "openocean", requiredEnvVars: ["OPENOCEAN_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "odos", requiredEnvVars: ["ODOS_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "bebop", requiredEnvVars: ["BEBOP_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "dodo", requiredEnvVars: ["DODO_API_KEY"], supportedChains: COMMON_CHAINS },
  { name: "sushiswap", requiredEnvVars: ["SUSHISWAP_API_KEY"], supportedChains: COMMON_CHAINS },
];

const configByName = new Map<string, ProviderConfig>(
  PROVIDER_CONFIGS.map((c) => [c.name.toLowerCase(), c])
);

export function getProviderConfig(adapterName: string): ProviderConfig | undefined {
  return configByName.get(adapterName.toLowerCase());
}

/** True when all required env vars for this provider are present; or provider not in registry (e.g. synthetic DEX). */
export function hasAllRequiredKeys(adapterName: string): boolean {
  const config = getProviderConfig(adapterName);
  if (!config) return true;
  if (config.requiredEnvVars.length === 0) return true;
  return config.requiredEnvVars.every(envPresent);
}

/** True when at least one but not all required env vars are set (partial credentials). Provider must not be called. */
export function hasPartialCredentials(adapterName: string): boolean {
  const config = getProviderConfig(adapterName);
  if (!config || config.requiredEnvVars.length === 0) return false;
  const present = config.requiredEnvVars.filter(envPresent).length;
  return present > 0 && present < config.requiredEnvVars.length;
}

/** True if this adapter is enabled: all required keys present and allowed by enable flag. */
export function isProviderEnabled(adapterName: string): boolean {
  const config = getProviderConfig(adapterName);
  if (!config) return true;
  if (!isProviderAllowedByFlag(adapterName)) return false;
  return hasAllRequiredKeys(adapterName);
}

/** Status for /v1/providers: withKeys when ALL required vars present; disabled (missing-key) when not all present; publicAttempt when key missing but supports public attempt. */
export function getProviderStatus(): {
  withKeys: string[];
  disabled: string[];
  misconfigured: string[];
  public: string[];
  publicAttempt: string[];
  complianceMode: boolean;
  live: string[];
} {
  const withKeys: string[] = [];
  const disabled: string[] = [];
  const misconfigured: string[] = [];
  const publicList: string[] = [];
  const publicAttempt: string[] = [];
  for (const config of PROVIDER_CONFIGS) {
    const n = config.requiredEnvVars.length;
    const presentCount = n > 0 ? config.requiredEnvVars.filter(envPresent).length : 0;
    if (n === 0) {
      publicList.push(config.name);
    } else if (presentCount === n) {
      withKeys.push(config.name);
    } else if (hasPublicAttempt(config.name)) {
      publicAttempt.push(config.name);
    } else {
      disabled.push(config.name);
    }
  }
  const complianceMode = isComplianceMode();
  const live = [...withKeys, ...publicList, ...publicAttempt].filter((name) => isProviderAllowedByFlag(name));
  return { withKeys, disabled, misconfigured, public: publicList, publicAttempt, complianceMode, live };
}

/**
 * Order adapters for quote: enabled only (all required keys present, public, or publicAttempt), with-key first, then publicAttempt, then public.
 * Excluded: disabled (missing-key and no publicAttempt), ENABLE_*=false, or COMPLIANCE_MODE and not whitelisted.
 */
export function orderAdaptersForQuote<T extends { name: string }>(adapters: T[]): T[] {
  const status = getProviderStatus();
  const withKeySet = new Set(status.withKeys.map((n) => n.toLowerCase()));
  const disabledSet = new Set(status.disabled.map((n) => n.toLowerCase()));
  const publicAttemptSet = new Set(status.publicAttempt.map((n) => n.toLowerCase()));

  const withKey: T[] = [];
  const publicAttempt: T[] = [];
  const noKey: T[] = [];
  for (const a of adapters) {
    const nameLower = a.name.toLowerCase();
    if (!isProviderAllowedByFlag(a.name)) continue; // Exclude by enable flag / compliance whitelist
    if (disabledSet.has(nameLower)) continue; // Exclude when missing-key and no publicAttempt
    if (withKeySet.has(nameLower)) withKey.push(a);
    else if (publicAttemptSet.has(nameLower)) publicAttempt.push(a);
    else noKey.push(a);
  }
  return [...withKey, ...publicAttempt, ...noKey];
}

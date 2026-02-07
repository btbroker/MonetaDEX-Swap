import { FastifyInstance } from "fastify";
import { getProviderStatus, isRealAggregator } from "../../config/provider-config.js";
import { getProviderCapabilityMatrix } from "../../config/provider-capabilities.js";
import { isRateLimited } from "../../utils/rate-limiter.js";
import { providerHealthTracker } from "../../utils/provider-health.js";
import { getQuoteAdapterNames } from "./quote.js";

// Compliance: this route must never return API key values, only provider names and status.

export type ProviderHealthStatus = "healthy" | "rate-limited" | "disabled" | "missing-key" | "misconfigured";

export async function providersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/v1/providers",
    {
      schema: {
        description:
          "Provider status: withKeys, disabled, misconfigured, public, complianceMode, live; providerHealth (healthy|missing-key|misconfigured|rate-limited|disabled); providerCapabilities with sameChain, crossChain, requiresClientId, requiresSignature.",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              withKeys: {
                type: "array",
                items: { type: "string" },
                description: "Real aggregator providers that have API key set (used when REAL_QUOTES_ONLY=true)",
              },
              missingKeys: {
                type: "array",
                items: { type: "string" },
                description: "Real aggregator providers that require an API key but do not have one set",
              },
              disabled: { type: "array", items: { type: "string" } },
              misconfigured: {
                type: "array",
                items: { type: "string" },
                description: "Providers with partial credentials (e.g. OKX with only KEY set). Excluded from live quotes.",
              },
              public: { type: "array", items: { type: "string" } },
              publicAttempt: {
                type: "array",
                items: { type: "string" },
                description: "Providers that attempt unauthenticated requests when API key is missing (paraswap, openocean, odos)",
              },
              complianceMode: { type: "boolean" },
              live: { type: "array", items: { type: "string" } },
              providerHealth: {
                type: "object",
                additionalProperties: {
                  type: "string",
                  enum: ["healthy", "rate-limited", "disabled", "missing-key", "misconfigured"],
                },
              },
              providerCapabilities: {
                type: "object",
                description: "Per-provider capabilities and compliance notes for partners/regulators",
                additionalProperties: {
                  type: "object",
                  properties: {
                    provider: { type: "string" },
                    supportsCrossChain: { type: "boolean" },
                    supportsFiatPairs: { type: "boolean" },
                    requiresKYC: { type: "boolean" },
                    supportedRegions: { type: "array", items: { type: "string" } },
                    complianceNotes: { type: "array", items: { type: "string" } },
                    sameChain: { type: "boolean", description: "Can do same-chain swaps" },
                    crossChain: { type: "boolean", description: "Can do cross-chain routes" },
                    requiresClientId: { type: "boolean", description: "Partner mode requires client-id header" },
                    requiresSignature: { type: "boolean", description: "API requires request signing (e.g. HMAC)" },
                  },
                },
              },
              realAdapters: {
                type: "array",
                items: { type: "string" },
                description: "Adapters that are real aggregators (API-backed quotes). When REAL_QUOTES_ONLY=true only these can appear in /v1/quote.",
              },
              syntheticAdapters: {
                type: "array",
                items: { type: "string" },
                description: "Adapters that are dex-list/tool-list (synthetic routes). Never returned when REAL_QUOTES_ONLY=true.",
              },
            },
          },
        },
      },
    },
    async () => {
      const status = getProviderStatus();
      const allNames = [
        ...new Set([
          ...status.withKeys,
          ...status.disabled,
          ...status.misconfigured,
          ...status.public,
          ...status.publicAttempt,
        ]),
      ];
      const providerHealth: Record<string, ProviderHealthStatus> = {};
      for (const name of allNames) {
        if (status.misconfigured.includes(name)) {
          providerHealth[name] = "misconfigured";
        } else if (status.disabled.includes(name)) {
          providerHealth[name] = "missing-key";
        } else if (status.publicAttempt.includes(name)) {
          providerHealth[name] = "missing-key"; // Key missing but will attempt public
        } else if (isRateLimited(name)) {
          providerHealth[name] = "rate-limited";
        } else if (!providerHealthTracker.isHealthy(name)) {
          providerHealth[name] = "disabled";
        } else {
          providerHealth[name] = "healthy";
        }
      }
      const providerCapabilities = getProviderCapabilityMatrix();
      const allAdapters = getQuoteAdapterNames();
      const realAdapters = allAdapters.filter((name) => isRealAggregator(name));
      const syntheticAdapters = allAdapters.filter((name) => !isRealAggregator(name));
      return {
        ...status,
        missingKeys: status.disabled,
        providerHealth,
        providerCapabilities,
        realAdapters,
        syntheticAdapters,
      };
    }
  );
}

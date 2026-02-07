import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";
import { QuoteRequestSchema, QuoteResponseSchema } from "@fortuna/shared";

/** 400 message when amountIn is not base-units (wei) integer string. See docs/CONTRACT_QUOTES.md */
export const AMOUNT_IN_BASE_UNITS_MESSAGE =
  "amountIn must be base units integer string (wei); UI must convert using token decimals";

/** API-level schema: amountIn must be non-empty, digits-only (base units), and > 0. */
export const QuoteRequestSchemaApi = QuoteRequestSchema.refine(
  (data) => {
    const s = (data.amountIn ?? "").trim();
    if (s.length === 0 || !/^[0-9]+$/.test(s)) return false;
    try {
      return BigInt(s) > 0n;
    } catch {
      return false;
    }
  },
  { message: AMOUNT_IN_BASE_UNITS_MESSAGE, path: ["amountIn"] }
);
import { PolicyEngine, getPolicyConfig } from "@fortuna/compliance";
import { ZeroXAdapter } from "../../adapters/zeroX.js";
import { LiFiAdapter } from "../../adapters/lifi.js";
import { OneInchAdapter } from "../../adapters/oneInch.js";
import { ParaswapAdapter } from "../../adapters/paraswap.js";
import { OpenOceanAdapter } from "../../adapters/openOcean.js";
import { OdosAdapter } from "../../adapters/odos.js";
import { KyberSwapAdapter } from "../../adapters/kyberSwap.js";
import { BebopAdapter } from "../../adapters/bebop.js";
import { DodoAdapter } from "../../adapters/dodo.js";
import { SushiSwapAdapter } from "../../adapters/sushiSwap.js";
import { OkxAdapter } from "../../adapters/okx.js";
import { UniswapV3Adapter } from "../../adapters/uniswapV3.js";
import { UniswapV2Adapter } from "../../adapters/uniswapV2.js";
import { CurveAdapter } from "../../adapters/curve.js";
import { PancakeSwapAdapter } from "../../adapters/pancakeSwap.js";
import { BalancerV2Adapter } from "../../adapters/balancerV2.js";
import { TraderJoeAdapter } from "../../adapters/traderJoe.js";
import { VelodromeAdapter } from "../../adapters/velodrome.js";
import { AerodromeAdapter } from "../../adapters/aerodrome.js";
import { CamelotAdapter } from "../../adapters/camelot.js";
import { MaverickAdapter } from "../../adapters/maverick.js";
import { OrcaAdapter } from "../../adapters/orca.js";
import { RaydiumAdapter } from "../../adapters/raydium.js";
import { JupiterDirectAdapter } from "../../adapters/jupiterDirect.js";
import { QuickSwapAdapter } from "../../adapters/quickswap.js";
import { SpookySwapAdapter } from "../../adapters/spookySwap.js";
import { THORChainAdapter } from "../../adapters/thorchain.js";
import { PhoenixAdapter } from "../../adapters/phoenix.js";
import { MeteoraAdapter } from "../../adapters/meteora.js";
import { GMXAdapter } from "../../adapters/gmx.js";
import { DydxAdapter } from "../../adapters/dydx.js";
import { SyncSwapAdapter } from "../../adapters/syncswap.js";
import { VelocoreAdapter } from "../../adapters/velocore.js";
import { BancorAdapter } from "../../adapters/bancor.js";
import { SpiritSwapAdapter } from "../../adapters/spiritSwap.js";
import { getTokensForChain } from "@fortuna/config";
import { orderAdaptersForQuote, isRealQuotesOnly, isRealAggregator, getRealAggregatorNames } from "../../config/provider-config.js";
import { filterAdaptersByCapabilities, type QuoteRequestContext } from "../../config/provider-capabilities.js";
import { rankRoutes } from "../../utils/ranking.js";
import { routeSnapshotStore } from "../../utils/route-snapshot.js";
import { logProviderQuoteUsage } from "../../utils/compliance-audit.js";
import { toolRegistry } from "../../registry/tool-registry.js";
import { getTokenDecimals, toWei, fromWei } from "../../utils/token-decimals.js";
import type { QuoteRequest, Route, RouteStep } from "@fortuna/shared";

const DEBUG_QUOTES = process.env.NODE_ENV !== "production" || process.env.DEBUG_QUOTES === "1";

/**
 * Attach base units, human amounts, decimals, and symbols to routes.
 * - amountInWei / amountOutWei: integer strings (base units).
 * - amountInHuman / amountOutHuman: decimal strings from formatUnits(wei, decimals).
 * - amountIn / amountOut: set to human values (deprecated; use amountInHuman/amountOutHuman).
 */
export function enrichRoutesWithBaseUnits(routes: Route[], request: QuoteRequest): void {
  const fromDecimals = getTokenDecimals(request.fromChainId, request.fromToken);
  const toDecimals = getTokenDecimals(request.toChainId, request.toToken);
  const fromTokens = getTokensForChain(request.fromChainId);
  const toTokens = getTokensForChain(request.toChainId);
  const fromSymbol = fromTokens.find((t) => t.address.toLowerCase() === request.fromToken.toLowerCase())?.symbol;
  const toSymbol = toTokens.find((t) => t.address.toLowerCase() === request.toToken.toLowerCase())?.symbol;

  for (const route of routes) {
    const amountInWei = request.amountIn;
    let amountOutWei: string;
    if (route.amountOutWei != null && route.amountOutWei !== "") {
      amountOutWei = route.amountOutWei;
    } else if (route.steps?.length) {
      const lastStep = route.steps[route.steps.length - 1];
      if (lastStep.amountOutWei != null && lastStep.amountOutWei !== "") {
        amountOutWei = lastStep.amountOutWei;
      } else if (lastStep.amountOutHuman != null && lastStep.amountOutHuman !== "") {
        amountOutWei = toWei(lastStep.amountOutHuman, toDecimals);
      } else {
        amountOutWei = toWei(route.amountOut, toDecimals);
      }
    } else {
      amountOutWei = toWei(route.amountOut, toDecimals);
    }
    const amountInHuman = fromWei(amountInWei, fromDecimals);
    const amountOutHuman = fromWei(amountOutWei, toDecimals);

    const r = route as Route & {
      amountInWei: string;
      amountOutWei: string;
      amountInHuman: string;
      amountOutHuman: string;
      fromDecimals: number;
      toDecimals: number;
      fromSymbol?: string;
      toSymbol?: string;
    };
    r.amountInWei = amountInWei;
    r.amountOutWei = amountOutWei;
    r.amountInHuman = amountInHuman;
    r.amountOutHuman = amountOutHuman;
    r.fromDecimals = fromDecimals;
    r.toDecimals = toDecimals;
    if (fromSymbol) r.fromSymbol = fromSymbol;
    if (toSymbol) r.toSymbol = toSymbol;
    // Deprecated: use amountInHuman/amountOutHuman. Kept as human for backward compat so UI never sees wei here.
    route.amountIn = amountInHuman;
    route.amountOut = amountOutHuman;

    for (const step of route.steps) {
      const s = step as RouteStep & {
        amountInWei?: string;
        amountOutWei?: string;
        amountInHuman?: string;
        amountOutHuman?: string;
      };
      s.amountInWei = toWei(step.amountIn, fromDecimals);
      s.amountOutWei = toWei(step.amountOut, toDecimals);
      s.amountInHuman = fromWei(s.amountInWei, fromDecimals);
      s.amountOutHuman = fromWei(s.amountOutWei, toDecimals);
    }
  }
}

// Query parameters schema for tool filtering and compliance (region for capability checks)
export const QuoteQuerySchema = z.object({
  allowedTools: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
  deniedTools: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
  region: z.string().optional().transform((val) => (val ? val.trim().toUpperCase() : undefined)),
});

/** Per-provider diagnostic when REAL_QUOTES_ONLY and empty routes (dev/DEBUG_QUOTES only). No secrets. */
export type ProviderDiagnostic = {
  provider: string;
  attempted: boolean;
  status: "ok" | "no-route" | "auth-error" | "rate-limited" | "unsupported" | "request-error" | "network-error" | "missing-key";
  httpStatus?: number;
  errorCode?: string;
  safeMessage?: string;
};

const MAX_SAFE_MESSAGE_LEN = 200;
const REDACT_PATTERN = /(?:api[_-]?key|signature|auth|bearer|token)\s*[:=]\s*[\w.-]+/gi;

function sanitizeMessage(msg: string): string {
  const truncated = msg.length > MAX_SAFE_MESSAGE_LEN ? msg.slice(0, MAX_SAFE_MESSAGE_LEN) + "…" : msg;
  return truncated.replace(REDACT_PATTERN, "[redacted]");
}

function parseAdapterError(error: unknown): Pick<ProviderDiagnostic, "status" | "httpStatus" | "errorCode" | "safeMessage"> {
  const err = error instanceof Error ? error : new Error(String(error));
  const msg = err.message;
  const code = (error as NodeJS.ErrnoException)?.code;
  const statusCode = (error as Error & { statusCode?: number }).statusCode ?? (error as Error & { status?: number }).status;

  if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNRESET") {
    return { status: "network-error", errorCode: code, safeMessage: code ? `${code}` : sanitizeMessage(msg) };
  }
  const status = statusCode ?? (msg.match(/\b(4\d{2}|5\d{2})\b/)?.[0] ? parseInt(msg.match(/\b(4\d{2}|5\d{2})\b/)![0], 10) : undefined);
  if ((status === 401 || status === 403) || /forbidden|unauthorized|auth/i.test(msg)) {
    return { status: "auth-error", httpStatus: status ?? 403, safeMessage: sanitizeMessage(msg) };
  }
  if (status === 429 || /rate\s*limit|too many requests/i.test(msg)) {
    return { status: "rate-limited", httpStatus: status ?? 429, safeMessage: sanitizeMessage(msg) };
  }
  if (status === 404 || /unsupported chain|no price|not found|no quote/i.test(msg)) {
    return { status: "unsupported", httpStatus: status ?? 404, safeMessage: sanitizeMessage(msg) };
  }
  return {
    status: "request-error",
    httpStatus: status,
    errorCode: code,
    safeMessage: sanitizeMessage(msg),
  };
}

// Initialize all adapters - order matters for tie-breaking
// Direct DEX integrations first, then aggregators, then bridges
const adapters = [
  // Direct DEX integrations (no aggregator markup, better prices)
  new UniswapV3Adapter(),
  new UniswapV2Adapter(),
  new CurveAdapter(),
  new PancakeSwapAdapter(),
  new BalancerV2Adapter(),
  new TraderJoeAdapter(),
  new VelodromeAdapter(),
  new AerodromeAdapter(),
  new CamelotAdapter(),
  new MaverickAdapter(),
  new OrcaAdapter(),
  new RaydiumAdapter(),
  new JupiterDirectAdapter(),
  new QuickSwapAdapter(),
  new SpookySwapAdapter(),
  new THORChainAdapter(),
  new PhoenixAdapter(),
  new MeteoraAdapter(),
  new GMXAdapter(),
  new DydxAdapter(),
  new SyncSwapAdapter(),
  new VelocoreAdapter(),
  new BancorAdapter(),
  new SpiritSwapAdapter(),
  // Aggregators (cover many DEXs)
  new ZeroXAdapter(),
  new OneInchAdapter(),
  new ParaswapAdapter(),
  new OpenOceanAdapter(),
  new OdosAdapter(),
  new KyberSwapAdapter(),
  new BebopAdapter(),
  new DodoAdapter(),
  new SushiSwapAdapter(),
  new OkxAdapter(),
  // Bridges last
  new LiFiAdapter(),
];

// Register adapters with tool registry
for (const adapter of adapters) {
  toolRegistry.register(adapter);
}

/** All quote adapter names (for /v1/providers REAL vs SYNTHETIC listing). */
export function getQuoteAdapterNames(): string[] {
  return adapters.map((a) => a.name);
}

// Providers that can return real quotes (aggregators / API-backed). When any of these
// return a route, we prefer them over mock-only DEX adapters for correct USDC/BRLA etc. rates.
// Aligned with config REAL_AGGREGATOR_NAMES; use isRealAggregator() for single source of truth.
const REAL_QUOTE_PROVIDERS = new Set([
  "0x",
  "1inch",
  "kyberswap",
  "okx",
  "paraswap",
  "odos",
  "openocean",
  "bebop",
  "dodo",
  "sushiswap",
  "lifi",
]);

// Mock-only adapters: formula-based amountOut (amountIn * (1 - fee)), wrong for non-1:1 pairs.
// When we have at least one real quote, we keep only real aggregator routes (see below).
const MOCK_ONLY_PROVIDERS = new Set(["curve", "quickswap", "phoenix"]);

export async function quoteRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: z.infer<typeof QuoteRequestSchemaApi>;
    Querystring: z.infer<typeof QuoteQuerySchema>;
  }>(
    "/v1/quote",
    {
      schema: {
        description: "Get swap/bridge quotes",
        tags: ["quotes"],
        querystring: {
          type: "object",
          properties: {
            allowedTools: {
              type: "string",
              description: "Comma-separated list of allowed tools/exchanges (e.g., 'Uniswap V3,Curve')",
            },
            deniedTools: {
              type: "string",
              description: "Comma-separated list of denied tools/exchanges (e.g., 'Hop,Stargate')",
            },
          },
        },
        body: {
          type: "object",
          required: ["fromChainId", "toChainId", "fromToken", "toToken", "amountIn"],
          properties: {
            fromChainId: { type: "number" },
            toChainId: { type: "number" },
            fromToken: { type: "string" },
            toToken: { type: "string" },
            amountIn: { type: "string" },
            slippageTolerance: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              routes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    routeId: { type: "string" },
                    provider: { type: "string" },
                    type: { type: "string", enum: ["swap", "bridge"] },
                    fromChainId: { type: "number" },
                    toChainId: { type: "number" },
                    fromToken: { type: "string" },
                    toToken: { type: "string" },
                    amountIn: { type: "string" },
                    amountOut: { type: "string" },
                    estimatedGas: { type: "string" },
                    fees: { type: "string" },
                    priceImpactBps: { type: "number" },
                    steps: { type: "array" },
                    warnings: { type: "array", items: { type: "string" } },
                    toolsUsed: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of DEXs/bridges used in this route",
                    },
                  },
                },
              },
              requestId: { type: "string" },
              warning: {
                type: "string",
                description: "Shown when only mock routes would be returned; add API keys for real quotes",
              },
              filteredRoutes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    routeId: { type: "string" },
                    reason: { type: "string" },
                  },
                },
              },
              diagnostics: {
                type: "array",
                description: "Per-provider diagnostics when REAL_QUOTES_ONLY and empty routes (dev/DEBUG_QUOTES only)",
                items: {
                  type: "object",
                  properties: {
                    provider: { type: "string" },
                    attempted: { type: "boolean" },
                    status: {
                      type: "string",
                      enum: ["ok", "no-route", "auth-error", "rate-limited", "unsupported", "request-error", "network-error", "missing-key"],
                    },
                    httpStatus: { type: "number" },
                    errorCode: { type: "string" },
                    safeMessage: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id || randomUUID();
      fastify.log.info(
        { requestId, query: request.query },
        "POST /v1/quote"
      );

      try {
        const quoteRequest = QuoteRequestSchemaApi.parse(request.body);
        const queryParams = QuoteQuerySchema.parse(request.query || {});

        // amountIn is base units only; must be > 0
        if (BigInt(quoteRequest.amountIn) <= 0n) {
          return reply.code(400).send({
            error: "amountIn must be greater than 0 (base units integer string)",
          });
        }

        if (DEBUG_QUOTES) {
          const fromDecimals = getTokenDecimals(quoteRequest.fromChainId, quoteRequest.fromToken);
          const fromTokens = getTokensForChain(quoteRequest.fromChainId);
          const toTokens = getTokensForChain(quoteRequest.toChainId);
          const fromMeta = fromTokens.find((t) => t.address.toLowerCase() === quoteRequest.fromToken.toLowerCase());
          const toMeta = toTokens.find((t) => t.address.toLowerCase() === quoteRequest.toToken.toLowerCase());
          // amountInWei must equal request.amountIn; no conversion in API
          fastify.log.info(
            {
              requestId,
              amountIn: quoteRequest.amountIn,
              amountInWei: quoteRequest.amountIn,
              fromDecimals,
              fromChainId: quoteRequest.fromChainId,
              toChainId: quoteRequest.toChainId,
              fromToken: quoteRequest.fromToken,
              toToken: quoteRequest.toToken,
              fromSymbol: fromMeta?.symbol ?? "?",
              toSymbol: toMeta?.symbol ?? "?",
              toDecimals: toMeta?.decimals ?? "?",
            },
            "Quote request (diagnostic)"
          );
        }

        // Get quotes from enabled adapters only (with-key first, then public; disabled and flag-disabled excluded)
        const orderedAdapters = orderAdaptersForQuote(adapters);
        const capabilityContext: QuoteRequestContext = {
          isCrossChain: quoteRequest.fromChainId !== quoteRequest.toChainId,
          region: queryParams.region,
        };
        let adaptersToUse = filterAdaptersByCapabilities(orderedAdapters, capabilityContext);
        const isSameChain = quoteRequest.fromChainId === quoteRequest.toChainId;
        if (isSameChain) {
          adaptersToUse = adaptersToUse.filter((a) => a.name.toLowerCase() !== "lifi");
        }
        const allRoutes: Array<Awaited<ReturnType<typeof adapters[0]["getQuote"]>>[0]> = [];
        const adapterAttempts: Array<{ adapter: string; routeCount?: number; error?: string }> = [];
        const chainId = quoteRequest.fromChainId;
        const timestamp = new Date().toISOString();

        // When REAL_QUOTES_ONLY, always collect diagnostics so we can return them when no real routes (no fake rates).
        const includeDiagnostics = isRealQuotesOnly();
        const realDiagnostics = new Map<string, ProviderDiagnostic>();

        for (const adapter of adaptersToUse) {
          try {
            const routes = await adapter.getQuote(quoteRequest);
            allRoutes.push(...routes);
            if (includeDiagnostics && isRealAggregator(adapter.name)) {
              realDiagnostics.set(adapter.name.toLowerCase(), {
                provider: adapter.name,
                attempted: true,
                status: routes.length === 0 ? "no-route" : "ok",
                ...(routes.length === 0 ? { safeMessage: "No route from provider" } : {}),
              });
            }
            logProviderQuoteUsage(fastify.log, {
              requestId,
              provider: adapter.name,
              chainId,
              timestamp,
              routeCount: routes.length,
            });
            if (DEBUG_QUOTES) adapterAttempts.push({ adapter: adapter.name, routeCount: routes.length });
          } catch (error) {
            if (includeDiagnostics && isRealAggregator(adapter.name)) {
              const parsed = parseAdapterError(error);
              realDiagnostics.set(adapter.name.toLowerCase(), {
                provider: adapter.name,
                attempted: true,
                ...parsed,
              });
            }
            const errMsg = error instanceof Error ? error.message : String(error);
            logProviderQuoteUsage(fastify.log, {
              requestId,
              provider: adapter.name,
              chainId,
              timestamp,
              error: true,
            });
            if (DEBUG_QUOTES) adapterAttempts.push({ adapter: adapter.name, error: errMsg });
            fastify.log.warn(
              { requestId, adapter: adapter.name, error },
              "Adapter failed to get quote"
            );
            // Metrics are already tracked in adapter
          }
        }
        if (DEBUG_QUOTES) {
          fastify.log.info({ requestId, adapterAttempts, totalRoutes: allRoutes.length }, "Quote adapter attempts (diagnostic)");
        }

        // Apply policy engine with tool filtering from query params
        const env = process.env.NODE_ENV || "development";
        const policyConfig = getPolicyConfig(env);
        
        // Build policy engine config with tool filtering from query params
        const policyEngineConfig = {
          ...policyConfig,
          allowlist: queryParams.allowedTools
            ? {
                chains: policyConfig.allowlist?.chains || [],
                tokens: policyConfig.allowlist?.tokens || [],
                tools: queryParams.allowedTools,
              }
            : policyConfig.allowlist,
          denylist: queryParams.deniedTools
            ? {
                chains: policyConfig.denylist?.chains || [],
                tokens: policyConfig.denylist?.tokens || [],
                tools: queryParams.deniedTools,
              }
            : policyConfig.denylist,
        };
        
        const policyEngine = new PolicyEngine(policyEngineConfig);
        const { allowed: policyFilteredRoutes, rejected } = await policyEngine.applyPolicies(
          allRoutes,
          quoteRequest
        );

        // Log rejected routes (without exposing sensitive details)
        if (rejected.length > 0) {
          fastify.log.info(
            { requestId, rejectedCount: rejected.length },
            "Routes filtered by policy"
          );
        }

        // REAL_QUOTES_ONLY: return only real aggregator routes; never synthetic/dex-list (no fake rates e.g. 998xxx for BRLA).
        if (isRealQuotesOnly()) {
          const realOnlyRoutes = policyFilteredRoutes.filter((r) => isRealAggregator(r.provider));
          if (realOnlyRoutes.length === 0) {
            const emptyResponse: typeof QuoteResponseSchema._type & {
              warning?: string;
              diagnostics?: ProviderDiagnostic[];
            } = {
              routes: [],
              requestId: requestId.toString(),
              warning:
                "No real aggregator routes available for this pair; check provider keys or token support.",
            };
            emptyResponse.diagnostics = getRealAggregatorNames().map((name) => {
              const entry = realDiagnostics.get(name.toLowerCase());
              if (entry) return entry;
              if (name.toLowerCase() === "lifi" && isSameChain) {
                return {
                  provider: name,
                  attempted: false,
                  status: "unsupported" as const,
                  safeMessage: "Skipped: LiFi adapter is cross-chain only",
                };
              }
              return {
                provider: name,
                attempted: false,
                status: "missing-key" as const,
                safeMessage: "Provider not called (missing key or disabled)",
              };
            });
            return emptyResponse;
          }
          // Strict: only real routes for ranking; policyFilteredRoutes must not contain synthetic.
          policyFilteredRoutes.length = 0;
          policyFilteredRoutes.push(...realOnlyRoutes);
        }

        // When any real aggregator (0x, KyberSwap, OKX, etc.) returns a route, show only those —
        // so correct rates from 0x appear first and mock/formula adapters (Phoenix, Curve, etc.) don't outrank them.
        const realRoutes = policyFilteredRoutes.filter((r) =>
          REAL_QUOTE_PROVIDERS.has(r.provider.toLowerCase())
        );
        const hasRealQuote = realRoutes.length > 0;
        const onlyMockRoutes =
          !hasRealQuote &&
          policyFilteredRoutes.length > 0 &&
          policyFilteredRoutes.every((r) => MOCK_ONLY_PROVIDERS.has(r.provider.toLowerCase()));

        const routesToRank =
          onlyMockRoutes
            ? []
            : hasRealQuote
              ? realRoutes
              : policyFilteredRoutes;

        // Attach amountInWei (= request.amountIn), amountOutWei, fromDecimals, toDecimals before ranking so sort uses amountOutWei
        enrichRoutesWithBaseUnits(routesToRank, quoteRequest);
        // Rank by amountOutWei (BigInt) when present, then by score
        const rankedRoutes = rankRoutes(routesToRank);

        // Store route snapshots after enrichment so snapshot.amountIn matches response (wei)
        for (const route of rankedRoutes) {
          routeSnapshotStore.store(route);
        }

        const response: typeof QuoteResponseSchema._type & { warning?: string } = {
          routes: rankedRoutes,
          requestId: requestId.toString(),
        };

        if (onlyMockRoutes) {
          response.warning =
            "No aggregator API keys configured. Add ZEROX_API_KEY, KYBERSWAP_API_KEY, or OKX_ACCESS_KEY in services/swaps-api/.env and restart the API for accurate rates like Jumper/MonetaDEX.";
        }

        // Include rejection reasons in response (non-sensitive)
        if (rejected.length > 0) {
          // Add metadata about filtered routes without exposing internal logic
          (response as typeof response & { filteredRoutes: Array<{ routeId: string; reason: string }> }).filteredRoutes = rejected.map((r: { routeId: string; reason: string }) => ({
            routeId: r.routeId,
            reason: r.reason,
          }));
        }

        fastify.log.info(
          { requestId, routeCount: rankedRoutes.length },
          "Quote request completed"
        );
        if (DEBUG_QUOTES && (rankedRoutes.length === 0 || response.warning)) {
          fastify.log.info(
            { requestId, routeCount: rankedRoutes.length, warning: (response as { warning?: string }).warning },
            "Quote result: no routes or API-key warning (diagnostic)"
          );
        }
        if (DEBUG_QUOTES && rankedRoutes.length > 0) {
          const first = rankedRoutes[0] as Route & {
            amountInWei?: string;
            amountOutWei?: string;
            amountInHuman?: string;
            amountOutHuman?: string;
            fromDecimals?: number;
            toDecimals?: number;
            toSymbol?: string;
          };
          const requestAmountIn = quoteRequest.amountIn;
          const amountInWei = first.amountInWei ?? "?";
          const amountOutWei = first.amountOutWei ?? "?";
          const amountInHuman = first.amountInHuman ?? "?";
          const amountOutHuman = first.amountOutHuman ?? "?";
          const toSymbol = first.toSymbol ?? "?";
          fastify.log.info(
            {
              requestId,
              sampleRoute: {
                provider: first.provider,
                amountInWei,
                amountOutWei,
                amountInHuman,
                amountOutHuman,
                toSymbol,
                note: "amountOutWei is base units (e.g. ~5e21 for ~5200 BRLA); amountOutHuman is for display",
              },
            },
            "DEBUG_UNITS: sample route (amountOutWei base units, amountOutHuman for display)"
          );
        }

        return response;
      } catch (error) {
        if (error instanceof Error && "issues" in error) {
          const zodError = error as z.ZodError;
          const isAmountInError = zodError.issues.some(
            (i) => Array.isArray(i.path) && i.path[0] === "amountIn"
          );
          const errorMessage = isAmountInError
            ? AMOUNT_IN_BASE_UNITS_MESSAGE
            : "Invalid request body";
          return reply.code(400).send({
            error: errorMessage,
            ...(isAmountInError ? {} : { details: zodError.issues }),
          });
        }
        fastify.log.error({ requestId, error }, "Quote request failed");
        throw error;
      }
    }
  );
}

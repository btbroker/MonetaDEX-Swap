import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { z } from "zod";
import { QuoteRequestSchema, QuoteResponseSchema } from "@fortuna/shared";
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
import { rankRoutes } from "../../utils/ranking.js";
import { routeSnapshotStore } from "../../utils/route-snapshot.js";
import { toolRegistry } from "../../registry/tool-registry.js";

// Query parameters schema for tool filtering
export const QuoteQuerySchema = z.object({
  allowedTools: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
  deniedTools: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
});

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

export async function quoteRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: typeof QuoteRequestSchema._type;
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
        { requestId, body: request.body, query: request.query },
        "POST /v1/quote"
      );

      try {
        const quoteRequest = QuoteRequestSchema.parse(request.body);
        const queryParams = QuoteQuerySchema.parse(request.query || {});

        // Get quotes from all adapters (with metrics tracking)
        const allRoutes: Array<Awaited<ReturnType<typeof adapters[0]["getQuote"]>>[0]> = [];
        for (const adapter of adapters) {
          try {
            const routes = await adapter.getQuote(quoteRequest);
            allRoutes.push(...routes);
          } catch (error) {
            fastify.log.warn(
              { requestId, adapter: adapter.name, error },
              "Adapter failed to get quote"
            );
            // Metrics are already tracked in adapter
          }
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

        // Rank routes by best amountOut minus fees
        const rankedRoutes = rankRoutes(policyFilteredRoutes);

        // Store route snapshots for validation in /v1/tx
        for (const route of rankedRoutes) {
          routeSnapshotStore.store(route);
        }

        const response: typeof QuoteResponseSchema._type = {
          routes: rankedRoutes,
          requestId: requestId.toString(),
        };

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

        return response;
      } catch (error) {
        if (error instanceof Error && "issues" in error) {
          return reply.code(400).send({
            error: "Invalid request body",
            details: (error as any).issues,
          });
        }
        fastify.log.error({ requestId, error }, "Quote request failed");
        throw error;
      }
    }
  );
}

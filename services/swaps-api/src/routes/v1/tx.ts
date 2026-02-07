import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { TxRequestSchema, TxResponseSchema } from "@fortuna/shared";
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
import { routeSnapshotStore } from "../../utils/route-snapshot.js";

const adapters = [
  // Direct DEX integrations first
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
  // Aggregators
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

export async function txRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: typeof TxRequestSchema._type;
  }>(
    "/v1/tx",
    {
      schema: {
        description: "Get transaction payload for a route",
        tags: ["transactions"],
        body: {
          type: "object",
          required: [
            "routeId",
            "fromChainId",
            "toChainId",
            "fromToken",
            "toToken",
            "amountIn",
            "recipient",
          ],
          properties: {
            routeId: { type: "string" },
            fromChainId: { type: "number" },
            toChainId: { type: "number" },
            fromToken: { type: "string" },
            toToken: { type: "string" },
            amountIn: { type: "string" },
            recipient: { type: "string" },
            slippageTolerance: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              routeId: { type: "string" },
              txHash: { type: "string" },
              txData: { type: "string" },
              to: { type: "string" },
              value: { type: "string" },
              gasLimit: { type: "string" },
              gasPrice: { type: "string" },
              maxFeePerGas: { type: "string" },
              maxPriorityFeePerGas: { type: "string" },
              chainId: { type: "number" },
            },
          },
          400: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
          404: {
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

      try {
        const txRequest = TxRequestSchema.parse(request.body);
        fastify.log.info({ requestId, routeId: txRequest.routeId }, "POST /v1/tx");

        // Validate route snapshot integrity
        const validation = routeSnapshotStore.validate(txRequest);
        if (!validation.valid) {
          fastify.log.warn(
            { requestId, routeId: txRequest.routeId, reason: validation.reason },
            "Route snapshot validation failed"
          );
          return reply.code(400).send({
            error: validation.reason || "Route validation failed",
          });
        }

        // Find the adapter that can handle this route
        let txResponse;
        for (const adapter of adapters) {
          try {
            txResponse = await adapter.getTx(txRequest.routeId, txRequest);
            if (txResponse) {
              break;
            }
          } catch (error) {
            fastify.log.warn(
              { requestId, adapter: adapter.name, error },
              "Adapter failed to get tx"
            );
          }
        }

        if (!txResponse) {
          return reply.code(404).send({
            error: "Route not found or not supported",
          });
        }

        fastify.log.info({ requestId, routeId: txRequest.routeId }, "Tx request completed");

        return txResponse;
      } catch (error) {
        if (error instanceof Error && "issues" in error) {
          return reply.code(400).send({
            error: "Invalid request body",
            details: (error as any).issues,
          });
        }
        fastify.log.error({ requestId, error }, "Tx request failed");
        throw error;
      }
    }
  );
}

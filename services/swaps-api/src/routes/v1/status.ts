import { FastifyInstance } from "fastify";
import { z } from "zod";
import { StatusResponseSchema, TxStatusSchema } from "@fortuna/shared";

const StatusQuerySchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

export async function statusRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: z.infer<typeof StatusQuerySchema>;
  }>(
    "/v1/status",
    {
      schema: {
        description: "Get transaction status",
        tags: ["transactions"],
        querystring: {
          type: "object",
          required: ["txHash"],
          properties: {
            txHash: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              txHash: { type: "string" },
              status: { type: "string", enum: ["pending", "completed", "failed", "unknown"] },
              confirmations: { type: "number" },
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
      const requestId = request.id;
      fastify.log.info({ requestId, query: request.query }, "GET /v1/status");

      try {
        const { txHash } = StatusQuerySchema.parse(request.query);

        // Stub implementation: return unknown or pending
        // In production, this would query the blockchain
        const status: typeof TxStatusSchema._type = "unknown";

        const response: typeof StatusResponseSchema._type = {
          txHash,
          status,
        };

        return response;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            error: "Invalid query parameters",
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );
}

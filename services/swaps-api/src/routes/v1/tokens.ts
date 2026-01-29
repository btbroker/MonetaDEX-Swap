import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getTokensForChain } from "@fortuna/config";
import { ChainIdSchema } from "@fortuna/shared";

const TokensQuerySchema = z.object({
  chainId: ChainIdSchema,
});

export async function tokensRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: z.infer<typeof TokensQuerySchema>;
  }>(
    "/v1/tokens",
    {
      schema: {
        description: "Get tokens for a specific chain",
        tags: ["tokens"],
        querystring: {
          type: "object",
          required: ["chainId"],
          properties: {
            chainId: { type: "number" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              tokens: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    symbol: { type: "string" },
                    name: { type: "string" },
                    decimals: { type: "number" },
                    chainId: { type: "number" },
                    logoURI: { type: "string" },
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
      const requestId = request.id;
      fastify.log.info({ requestId, query: request.query }, "GET /v1/tokens");

      try {
        const { chainId } = TokensQuerySchema.parse(request.query);
        const tokens = getTokensForChain(chainId);

        return {
          tokens,
        };
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

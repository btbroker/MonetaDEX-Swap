import { FastifyInstance } from "fastify";
import { CHAINS } from "@fortuna/config";

export async function chainsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/v1/chains",
    {
      schema: {
        description: "Get supported chains",
        tags: ["chains"],
        response: {
          200: {
            type: "object",
            properties: {
              chains: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    chainId: { type: "number" },
                    name: { type: "string" },
                    rpcUrl: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const requestId = request.id;
      fastify.log.info({ requestId }, "GET /v1/chains");

      return {
        chains: CHAINS,
      };
    }
  );
}

import { FastifyInstance } from "fastify";

export async function healthzRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/healthz",
    {
      schema: {
        description: "Health check endpoint",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async () => {
      return { status: "ok", timestamp: new Date().toISOString() };
    }
  );
}

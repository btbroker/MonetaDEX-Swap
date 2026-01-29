import { FastifyInstance } from "fastify";
import { chainsRoutes } from "./chains.js";
import { tokensRoutes } from "./tokens.js";
import { quoteRoutes } from "./quote.js";
import { txRoutes } from "./tx.js";
import { statusRoutes } from "./status.js";
import { metricsRoutes } from "./metrics.js";
import { healthRoutes } from "./health.js";
import { providersRoutes } from "./providers.js";

export async function v1Routes(fastify: FastifyInstance) {
  await fastify.register(chainsRoutes);
  await fastify.register(tokensRoutes);
  await fastify.register(quoteRoutes);
  await fastify.register(txRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(healthRoutes);
  await fastify.register(providersRoutes);
}

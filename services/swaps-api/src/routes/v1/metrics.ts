import { FastifyInstance } from "fastify";
import { quoteMetricsTracker } from "../../metrics/quote-metrics.js";

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/v1/metrics",
    {
      schema: {
        description: "Get quote quality metrics for all providers",
        tags: ["metrics"],
        response: {
          200: {
            type: "object",
            properties: {
              providers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    provider: { type: "string" },
                    totalQuotes: { type: "number" },
                    successfulQuotes: { type: "number" },
                    failedQuotes: { type: "number" },
                    successRate: { type: "number", description: "Success rate as decimal (0-1)" },
                    averageResponseTime: { type: "number", description: "Average response time in milliseconds" },
                    averageRoutesPerQuote: { type: "number" },
                    qualityScore: { type: "number", description: "Quality score (0-1), higher is better" },
                    lastUpdated: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const requestId = request.id;
      fastify.log.info({ requestId }, "GET /v1/metrics");

      const allMetrics = quoteMetricsTracker.getAllMetrics();
      const providers = Array.from(allMetrics.values()).map((metrics) => {
        const quality = quoteMetricsTracker.getQuality(metrics.provider);
        return {
          provider: metrics.provider,
          totalQuotes: metrics.totalQuotes,
          successfulQuotes: metrics.successfulQuotes,
          failedQuotes: metrics.failedQuotes,
          successRate:
            metrics.totalQuotes > 0
              ? metrics.successfulQuotes / metrics.totalQuotes
              : 0,
          averageResponseTime: metrics.averageResponseTime,
          averageRoutesPerQuote: metrics.averageRoutesPerQuote,
          qualityScore: quality?.qualityScore || 0,
          lastUpdated: new Date(metrics.lastUpdated).toISOString(),
        };
      });

      return { providers };
    }
  );
}

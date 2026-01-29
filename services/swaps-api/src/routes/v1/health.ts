import { FastifyInstance } from "fastify";
import { providerHealthTracker } from "../../utils/provider-health.js";
import { rateLimiter, getRateLimitConfig } from "../../utils/rate-limiter.js";

export async function healthRoutes(fastify: FastifyInstance) {
  // Provider health status
  fastify.get(
    "/v1/health/providers",
    {
      schema: {
        description: "Get health status for all providers",
        tags: ["health"],
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
                    isHealthy: { type: "boolean" },
                    lastSuccessAt: { type: "string", format: "date-time", nullable: true },
                    lastFailureAt: { type: "string", format: "date-time", nullable: true },
                    consecutiveFailures: { type: "number" },
                    averageResponseTime: { type: "number", nullable: true, description: "Average response time in milliseconds" },
                    totalRequests: { type: "number" },
                    totalFailures: { type: "number" },
                    failureRate: { type: "number", description: "Failure rate as decimal (0-1)" },
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
      fastify.log.info({ requestId }, "GET /v1/health/providers");

      const allHealth = providerHealthTracker.getAllHealth();
      const providers = Array.from(allHealth.values()).map((health) => ({
        provider: health.provider,
        isHealthy: health.isHealthy,
        lastSuccessAt: health.lastSuccessAt
          ? new Date(health.lastSuccessAt).toISOString()
          : null,
        lastFailureAt: health.lastFailureAt
          ? new Date(health.lastFailureAt).toISOString()
          : null,
        consecutiveFailures: health.consecutiveFailures,
        averageResponseTime: health.averageResponseTime || null,
        totalRequests: health.totalRequests,
        totalFailures: health.totalFailures,
        failureRate:
          health.totalRequests > 0
            ? health.totalFailures / health.totalRequests
            : 0,
      }));

      return { providers };
    }
  );

  // Rate limit status
  fastify.get(
    "/v1/health/rate-limits",
    {
      schema: {
        description: "Get current rate limit status for all providers",
        tags: ["health"],
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
                    maxRequests: { type: "number" },
                    windowMs: { type: "number", description: "Time window in milliseconds" },
                    currentCount: { type: "number", description: "Current request count in window" },
                    remaining: { type: "number", description: "Remaining requests in window" },
                    resetAt: { type: "string", format: "date-time", description: "When the rate limit resets" },
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
      fastify.log.info({ requestId }, "GET /v1/health/rate-limits");

      // Get known providers
      const knownProviders = ["0x", "lifi"];

      const providers = knownProviders.map((provider) => {
        const config = getRateLimitConfig(provider);
        const currentCount = rateLimiter.getCount(provider, config.windowMs);
        const remaining = Math.max(0, config.maxRequests - currentCount);

        // Calculate reset time (approximate - based on oldest request in window)
        const now = Date.now();
        const resetAt = new Date(now + config.windowMs).toISOString();

        return {
          provider,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
          currentCount,
          remaining,
          resetAt,
        };
      });

      return { providers };
    }
  );
}

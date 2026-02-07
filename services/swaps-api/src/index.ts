import "./load-env.js";
import { randomUUID } from "crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import * as Sentry from "@sentry/node";
import { envBool, envPresent } from "./load-env.js";
import { logger } from "./utils/logger.js";
import { healthzRoutes } from "./routes/healthz.js";
import { v1Routes } from "./routes/v1/index.js";
import { getProviderStatus } from "./config/provider-config.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

// Initialize Sentry (optional)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 1.0,
  });
}

const fastify = Fastify({
  logger: logger as any, // pino logger is compatible with Fastify
  requestIdLogLabel: "requestId",
  genReqId: () => {
    return randomUUID();
  },
});

// Register CORS
await fastify.register(cors, {
  origin: true,
});

// Register Swagger
await fastify.register(swagger, {
  openapi: {
    openapi: "3.0.0",
    info: {
      title: "MonetaDEX API",
      description: "API for decentralized exchange swap and bridge quotes",
      version: "0.1.0",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
    tags: [
      { name: "chains", description: "Chain information" },
      { name: "tokens", description: "Token information" },
      { name: "quotes", description: "Swap and bridge quotes" },
      { name: "transactions", description: "Transaction management" },
      { name: "health", description: "Health check" },
      { name: "metrics", description: "Provider metrics and quality scores" },
    ],
  },
});

// Register Swagger UI
await fastify.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
});

// Register routes
await fastify.register(healthzRoutes);
await fastify.register(v1Routes);

// Root: friendly response when opening base URL
fastify.get("/", async () => {
  return {
    name: "MonetaDEX API",
    version: "0.1.0",
    docs: "/docs",
    openapi: "/openapi.json",
    health: "/healthz",
    v1: "/v1",
    providers: "/v1/providers",
  };
});

// Expose OpenAPI JSON
fastify.get("/openapi.json", async () => {
  return fastify.swagger();
});

// Export fastify instance for testing
export async function buildFastify(): Promise<typeof fastify> {
  return fastify;
}

// Env vars that should be set in production for real quotes (warn only, do not crash)
const RECOMMENDED_PROVIDER_KEYS = [
  "ZEROX_API_KEY",
  "OKX_ACCESS_KEY",
  "PARASWAP_API_KEY",
  "ONEINCH_API_KEY",
  "KYBERSWAP_API_KEY",
];

function warnIfMissingRecommendedKeys(): void {
  if (process.env.NODE_ENV !== "production") return;
  const set = RECOMMENDED_PROVIDER_KEYS.filter((k) => process.env[k]);
  if (set.length === 0) {
    logger.warn(
      { envVars: RECOMMENDED_PROVIDER_KEYS },
      "Production: no aggregator API keys set; quotes will use mock/fallback. Set at least one key in .env.production or host env (see docs/KEY_ROTATION.md)."
    );
  }
}

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    logger.info({ port: PORT, host: HOST }, "Server listening");
    logger.info(`API docs available at http://${HOST}:${PORT}/docs`);
    logger.info(`OpenAPI spec available at http://${HOST}:${PORT}/openapi.json`);
    warnIfMissingRecommendedKeys();
    const realQuotesOnly = envBool("REAL_QUOTES_ONLY");
    const debugQuotes = envBool("DEBUG_QUOTES");
    const { withKeys, public: publicProviders } = getProviderStatus();
    logger.info(
      {
        REAL_QUOTES_ONLY: realQuotesOnly,
        DEBUG_QUOTES: debugQuotes,
        withKeys,
        public: publicProviders,
      },
      "Startup: quote flags and provider lists (names only; no secrets)"
    );
    if (process.env.NODE_ENV !== "production") {
      logger.info(
        {
          ACCESS_KEY: envPresent("OKX_ACCESS_KEY"),
          SECRET_KEY: envPresent("OKX_SECRET_KEY"),
          PASSPHRASE: envPresent("OKX_PASSPHRASE"),
          PROJECT_ID: envPresent("OKX_PROJECT_ID"),
        },
        "OKX env present (dev only; no values)"
      );
    }
  } catch (err) {
    logger.error({ err }, "Server startup failed");
    process.exit(1);
  }
};

start();

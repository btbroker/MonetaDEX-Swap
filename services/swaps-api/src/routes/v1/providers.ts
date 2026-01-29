import { FastifyInstance } from "fastify";
import { getApiKey } from "../../utils/http-client.js";

const PROVIDER_KEYS: Record<string, string> = {
  zerox: "ZEROX_API_KEY",
  okx: "OKX_API_KEY",
  paraswap: "PARASWAP_API_KEY",
  oneinch: "ONEINCH_API_KEY",
  kyberswap: "KYBERSWAP_API_KEY",
  openocean: "OPENOCEAN_API_KEY",
  odos: "ODOS_API_KEY",
  lifi: "LIFI_API_KEY",
  bebop: "BEBOP_API_KEY",
  dodo: "DODO_API_KEY",
  sushiswap: "SUSHISWAP_API_KEY",
};

export async function providersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/v1/providers",
    {
      schema: {
        description: "List which providers have API keys (real prices). No keys = mock mode.",
        tags: ["health"],
        response: {
          200: {
            type: "object",
            properties: {
              withKeys: { type: "array", items: { type: "string" } },
              mockMode: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    async () => {
      const withKeys: string[] = [];
      const mockMode: string[] = [];
      for (const [name, envVar] of Object.entries(PROVIDER_KEYS)) {
        if (getApiKey(envVar)) {
          withKeys.push(name);
        } else {
          mockMode.push(name);
        }
      }
      return { withKeys, mockMode };
    }
  );
}

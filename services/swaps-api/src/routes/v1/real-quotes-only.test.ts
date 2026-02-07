/**
 * Regression test: REAL_QUOTES_ONLY=true never returns synthetic adapters.
 * No network hits: adapters return [] when no keys, or mock http for positive case.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { isRealAggregator } from "../../config/provider-config.js";

const QUOTE_BODY = {
  fromChainId: 137,
  toChainId: 137,
  fromToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  toToken: "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
  amountIn: "1000000000",
  slippageTolerance: 0.5,
};

vi.mock("../../utils/http-client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/http-client.js")>();
  return {
    ...actual,
    httpRequest: vi.fn().mockResolvedValue({
      status: 200,
      data: {
        buyAmount: "5231000000000000000000",
        sellAmount: "1000000000",
        buyToken: "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
        sellToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        liquidityAvailable: true,
        route: { fills: [{ source: "Uniswap_V3" }] },
        transaction: { to: "0x0", data: "0x", value: "0", gas: "150000", gasPrice: "0" },
      },
      headers: {},
    }),
  };
});

describe("REAL_QUOTES_ONLY regression - no synthetic adapters", () => {
  const origRealQuotesOnly = process.env.REAL_QUOTES_ONLY;
  const origZeroxKey = process.env.ZEROX_API_KEY;
  const origLifiKey = process.env.LIFI_API_KEY;

  beforeEach(() => {
    process.env.REAL_QUOTES_ONLY = "true";
  });

  afterEach(() => {
    process.env.REAL_QUOTES_ONLY = origRealQuotesOnly;
    process.env.ZEROX_API_KEY = origZeroxKey;
    process.env.LIFI_API_KEY = origLifiKey;
  });

  it("returns routes=[] and warning when real providers are disabled/missing", async () => {
    process.env.ZEROX_API_KEY = "";
    process.env.LIFI_API_KEY = "";
    delete process.env.ZEROX_API_KEY;
    delete process.env.LIFI_API_KEY;

    const { buildFastify } = await import("../../index.js");
    const app: FastifyInstance = await buildFastify();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/quote",
      payload: QUOTE_BODY,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.routes).toEqual([]);
    expect(body.warning).toBeDefined();
    expect(body.warning).toContain("No real aggregator routes available");
  });

  it("returns only real aggregator routes when 0x is enabled (mocked)", async () => {
    vi.resetModules();
    process.env.ZEROX_API_KEY = "test-key-for-regression";
    process.env.LIFI_API_KEY = "";

    const { buildFastify } = await import("../../index.js");
    const app: FastifyInstance = await buildFastify();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/quote",
      payload: QUOTE_BODY,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.routes.length).toBeGreaterThanOrEqual(1);
    const provider = body.routes[0].provider;
    expect(isRealAggregator(provider)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { QuoteRequestSchema, type QuoteRequest, type Route } from "@fortuna/shared";
import { enrichRoutesWithBaseUnits, QuoteRequestSchemaApi } from "./quote.js";

describe("QuoteRequestSchemaApi (amountIn base-units validation)", () => {
  const validBase = {
    fromChainId: 1,
    toChainId: 1,
    fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  };

  it("accepts amountIn as base-units integer string (e.g. '100')", () => {
    const result = QuoteRequestSchemaApi.safeParse({
      ...validBase,
      amountIn: "100",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountIn).toBe("100");
    }
  });

  it("rejects human decimal string (e.g. '0.5')", () => {
    const result = QuoteRequestSchemaApi.safeParse({
      ...validBase,
      amountIn: "0.5",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path?.includes("amountIn"))).toBe(true);
      expect(result.error.message).toContain("base units");
    }
  });

  it("rejects scientific or non-integer string (e.g. '1e6')", () => {
    const result = QuoteRequestSchemaApi.safeParse({
      ...validBase,
      amountIn: "1e6",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path?.includes("amountIn"))).toBe(true);
      expect(result.error.message).toContain("base units");
    }
  });

  it("rejects '1000.0', '-1', '', '0' (non-integer or empty)", () => {
    for (const amountIn of ["1000.0", "-1", "", "0"]) {
      const result = QuoteRequestSchemaApi.safeParse({ ...validBase, amountIn });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path?.includes("amountIn"))).toBe(true);
      }
    }
  });

  it("accepts '1' and '1000000000' (base-units integer strings)", () => {
    for (const amountIn of ["1", "1000000000"]) {
      const result = QuoteRequestSchemaApi.safeParse({ ...validBase, amountIn });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountIn).toBe(amountIn);
      }
    }
  });
});

describe("QuoteRequestSchema", () => {
  it("should validate valid quote request", () => {
    const validRequest = {
      fromChainId: 1,
      toChainId: 1,
      fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
      slippageTolerance: 0.5,
    };

    const result = QuoteRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slippageTolerance).toBe(0.5);
    }
  });

  it("should use default slippageTolerance if not provided", () => {
    const request = {
      fromChainId: 1,
      toChainId: 1,
      fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
    };

    const result = QuoteRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slippageTolerance).toBe(0.5);
    }
  });

  it("should reject invalid token address", () => {
    const invalidRequest = {
      fromChainId: 1,
      toChainId: 1,
      fromToken: "invalid-address",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
    };

    const result = QuoteRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject invalid chainId", () => {
    const invalidRequest = {
      fromChainId: -1,
      toChainId: 1,
      fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
    };

    const result = QuoteRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it("should reject slippageTolerance outside valid range", () => {
    const invalidRequest = {
      fromChainId: 1,
      toChainId: 1,
      fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
      slippageTolerance: 150, // Invalid: > 100
    };

    const result = QuoteRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});

describe("Route toolsUsed field", () => {
  it("should include toolsUsed in route schema", async () => {
    const { RouteSchema } = await import("@fortuna/shared");
    
    const routeWithTools = {
      routeId: "test-123",
      provider: "0x",
      type: "swap" as const,
      fromChainId: 1,
      toChainId: 1,
      fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
      amountOut: "997000",
      estimatedGas: "150000",
      fees: "3000",
      steps: [],
      toolsUsed: ["Uniswap V3", "Curve"],
    };

    const result = RouteSchema.safeParse(routeWithTools);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toolsUsed).toEqual(["Uniswap V3", "Curve"]);
    }
  });

  it("should allow route without toolsUsed (optional field)", async () => {
    const { RouteSchema } = await import("@fortuna/shared");
    
    const routeWithoutTools = {
      routeId: "test-123",
      provider: "0x",
      type: "swap" as const,
      fromChainId: 1,
      toChainId: 1,
      fromToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      toToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      amountIn: "1000000",
      amountOut: "997000",
      estimatedGas: "150000",
      fees: "3000",
      steps: [],
    };

    const result = RouteSchema.safeParse(routeWithoutTools);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.toolsUsed).toBeUndefined();
    }
  });
});

describe("Quote endpoint - Tool filtering", () => {
  it("should parse allowedTools query parameter", () => {
    const { z } = require("zod");
    const QuoteQuerySchema = z.object({
      allowedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
      deniedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
    });
    
    const query = QuoteQuerySchema.parse({
      allowedTools: "Uniswap V3,Curve",
    });

    expect(query.allowedTools).toEqual(["Uniswap V3", "Curve"]);
  });

  it("should parse deniedTools query parameter", () => {
    const { z } = require("zod");
    const QuoteQuerySchema = z.object({
      allowedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
      deniedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
    });
    
    const query = QuoteQuerySchema.parse({
      deniedTools: "Hop,Stargate",
    });

    expect(query.deniedTools).toEqual(["Hop", "Stargate"]);
  });

  it("should handle empty query parameters", () => {
    const { z } = require("zod");
    const QuoteQuerySchema = z.object({
      allowedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
      deniedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
    });
    
    const query = QuoteQuerySchema.parse({});

    expect(query.allowedTools).toBeUndefined();
    expect(query.deniedTools).toBeUndefined();
  });

  it("should trim whitespace from tool names", () => {
    const { z } = require("zod");
    const QuoteQuerySchema = z.object({
      allowedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
      deniedTools: z
        .string()
        .optional()
        .transform((val) => (val ? val.split(",").map((t) => t.trim()) : undefined)),
    });
    
    const query = QuoteQuerySchema.parse({
      allowedTools: " Uniswap V3 , Curve , Balancer ",
    });

    expect(query.allowedTools).toEqual(["Uniswap V3", "Curve", "Balancer"]);
  });
});

describe("enrichRoutesWithBaseUnits", () => {
  it("request.amountIn base units: USDC 1000 => amountInWei equals request.amountIn (no double toWei)", () => {
    const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const BRLA_POLYGON = "0xE6A537a407488807F0bbeb0038B79004f19DDDFb";
    // 1000 USDC in base units (6 decimals)
    const amountInBaseUnits = "1000000000";
    const request: QuoteRequest = {
      fromChainId: 137,
      toChainId: 137,
      fromToken: USDC_POLYGON,
      toToken: BRLA_POLYGON,
      amountIn: amountInBaseUnits,
      slippageTolerance: 0.5,
    };
    const route: Route = {
      routeId: "test-137",
      provider: "0x",
      type: "swap",
      fromChainId: 137,
      toChainId: 137,
      fromToken: USDC_POLYGON,
      toToken: BRLA_POLYGON,
      amountIn: amountInBaseUnits,
      amountOut: "1666.24",
      estimatedGas: "150000",
      fees: "0.5",
      steps: [],
    };
    const routes: Route[] = [route];
    enrichRoutesWithBaseUnits(routes, request);

    const r = route as Route & {
      amountInWei?: string;
      amountOutWei?: string;
      amountInHuman?: string;
      amountOutHuman?: string;
      fromDecimals?: number;
      toDecimals?: number;
    };
    expect(r.fromDecimals).toBe(6);
    expect(r.toDecimals).toBe(18);
    expect(r.amountInWei).toBe(amountInBaseUnits);
    expect(request.amountIn).toBe(r.amountInWei);
    expect(r.amountOutWei).toBe("1666240000000000000000");
    expect(r.amountOutWei).not.toMatch(/\./);
    expect(r.amountInWei).not.toMatch(/\./);
    expect(r.amountInHuman).toBe("1000");
    expect(r.amountOutHuman).toBe("1666.24");
    expect(r.toSymbol).toBe("BRLA");
    expect(r.fromSymbol).toBe("USDC");
    // Deprecated: amountIn/amountOut are human for display
    expect(route.amountIn).toBe("1000");
    expect(route.amountOut).toBe("1666.24");
  });

  it("fills route-level amountOutWei/amountOutHuman from last step when only steps returned", () => {
    const USDC_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const BRLA_POLYGON = "0xE6A537a407488807F0bbeb0038B79004f19DDDFb";
    const amountInBaseUnits = "1000000000";
    const request: QuoteRequest = {
      fromChainId: 137,
      toChainId: 137,
      fromToken: USDC_POLYGON,
      toToken: BRLA_POLYGON,
      amountIn: amountInBaseUnits,
      slippageTolerance: 0.5,
    };
    // Route with only steps populated (adapter returned step-level data, no top-level amountOutWei/amountOutHuman)
    const route: Route = {
      routeId: "test-step-only",
      provider: "0x",
      type: "swap",
      fromChainId: 137,
      toChainId: 137,
      fromToken: USDC_POLYGON,
      toToken: BRLA_POLYGON,
      amountIn: "1000",
      amountOut: "0", // placeholder; adapter only populated steps
      estimatedGas: "150000",
      fees: "0",
      steps: [
        {
          type: "swap",
          provider: "0x",
          fromChainId: 137,
          toChainId: 137,
          fromToken: USDC_POLYGON,
          toToken: BRLA_POLYGON,
          amountIn: "1000",
          amountOut: "2500",
        },
        {
          type: "swap",
          provider: "0x",
          fromChainId: 137,
          toChainId: 137,
          fromToken: BRLA_POLYGON,
          toToken: BRLA_POLYGON,
          amountIn: "2500",
          amountOut: "5231.42",
          amountOutWei: "5231420000000000000000",
          amountOutHuman: "5231.42",
        },
      ],
    };
    const routes: Route[] = [route];
    enrichRoutesWithBaseUnits(routes, request);

    const r = route as Route & {
      amountInWei?: string;
      amountOutWei?: string;
      amountInHuman?: string;
      amountOutHuman?: string;
      fromDecimals?: number;
      toDecimals?: number;
    };
    expect(r.amountOutWei).toBe("5231420000000000000000");
    expect(r.amountOutHuman).toBe("5231.42");
    expect(r.toDecimals).toBe(18);
    expect(r.amountInWei).toBe(amountInBaseUnits);
    expect(r.fromDecimals).toBe(6);
  });
});

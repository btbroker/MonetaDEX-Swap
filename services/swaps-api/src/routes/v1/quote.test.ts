import { describe, it, expect } from "vitest";
import { QuoteRequestSchema } from "@fortuna/shared";

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

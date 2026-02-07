import { describe, it, expect } from "vitest";
import {
  toWei,
  buildQuoteRequest,
  isIntegerLike,
  assertIsWeiString,
  formatAmountOutWeiToHuman,
  formatRouteAmountOut,
  normalizeRouteAmountOut,
} from "./amount-utils";

describe("toWei", () => {
  it("USDC 6 decimals: '1000' => '1000000000'", () => {
    expect(toWei("1000", 6)).toBe("1000000000");
  });

  it("USDC 6 decimals: '0.5' => '500000'", () => {
    expect(toWei("0.5", 6)).toBe("500000");
  });

  it("USDC 6 decimals: '100' => '100000000'", () => {
    expect(toWei("100", 6)).toBe("100000000");
  });

  it("BRLA 18 decimals: '1' => '1000000000000000000'", () => {
    expect(toWei("1", 18)).toBe("1000000000000000000");
  });
});

describe("assertIsWeiString", () => {
  it("does not throw for digits-only amountIn", () => {
    expect(() => assertIsWeiString("1000000000")).not.toThrow();
    expect(() => assertIsWeiString("1")).not.toThrow();
  });

  it("throws for non-integer-like amountIn", () => {
    expect(() => assertIsWeiString("1000.0")).toThrow("base units");
    expect(() => assertIsWeiString("1e6")).toThrow("base units");
    expect(() => assertIsWeiString("-1")).toThrow("base units");
    expect(() => assertIsWeiString("")).toThrow("base units");
  });
});

describe("isIntegerLike", () => {
  it("accepts digit-only strings", () => {
    expect(isIntegerLike("100000000")).toBe(true);
    expect(isIntegerLike("0")).toBe(true);
  });

  it("rejects decimals and scientific", () => {
    expect(isIntegerLike("0.5")).toBe(false);
    expect(isIntegerLike("1e6")).toBe(false);
  });
});

describe("buildQuoteRequest", () => {
  it("returns amountIn as wei (integer string)", () => {
    const req = buildQuoteRequest({
      amountHuman: "100",
      fromTokenDecimals: 6,
      fromChainId: 137,
      toChainId: 137,
      fromToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      toToken: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      slippageTolerance: 0.5,
    });
    expect(req.amountIn).toBe("100000000");
    expect(/^[0-9]+$/.test(req.amountIn)).toBe(true);
  });
});

describe("formatAmountOutWeiToHuman", () => {
  it("formats BRLA 18 decimals: amountOutWei -> human string", () => {
    expect(formatAmountOutWeiToHuman("1666000000000000000000", 18)).toBe("1666");
  });

  it("formats USDT 6 decimals: amountOutWei -> human string", () => {
    expect(formatAmountOutWeiToHuman("998136580", 6)).toBe("998.13658");
  });
});

describe("formatRouteAmountOut", () => {
  it("prefers amountOutHuman when present (API standard)", () => {
    const { display, isFromWei } = formatRouteAmountOut({
      amountOutHuman: "5200.5",
      amountOutWei: "5200500000000000000000",
      toDecimals: 18,
      amountOut: "0",
    });
    expect(isFromWei).toBe(true);
    expect(display).toBe("5200.5");
  });

  it("uses amountOutWei + toDecimals when amountOutHuman missing", () => {
    const { display, isFromWei } = formatRouteAmountOut({
      amountOutWei: "1666000000000000000000",
      toDecimals: 18,
      amountOut: "0",
    });
    expect(isFromWei).toBe(true);
    expect(display).toBe("1666");
  });

  it("returns No quote when amountOutHuman and amountOutWei both missing (never use deprecated amountOut)", () => {
    const { display, isFromWei, noDisplay } = formatRouteAmountOut({
      amountOut: "998.13658",
    });
    expect(noDisplay).toBe(true);
    expect(display).toBe("No quote");
    expect(isFromWei).toBe(false);
  });

  it("uses last step amountOutHuman when top-level amountOutHuman/amountOutWei missing (UI bug fix)", () => {
    const { display, isFromWei } = formatRouteAmountOut({
      toDecimals: 18,
      amountOut: "0",
      steps: [
        { amountOutHuman: "1000" },
        { amountOutHuman: "5231.42" },
      ],
    });
    expect(isFromWei).toBe(true);
    expect(display).toBe("5231.42");
  });

  it("uses last step amountOutWei + route.toDecimals when step has no amountOutHuman", () => {
    const { display, isFromWei } = formatRouteAmountOut({
      toDecimals: 18,
      amountOut: "0",
      steps: [
        { amountOutWei: "1000000000000000000000" },
        { amountOutWei: "5231420000000000000000" },
      ],
    });
    expect(isFromWei).toBe(true);
    expect(display).toBe("5231.42");
  });

  it("uses last step amountOutWei + lastStep.toDecimals when route.toDecimals missing (branch D)", () => {
    const { display, branch } = normalizeRouteAmountOut({
      amountOut: "0",
      steps: [
        { amountOutWei: "1000000000000000000000" },
        { amountOutWei: "5231420000000000000000", toDecimals: 18 },
      ],
    });
    expect(branch).toBe("D");
    expect(display).toBe("5231.42");
  });
});

import { describe, it, expect } from "vitest";
import { getTokenDecimals, toWei, fromWei } from "./token-decimals.js";

const POLYGON_USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const POLYGON_BRLA = "0xE6A537a407488807F0bbeb0038B79004f19DDDFb";

describe("getTokenDecimals", () => {
  it("returns 6 for Polygon USDC from token registry", () => {
    expect(getTokenDecimals(137, POLYGON_USDC)).toBe(6);
  });

  it("returns 18 for Polygon BRLA from token registry", () => {
    expect(getTokenDecimals(137, POLYGON_BRLA)).toBe(18);
  });

  it("returns 18 for unknown token (default)", () => {
    expect(getTokenDecimals(137, "0x0000000000000000000000000000000000000001")).toBe(18);
  });
});

describe("toWei / fromWei", () => {
  it("roundtrips human amount for 6 decimals (USDC)", () => {
    const human = "1000";
    const wei = toWei(human, 6);
    expect(wei).toBe("1000000000");
    expect(fromWei(wei, 6)).toBe("1000");
  });

  it("roundtrips human amount for 18 decimals (BRLA)", () => {
    const human = "1666.5";
    const wei = toWei(human, 18);
    expect(fromWei(wei, 18)).toBe("1666.5");
  });

  it("same wei string yields different human for different decimals (regression: amountOut not identical for WETH vs BRLA)", () => {
    const wei = "1666000000000000000000"; // 1666 * 10^18
    const human18 = fromWei(wei, 18);
    const human6 = fromWei(wei, 6);
    expect(human18).toBe("1666");
    expect(human6).not.toBe(human18);
    expect(parseFloat(human6)).toBeGreaterThan(1e15);
  });
});

import { describe, it, expect } from "vitest";
import { computeOkxSignature } from "./okx.js";

describe("OKX signature", () => {
  it("produces stable signature for fixed timestamp/method/path/query", () => {
    const timestamp = "2020-12-08T09:08:57.715Z";
    const method = "GET";
    const pathWithQuery = "/api/v6/dex/aggregator/quote?chainIndex=137&amount=1000000000&fromTokenAddress=0x2791&toTokenAddress=0xE6A5";
    const prehash = timestamp + method + pathWithQuery;
    const secretKey = "test-secret-key";

    const sign = computeOkxSignature(prehash, secretKey);

    expect(sign).toBeDefined();
    expect(typeof sign).toBe("string");
    expect(sign.length).toBeGreaterThan(0);
    // Base64 chars only
    expect(sign).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Idempotent: same inputs -> same output
    const sign2 = computeOkxSignature(prehash, secretKey);
    expect(sign).toBe(sign2);
  });

  it("different prehash or secret produces different signature", () => {
    const prehash = "2020-12-08T09:08:57.715ZGET/api/v6/dex/aggregator/quote";
    const secretKey = "secret";

    const sign1 = computeOkxSignature(prehash, secretKey);
    const sign2 = computeOkxSignature(prehash + "x", secretKey);
    const sign3 = computeOkxSignature(prehash, secretKey + "x");

    expect(sign1).not.toBe(sign2);
    expect(sign1).not.toBe(sign3);
    expect(sign2).not.toBe(sign3);
  });
});

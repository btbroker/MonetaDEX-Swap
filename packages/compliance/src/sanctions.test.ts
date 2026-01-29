import { describe, it, expect } from "vitest";
import { StubSanctionsHook } from "./sanctions.js";

describe("StubSanctionsHook", () => {
  it("should always return false (not sanctioned)", async () => {
    const hook = new StubSanctionsHook();

    const result = await hook.isSanctioned(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      1
    );

    expect(result).toBe(false);
  });

  it("should handle different addresses and chains", async () => {
    const hook = new StubSanctionsHook();

    const results = await Promise.all([
      hook.isSanctioned("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 1),
      hook.isSanctioned("0xdAC17F958D2ee523a2206206994597C13D831ec7", 137),
    ]);

    expect(results.every((r) => r === false)).toBe(true);
  });
});

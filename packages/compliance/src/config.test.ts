import { describe, it, expect } from "vitest";
import { getPolicyConfig } from "./config.js";

describe("getPolicyConfig", () => {
  it("should return development config for development environment", () => {
    const config = getPolicyConfig("development");

    expect(config.policy).toBeDefined();
    expect(config.policy?.maxPriceImpactBps).toBe(1000);
    expect(config.policy?.minAmountUsd).toBe(0.1);
    expect(config.sanctionsHook).toBeDefined();
    expect(config.getTokenPriceUsd).toBeDefined();
  });

  it("should return staging config for staging environment", () => {
    const config = getPolicyConfig("staging");

    expect(config.policy).toBeDefined();
    expect(config.policy?.maxPriceImpactBps).toBe(500);
    expect(config.policy?.minAmountUsd).toBe(1);
  });

  it("should return production config for production environment", () => {
    const config = getPolicyConfig("production");

    expect(config.policy).toBeDefined();
    expect(config.policy?.maxPriceImpactBps).toBe(300);
    expect(config.policy?.maxSlippageBps).toBe(50);
    expect(config.policy?.minAmountUsd).toBe(10);
  });

  it("should return base config for unknown environment", () => {
    const config = getPolicyConfig("unknown");

    expect(config.policy).toBeDefined();
    expect(config.policy?.maxPriceImpactBps).toBe(500);
  });

  it("should return default config when no environment specified", () => {
    const config = getPolicyConfig();

    expect(config.policy).toBeDefined();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { ProviderHealthTracker } from "./provider-health.js";

describe("ProviderHealthTracker", () => {
  let tracker: ProviderHealthTracker;

  beforeEach(() => {
    tracker = new ProviderHealthTracker();
  });

  describe("recordSuccess", () => {
    it("should record successful request", () => {
      tracker.recordSuccess("test-provider", 100);

      const health = tracker.getHealth("test-provider");
      expect(health).toBeDefined();
      expect(health?.isHealthy).toBe(true);
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.totalRequests).toBe(1);
      expect(health?.averageResponseTime).toBe(100);
    });

    it("should calculate average response time", () => {
      tracker.recordSuccess("test-provider", 100);
      tracker.recordSuccess("test-provider", 200);
      tracker.recordSuccess("test-provider", 300);

      const health = tracker.getHealth("test-provider");
      expect(health?.averageResponseTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it("should reset consecutive failures on success", () => {
      tracker.recordFailure("test-provider", "error");
      tracker.recordFailure("test-provider", "error");
      tracker.recordSuccess("test-provider", 100);

      const health = tracker.getHealth("test-provider");
      expect(health?.consecutiveFailures).toBe(0);
      expect(health?.isHealthy).toBe(true);
    });
  });

  describe("recordFailure", () => {
    it("should record failed request", () => {
      tracker.recordFailure("test-provider", "timeout");

      const health = tracker.getHealth("test-provider");
      expect(health).toBeDefined();
      expect(health?.consecutiveFailures).toBe(1);
      expect(health?.totalFailures).toBe(1);
      expect(health?.totalRequests).toBe(1);
    });

    it("should increment consecutive failures", () => {
      tracker.recordFailure("test-provider", "error1");
      tracker.recordFailure("test-provider", "error2");
      tracker.recordFailure("test-provider", "error3");

      const health = tracker.getHealth("test-provider");
      expect(health?.consecutiveFailures).toBe(3);
    });

    it("should mark unhealthy after max consecutive failures", () => {
      const maxFailures = 5;
      for (let i = 0; i < maxFailures; i++) {
        tracker.recordFailure("test-provider", `error${i}`);
      }

      const health = tracker.getHealth("test-provider");
      expect(health?.isHealthy).toBe(false);
      expect(health?.consecutiveFailures).toBe(maxFailures);
    });
  });

  describe("isHealthy", () => {
    it("should return true for healthy provider", () => {
      tracker.recordSuccess("test-provider", 100);
      expect(tracker.isHealthy("test-provider")).toBe(true);
    });

    it("should return false after max consecutive failures", () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordFailure("test-provider", "error");
      }
      expect(tracker.isHealthy("test-provider")).toBe(false);
    });

    it("should return false for slow providers", () => {
      // Record very slow response times (> 10 seconds)
      tracker.recordSuccess("test-provider", 15000);
      expect(tracker.isHealthy("test-provider")).toBe(false);
    });

    it("should return true for unknown provider", () => {
      expect(tracker.isHealthy("unknown-provider")).toBe(true);
    });
  });

  describe("getHealth", () => {
    it("should return health status for provider", () => {
      tracker.recordSuccess("test-provider", 100);
      tracker.recordSuccess("test-provider", 200);

      const health = tracker.getHealth("test-provider");
      expect(health).toBeDefined();
      expect(health?.provider).toBe("test-provider");
      expect(health?.averageResponseTime).toBe(150);
      expect(health?.totalRequests).toBe(2);
    });

    it("should return undefined for unknown provider", () => {
      const health = tracker.getHealth("unknown-provider");
      expect(health).toBeUndefined();
    });
  });

  describe("reset", () => {
    it("should reset health for a provider", () => {
      tracker.recordSuccess("test-provider", 100);
      tracker.reset("test-provider");

      const health = tracker.getHealth("test-provider");
      expect(health).toBeUndefined();
    });
  });
});

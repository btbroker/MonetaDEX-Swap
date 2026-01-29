import { describe, it, expect, beforeEach } from "vitest";
import { QuoteMetricsTracker } from "./quote-metrics.js";

describe("QuoteMetricsTracker", () => {
  let tracker: QuoteMetricsTracker;

  beforeEach(() => {
    tracker = new QuoteMetricsTracker();
  });

  describe("recordSuccess", () => {
    it("should record successful quote", () => {
      tracker.recordSuccess("test-provider", 100, 2, "1000000");

      const metrics = tracker.getMetrics("test-provider");
      expect(metrics).toBeDefined();
      expect(metrics?.totalQuotes).toBe(1);
      expect(metrics?.successfulQuotes).toBe(1);
      expect(metrics?.failedQuotes).toBe(0);
      expect(metrics?.averageResponseTime).toBe(100);
      expect(metrics?.averageRoutesPerQuote).toBe(2);
    });

    it("should calculate average response time", () => {
      tracker.recordSuccess("test-provider", 100, 1, "1000000");
      tracker.recordSuccess("test-provider", 200, 1, "1000000");
      tracker.recordSuccess("test-provider", 300, 1, "1000000");

      const metrics = tracker.getMetrics("test-provider");
      expect(metrics?.averageResponseTime).toBe(200);
    });

    it("should calculate average routes per quote", () => {
      tracker.recordSuccess("test-provider", 100, 1, "1000000");
      tracker.recordSuccess("test-provider", 100, 3, "1000000");
      tracker.recordSuccess("test-provider", 100, 5, "1000000");

      const metrics = tracker.getMetrics("test-provider");
      expect(metrics?.averageRoutesPerQuote).toBe(3); // (1 + 3 + 5) / 3
    });
  });

  describe("recordFailure", () => {
    it("should record failed quote", () => {
      tracker.recordFailure("test-provider", 100);

      const metrics = tracker.getMetrics("test-provider");
      expect(metrics?.totalQuotes).toBe(1);
      expect(metrics?.successfulQuotes).toBe(0);
      expect(metrics?.failedQuotes).toBe(1);
    });

    it("should track failure response time", () => {
      tracker.recordFailure("test-provider", 500);
      tracker.recordFailure("test-provider", 1000);

      const metrics = tracker.getMetrics("test-provider");
      expect(metrics?.averageResponseTime).toBe(750);
    });
  });

  describe("getQuality", () => {
    it("should calculate quality score for provider", () => {
      // Record successful quotes
      tracker.recordSuccess("test-provider", 100, 3, "1000000");
      tracker.recordSuccess("test-provider", 200, 2, "1000000");
      tracker.recordSuccess("test-provider", 150, 4, "1000000");

      const quality = tracker.getQuality("test-provider");
      expect(quality).toBeDefined();
      expect(quality?.successRate).toBe(1.0);
      expect(quality?.qualityScore).toBeGreaterThan(0);
      expect(quality?.qualityScore).toBeLessThanOrEqual(1);
    });

    it("should penalize low success rate", () => {
      tracker.recordSuccess("test-provider", 100, 1, "1000000");
      tracker.recordFailure("test-provider", 100);
      tracker.recordFailure("test-provider", 100);

      const quality = tracker.getQuality("test-provider");
      expect(quality?.successRate).toBe(1 / 3);
      // Quality score should be lower due to low success rate
      expect(quality?.qualityScore).toBeLessThan(0.6);
    });

    it("should penalize slow response times", () => {
      tracker.recordSuccess("test-provider", 5000, 1, "1000000"); // 5 seconds

      const quality = tracker.getQuality("test-provider");
      expect(quality?.qualityScore).toBeLessThan(0.8); // Penalized for slow response
    });

    it("should return undefined for provider with no quotes", () => {
      const quality = tracker.getQuality("unknown-provider");
      expect(quality).toBeUndefined();
    });
  });

  describe("reset", () => {
    it("should reset metrics for a provider", () => {
      tracker.recordSuccess("test-provider", 100, 1, "1000000");
      tracker.reset("test-provider");

      const metrics = tracker.getMetrics("test-provider");
      expect(metrics).toBeUndefined();
    });
  });
});

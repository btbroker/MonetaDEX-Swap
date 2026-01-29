/**
 * Quote quality metrics tracking
 * Tracks success rates, response times, and quality indicators
 */

export interface QuoteMetrics {
  provider: string;
  totalQuotes: number;
  successfulQuotes: number;
  failedQuotes: number;
  averageResponseTime: number; // milliseconds
  averageRoutesPerQuote: number;
  averageAmountOut: string; // For comparison
  lastUpdated: number;
}

export interface QuoteQuality {
  provider: string;
  successRate: number; // 0-1
  averageResponseTime: number;
  routesGenerated: number;
  qualityScore: number; // 0-1, calculated from multiple factors
}

/**
 * Quote metrics tracker
 * In production, this could be stored in a time-series database
 */
export class QuoteMetricsTracker {
  private metrics: Map<string, QuoteMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private routesCounts: Map<string, number[]> = new Map();

  /**
   * Record a successful quote request
   */
  recordSuccess(
    provider: string,
    responseTimeMs: number,
    routesGenerated: number,
    averageAmountOut?: string
  ): void {
    const current = this.metrics.get(provider) || this.createDefaultMetrics(provider);

    // Update response time history
    let times = this.responseTimes.get(provider) || [];
    times.push(responseTimeMs);
    if (times.length > 20) {
      times = times.slice(-20); // Keep last 20
    }
    this.responseTimes.set(provider, times);

    // Update routes count history
    let counts = this.routesCounts.get(provider) || [];
    counts.push(routesGenerated);
    if (counts.length > 20) {
      counts = counts.slice(-20);
    }
    this.routesCounts.set(provider, counts);

    // Calculate averages
    const avgResponseTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const avgRoutes = counts.reduce((sum, c) => sum + c, 0) / counts.length;

    this.metrics.set(provider, {
      ...current,
      totalQuotes: current.totalQuotes + 1,
      successfulQuotes: current.successfulQuotes + 1,
      averageResponseTime: avgResponseTime,
      averageRoutesPerQuote: avgRoutes,
      averageAmountOut: averageAmountOut || current.averageAmountOut,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Record a failed quote request
   */
  recordFailure(provider: string, responseTimeMs: number): void {
    const current = this.metrics.get(provider) || this.createDefaultMetrics(provider);

    // Update response time history
    let times = this.responseTimes.get(provider) || [];
    times.push(responseTimeMs);
    if (times.length > 20) {
      times = times.slice(-20);
    }
    this.responseTimes.set(provider, times);

    const avgResponseTime = times.length > 0
      ? times.reduce((sum, t) => sum + t, 0) / times.length
      : 0;

    this.metrics.set(provider, {
      ...current,
      totalQuotes: current.totalQuotes + 1,
      failedQuotes: current.failedQuotes + 1,
      averageResponseTime: avgResponseTime,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Get metrics for a provider
   */
  getMetrics(provider: string): QuoteMetrics | undefined {
    return this.metrics.get(provider);
  }

  /**
   * Get quality score for a provider
   */
  getQuality(provider: string): QuoteQuality | undefined {
    const metrics = this.metrics.get(provider);
    if (!metrics || metrics.totalQuotes === 0) {
      return undefined;
    }

    const successRate = metrics.successfulQuotes / metrics.totalQuotes;

    // Quality score: combination of success rate, response time, and routes generated
    // Higher is better (0-1 scale)
    const responseTimeScore = Math.max(
      0,
      1 - metrics.averageResponseTime / 10000
    ); // Penalize slow responses
    const routesScore = Math.min(1, metrics.averageRoutesPerQuote / 5); // Prefer more routes (capped at 5)

    const qualityScore =
      successRate * 0.5 + responseTimeScore * 0.3 + routesScore * 0.2;

    return {
      provider,
      successRate,
      averageResponseTime: metrics.averageResponseTime,
      routesGenerated: Math.round(metrics.averageRoutesPerQuote),
      qualityScore,
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, QuoteMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics for a provider (for testing)
   */
  reset(provider: string): void {
    this.metrics.delete(provider);
    this.responseTimes.delete(provider);
    this.routesCounts.delete(provider);
  }

  /**
   * Reset all metrics (for testing)
   */
  resetAll(): void {
    this.metrics.clear();
    this.responseTimes.clear();
    this.routesCounts.clear();
  }

  private createDefaultMetrics(provider: string): QuoteMetrics {
    return {
      provider,
      totalQuotes: 0,
      successfulQuotes: 0,
      failedQuotes: 0,
      averageResponseTime: 0,
      averageRoutesPerQuote: 0,
      averageAmountOut: "0",
      lastUpdated: Date.now(),
    };
  }
}

// Singleton instance
export const quoteMetricsTracker = new QuoteMetricsTracker();

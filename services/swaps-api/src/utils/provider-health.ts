/**
 * Provider health check utilities
 * Tracks provider availability and response times
 */

export interface ProviderHealth {
  provider: string;
  isHealthy: boolean;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  consecutiveFailures: number;
  averageResponseTime?: number; // in milliseconds
  totalRequests: number;
  totalFailures: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  reason?: string;
  responseTime?: number;
}

/**
 * Provider health tracker
 * In production, this could be stored in Redis for distributed systems
 */
export class ProviderHealthTracker {
  private health: Map<string, ProviderHealth> = new Map();
  private responseTimes: Map<string, number[]> = new Map(); // provider -> response times
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly MAX_RESPONSE_TIME_MS = 10000; // 10 seconds
  private readonly RESPONSE_TIME_HISTORY_SIZE = 10; // Keep last 10 response times

  /**
   * Record a successful request
   */
  recordSuccess(provider: string, responseTimeMs: number): void {
    const current = this.health.get(provider) || this.createDefaultHealth(provider);

    // Update response time history
    let times = this.responseTimes.get(provider) || [];
    times.push(responseTimeMs);
    if (times.length > this.RESPONSE_TIME_HISTORY_SIZE) {
      times = times.slice(-this.RESPONSE_TIME_HISTORY_SIZE);
    }
    this.responseTimes.set(provider, times);

    // Calculate average response time
    const avgResponseTime =
      times.reduce((sum, time) => sum + time, 0) / times.length;

    this.health.set(provider, {
      ...current,
      isHealthy: true,
      lastSuccessAt: Date.now(),
      consecutiveFailures: 0,
      averageResponseTime: avgResponseTime,
      totalRequests: current.totalRequests + 1,
    });
  }

  /**
   * Record a failed request
   */
  recordFailure(provider: string, reason?: string): void {
    const current = this.health.get(provider) || this.createDefaultHealth(provider);
    const consecutiveFailures = current.consecutiveFailures + 1;

    this.health.set(provider, {
      ...current,
      isHealthy: consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES,
      lastFailureAt: Date.now(),
      consecutiveFailures,
      totalRequests: current.totalRequests + 1,
      totalFailures: current.totalFailures + 1,
    });
  }

  /**
   * Check if provider is healthy
   */
  isHealthy(provider: string): boolean {
    const health = this.health.get(provider);
    if (!health) {
      return true; // Assume healthy if no data
    }

    // Check consecutive failures
    if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      return false;
    }

    // Check average response time
    if (
      health.averageResponseTime &&
      health.averageResponseTime > this.MAX_RESPONSE_TIME_MS
    ) {
      return false;
    }

    return health.isHealthy;
  }

  /**
   * Get health status for a provider
   */
  getHealth(provider: string): ProviderHealth | undefined {
    return this.health.get(provider);
  }

  /**
   * Get all provider health statuses
   */
  getAllHealth(): Map<string, ProviderHealth> {
    return new Map(this.health);
  }

  /**
   * Reset health for a provider (for testing)
   */
  reset(provider: string): void {
    this.health.delete(provider);
    this.responseTimes.delete(provider);
  }

  /**
   * Reset all health data (for testing)
   */
  resetAll(): void {
    this.health.clear();
    this.responseTimes.clear();
  }

  private createDefaultHealth(provider: string): ProviderHealth {
    return {
      provider,
      isHealthy: true,
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
    };
  }
}

// Singleton instance
export const providerHealthTracker = new ProviderHealthTracker();

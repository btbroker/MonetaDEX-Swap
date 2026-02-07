/**
 * Provider health check utilities
 * Tracks provider availability and response times.
 * Circuit breaker: 401/429 repeatedly → temporarily disable provider (no cascading failures).
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

/** Options when recording a failure (e.g. HTTP status for circuit breaker). */
export interface RecordFailureOptions {
  statusCode?: number;
}

/**
 * Provider health tracker
 * In production, this could be stored in Redis for distributed systems.
 * 401/429: trip circuit after few occurrences and temporarily disable provider.
 */
export class ProviderHealthTracker {
  private health: Map<string, ProviderHealth> = new Map();
  private responseTimes: Map<string, number[]> = new Map(); // provider -> response times
  private circuitOpenUntil: Map<string, number> = new Map(); // provider -> timestamp when circuit closes
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly MAX_CONSECUTIVE_4XX = 2; // 401/429: trip circuit after 2
  private readonly CIRCUIT_OPEN_MS = 60_000; // 1 minute
  private readonly MAX_RESPONSE_TIME_MS = 10000; // 10 seconds
  private readonly RESPONSE_TIME_HISTORY_SIZE = 10; // Keep last 10 response times
  private consecutive4xx: Map<string, number> = new Map(); // provider -> count of consecutive 401/429

  /**
   * Record a successful request
   */
  recordSuccess(provider: string, responseTimeMs: number): void {
    const current = this.health.get(provider) || this.createDefaultHealth(provider);
    this.consecutive4xx.set(provider, 0);
    this.circuitOpenUntil.delete(provider); // Success clears circuit

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
   * Record a failed request. Pass statusCode (e.g. 401, 429) to trigger circuit breaker when repeated.
   */
  recordFailure(provider: string, reason?: string, options?: RecordFailureOptions): void {
    const current = this.health.get(provider) || this.createDefaultHealth(provider);
    const consecutiveFailures = current.consecutiveFailures + 1;
    const statusCode = options?.statusCode;
    const is4xxAuthOrRateLimit = statusCode === 401 || statusCode === 429;

    let isHealthy = consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES;
    if (is4xxAuthOrRateLimit) {
      const count = (this.consecutive4xx.get(provider) ?? 0) + 1;
      this.consecutive4xx.set(provider, count);
      if (count >= this.MAX_CONSECUTIVE_4XX) {
        this.circuitOpenUntil.set(provider, Date.now() + this.CIRCUIT_OPEN_MS);
        this.consecutive4xx.set(provider, 0);
        isHealthy = false;
      }
    } else {
      this.consecutive4xx.set(provider, 0);
    }

    this.health.set(provider, {
      ...current,
      isHealthy,
      lastFailureAt: Date.now(),
      consecutiveFailures,
      totalRequests: current.totalRequests + 1,
      totalFailures: current.totalFailures + 1,
    });
  }

  /**
   * Check if provider is healthy (not circuit-open and not over failure threshold).
   */
  isHealthy(provider: string): boolean {
    const now = Date.now();
    const openUntil = this.circuitOpenUntil.get(provider);
    if (openUntil != null && now < openUntil) {
      return false; // Circuit breaker open
    }
    if (openUntil != null && now >= openUntil) {
      this.circuitOpenUntil.delete(provider); // Expired, clear
    }

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
   * Status for /v1/providers: "healthy" | "disabled" (circuit open or too many failures).
   */
  getHealthStatus(provider: string): "healthy" | "disabled" {
    return this.isHealthy(provider) ? "healthy" : "disabled";
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
    this.circuitOpenUntil.delete(provider);
    this.consecutive4xx.delete(provider);
  }

  /**
   * Reset all health data (for testing)
   */
  resetAll(): void {
    this.health.clear();
    this.responseTimes.clear();
    this.circuitOpenUntil.clear();
    this.consecutive4xx.clear();
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

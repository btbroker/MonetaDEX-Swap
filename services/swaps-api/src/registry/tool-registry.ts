import type { ProviderAdapter, RouteType, RouteStep } from "@fortuna/shared";
import type { BaseAdapter } from "../adapters/base.js";

/**
 * Tool/Exchange identifier
 * Represents a specific DEX, bridge, or liquidity source
 */
export type Tool = string;

/**
 * Tool registry interface for adapters that can report tools
 */
export interface ToolRegistryAdapter {
  /**
   * Get the list of tools/exchanges this adapter can use
   * Returns empty array if adapter doesn't support tool reporting
   */
  getAvailableTools(): Promise<Tool[]>;

  /**
   * Get the tools used for a specific route
   * This should match the tools actually used in the route's steps
   */
  getToolsUsed?(provider: string, type: RouteType, steps: RouteStep[]): Tool[];
}

/**
 * Adapter with name property for tool registry
 */
type AdapterWithName = (ProviderAdapter | BaseAdapter) & { name: string } & Partial<ToolRegistryAdapter>;

/**
 * Tool Registry
 * Discovers and tracks available tools/exchanges from adapters
 */
export class ToolRegistry {
  private adapters: AdapterWithName[] = [];
  private toolCache: Map<string, Tool[]> = new Map(); // Cache by adapter name

  /**
   * Register an adapter that can report tools
   */
  register(adapter: AdapterWithName): void {
    this.adapters.push(adapter);
  }

  /**
   * Discover all available tools from registered adapters
   */
  async discoverAllTools(): Promise<Map<string, Tool[]>> {
    const toolsByAdapter = new Map<string, Tool[]>();

    for (const adapter of this.adapters) {
      if (typeof adapter.getAvailableTools === "function") {
        try {
          const tools = await adapter.getAvailableTools();
          toolsByAdapter.set(adapter.name, tools);
          this.toolCache.set(adapter.name, tools);
        } catch (error) {
          // Log error but continue with other adapters
          console.warn(`Failed to get tools from adapter ${adapter.name}:`, error);
          toolsByAdapter.set(adapter.name, []);
        }
      } else {
        toolsByAdapter.set(adapter.name, []);
      }
    }

    return toolsByAdapter;
  }

  /**
   * Get available tools for a specific adapter
   */
  async getToolsForAdapter(adapterName: string): Promise<Tool[]> {
    // Check cache first
    if (this.toolCache.has(adapterName)) {
      return this.toolCache.get(adapterName)!;
    }

    // Find adapter and get tools
    const adapter = this.adapters.find((a) => a.name === adapterName);
    if (adapter && typeof adapter.getAvailableTools === "function") {
      try {
        const tools = await adapter.getAvailableTools();
        this.toolCache.set(adapterName, tools);
        return tools;
      } catch (error) {
        console.warn(`Failed to get tools from adapter ${adapterName}:`, error);
        return [];
      }
    }

    return [];
  }

  /**
   * Get all unique tools across all adapters
   */
  async getAllUniqueTools(): Promise<Tool[]> {
    const allTools = new Set<Tool>();
    const toolsByAdapter = await this.discoverAllTools();

    for (const tools of toolsByAdapter.values()) {
      for (const tool of tools) {
        allTools.add(tool);
      }
    }

    return Array.from(allTools).sort();
  }

  /**
   * Clear the tool cache
   */
  clearCache(): void {
    this.toolCache.clear();
  }

  /**
   * Get registered adapter names
   */
  getRegisteredAdapters(): string[] {
    return this.adapters.map((a) => a.name);
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry();

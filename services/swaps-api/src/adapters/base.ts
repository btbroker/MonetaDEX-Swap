import type { ProviderAdapter, QuoteRequest, TxRequest, TxResponse, Route, RouteType, RouteStep } from "@fortuna/shared";
import type { ToolRegistryAdapter, Tool } from "../registry/tool-registry.js";

export abstract class BaseAdapter implements ProviderAdapter, ToolRegistryAdapter {
  abstract name: string;

  abstract getQuote(request: QuoteRequest): Promise<Route[]>;
  abstract getTx(routeId: string, request: TxRequest): Promise<TxResponse>;

  /**
   * Get available tools/exchanges this adapter can use
   * Override in subclasses to report actual tools
   */
  async getAvailableTools(): Promise<Tool[]> {
    return [];
  }

  /**
   * Get tools used for a specific route
   * Override in subclasses if route-specific tool reporting is needed
   */
  getToolsUsed(_provider: string, _type: RouteType, _steps: RouteStep[]): Tool[] {
    // Default: return empty array (subclasses should override)
    return [];
  }
}

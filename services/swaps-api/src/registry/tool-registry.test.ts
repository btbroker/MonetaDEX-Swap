import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry } from "./tool-registry.js";
import { BaseAdapter } from "../adapters/base.js";
import type { QuoteRequest, TxRequest, TxResponse, Route } from "@fortuna/shared";
import type { Tool } from "./tool-registry.js";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  // Mock adapter for testing
  class MockAdapter extends BaseAdapter {
    name = "mock-adapter";
    private tools: Tool[];

    constructor(tools: Tool[] = []) {
      super();
      this.tools = tools;
    }

    async getQuote(_request: QuoteRequest): Promise<Route[]> {
      return [];
    }

    async getTx(_routeId: string, _request: TxRequest): Promise<TxResponse> {
      throw new Error("Not implemented");
    }

    async getAvailableTools(): Promise<Tool[]> {
      return this.tools;
    }
  }

  describe("register", () => {
    it("should register an adapter", () => {
      const adapter = new MockAdapter(["Tool1", "Tool2"]);
      registry.register(adapter);

      const registered = registry.getRegisteredAdapters();
      expect(registered).toContain("mock-adapter");
    });

    it("should register multiple adapters", () => {
      const adapter1 = new MockAdapter(["Tool1"]);
      const adapter2 = new MockAdapter(["Tool2"]);

      registry.register(adapter1);
      registry.register(adapter2);

      const registered = registry.getRegisteredAdapters();
      expect(registered).toHaveLength(2);
      expect(registered).toContain("mock-adapter");
    });
  });

  describe("discoverAllTools", () => {
    it("should discover tools from all registered adapters", async () => {
      const adapter1 = new MockAdapter(["Uniswap V3", "Curve"]);
      adapter1.name = "adapter-1";
      const adapter2 = new MockAdapter(["Stargate", "Hop"]);
      adapter2.name = "adapter-2";

      registry.register(adapter1);
      registry.register(adapter2);

      const toolsByAdapter = await registry.discoverAllTools();

      expect(toolsByAdapter.size).toBe(2);
      expect(toolsByAdapter.get("adapter-1")).toEqual(["Uniswap V3", "Curve"]);
      expect(toolsByAdapter.get("adapter-2")).toEqual(["Stargate", "Hop"]);
    });

    it("should return empty array for adapter without tools", async () => {
      const adapter = new MockAdapter([]);
      registry.register(adapter);

      const toolsByAdapter = await registry.discoverAllTools();

      expect(toolsByAdapter.get("mock-adapter")).toEqual([]);
    });

    it("should handle adapter errors gracefully", async () => {
      class FailingAdapter extends BaseAdapter {
        name = "failing-adapter";

        async getQuote(_request: QuoteRequest): Promise<Route[]> {
          return [];
        }

        async getTx(_routeId: string, _request: TxRequest): Promise<TxResponse> {
          throw new Error("Not implemented");
        }

        async getAvailableTools(): Promise<Tool[]> {
          throw new Error("Failed to get tools");
        }
      }

      const adapter = new FailingAdapter();
      registry.register(adapter);

      const toolsByAdapter = await registry.discoverAllTools();

      // Should not throw, but return empty array for failing adapter
      expect(toolsByAdapter.get("failing-adapter")).toEqual([]);
    });
  });

  describe("getToolsForAdapter", () => {
    it("should get tools for a specific adapter", async () => {
      const adapter = new MockAdapter(["Uniswap V3", "Curve"]);
      registry.register(adapter);

      const tools = await registry.getToolsForAdapter("mock-adapter");

      expect(tools).toEqual(["Uniswap V3", "Curve"]);
    });

    it("should cache tools after first call", async () => {
      const adapter = new MockAdapter(["Tool1"]);
      registry.register(adapter);

      const tools1 = await registry.getToolsForAdapter("mock-adapter");
      const tools2 = await registry.getToolsForAdapter("mock-adapter");

      expect(tools1).toEqual(tools2);
      expect(tools1).toEqual(["Tool1"]);
    });

    it("should return empty array for unknown adapter", async () => {
      const tools = await registry.getToolsForAdapter("unknown-adapter");

      expect(tools).toEqual([]);
    });
  });

  describe("getAllUniqueTools", () => {
    it("should return all unique tools across adapters", async () => {
      const adapter1 = new MockAdapter(["Uniswap V3", "Curve"]);
      adapter1.name = "adapter-1";
      const adapter2 = new MockAdapter(["Stargate", "Hop", "Uniswap V3"]); // Duplicate
      adapter2.name = "adapter-2";

      registry.register(adapter1);
      registry.register(adapter2);

      const allTools = await registry.getAllUniqueTools();

      expect(allTools).toHaveLength(4);
      expect(allTools).toContain("Uniswap V3");
      expect(allTools).toContain("Curve");
      expect(allTools).toContain("Stargate");
      expect(allTools).toContain("Hop");
      // Should be sorted alphabetically
      const sorted = [...allTools].sort();
      expect(allTools).toEqual(sorted);
    });

    it("should return empty array when no adapters registered", async () => {
      const allTools = await registry.getAllUniqueTools();

      expect(allTools).toEqual([]);
    });
  });

  describe("clearCache", () => {
    it("should clear the tool cache", async () => {
      const adapter = new MockAdapter(["Tool1"]);
      registry.register(adapter);

      // Populate cache
      await registry.getToolsForAdapter("mock-adapter");

      // Clear cache
      registry.clearCache();

      // Cache should be empty
      const cacheSize = (registry as any).toolCache.size;
      expect(cacheSize).toBe(0);
    });
  });

  describe("getRegisteredAdapters", () => {
    it("should return list of registered adapter names", () => {
      const adapter1 = new MockAdapter([]);
      const adapter2 = new MockAdapter([]);
      adapter2.name = "adapter-2";

      registry.register(adapter1);
      registry.register(adapter2);

      const registered = registry.getRegisteredAdapters();

      expect(registered).toHaveLength(2);
      expect(registered).toContain("mock-adapter");
      expect(registered).toContain("adapter-2");
    });

    it("should return empty array when no adapters registered", () => {
      const registered = registry.getRegisteredAdapters();

      expect(registered).toEqual([]);
    });
  });
});

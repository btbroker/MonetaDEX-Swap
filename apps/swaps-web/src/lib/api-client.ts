import type {
  QuoteRequest,
  QuoteResponse,
  TxRequest,
  TxResponse,
  StatusResponse,
  ChainConfig,
  Token,
} from "@fortuna/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(
      error.error || "API request failed",
      response.status,
      error.details
    );
  }

  return response.json();
}

export const apiClient = {
  async getChains(): Promise<{ chains: ChainConfig[] }> {
    return fetchJson(`${API_URL}/v1/chains`);
  },

  async getTokens(chainId: number): Promise<{ tokens: Token[] }> {
    return fetchJson(`${API_URL}/v1/tokens?chainId=${chainId}`);
  },

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return fetchJson(`${API_URL}/v1/quote`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async getTx(request: TxRequest): Promise<TxResponse> {
    return fetchJson(`${API_URL}/v1/tx`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async getStatus(txHash: string): Promise<StatusResponse> {
    return fetchJson(`${API_URL}/v1/status?txHash=${txHash}`);
  },
};

export { ApiError };

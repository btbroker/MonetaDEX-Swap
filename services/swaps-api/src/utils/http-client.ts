/**
 * HTTP client utility for provider API calls
 * Uses undici for better performance than node-fetch
 */

import { request } from "undici";

export interface HttpClientOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number; // milliseconds
}

export interface HttpClientResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Make HTTP request with error handling and timeout
 */
export async function httpRequest<T = unknown>(
  url: string,
  options: HttpClientOptions = {}
): Promise<HttpClientResponse<T>> {
  const {
    method = "GET",
    headers = {},
    body,
    timeout = 10000, // 10 seconds default
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      responseHeaders[key] = Array.isArray(value) ? value[0] : String(value);
    }

    let data: T;
    const contentType = responseHeaders["content-type"] || "";
    if (contentType.includes("application/json")) {
      data = (await response.body.json()) as T;
    } else {
      data = (await response.body.text()) as T;
    }

    return {
      status: response.statusCode,
      data,
      headers: responseHeaders,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    throw error;
  }
}

/**
 * Get API key from environment variable
 */
export function getApiKey(envVar: string, required = false): string | undefined {
  const key = process.env[envVar];
  if (required && !key) {
    throw new Error(`Required API key not found: ${envVar}`);
  }
  return key;
}

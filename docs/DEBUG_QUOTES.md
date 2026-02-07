# Debug Quotes – Polygon USDC → BRLA (Stage 0 + Stage 1)

## Stage 0 – Orientation

### Repo structure
- **Root:** `pnpm-workspace.yaml`, `package.json`, `turbo.json`
- **Apps:** `apps/swaps-web` (Next.js widget)
- **Services:** `services/swaps-api` (Fastify API)
- **Packages:** `packages/shared`, `packages/config`, etc.

### Quote flow
- **swaps-web** builds a `QuoteRequest` in `apps/swaps-web/src/app/page.tsx` (fromChainId, toChainId, fromToken.address, toToken.address, amountIn, slippageTolerance) and calls `useQuote(quoteRequest, !!quoteRequest)`.
- **use-quote.ts** debounces the request (500 ms), then calls `apiClient.getQuote(debouncedRequest)` via React Query.
- **api-client.ts** sends `POST ${API_URL}/v1/quote` with `body: JSON.stringify(request)`.
- **swaps-api** registers routes in `services/swaps-api/src/routes/v1/index.ts`; quote handler is in `services/swaps-api/src/routes/v1/quote.ts` → `POST /v1/quote`. It parses body with `QuoteRequestSchema`, calls all adapters, filters by policy and real-vs-mock, ranks, returns `{ routes, requestId, warning? }`.

### Token registry
- **Location:** `packages/config/src/index.ts` – `getTokensForChain(chainId)` and chain-specific token arrays.
- **Polygon (137):** USDC `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (6 decimals), BRLA `0xE6A537a407488807F0bbeb0038B79004f19DDDFb` (18 decimals).

### Quote endpoint (API)
- **Path:** `POST /v1/quote`
- **Body (JSON):** `QuoteRequestSchema` – fromChainId (number), toChainId (number), fromToken (0x address), toToken (0x address), amountIn (string), slippageTolerance (optional number).
- **Response:** 200 with `{ routes: Route[], requestId: string, warning?: string, filteredRoutes?: ... }`.

---

## Stage 1 – Verify wiring (no code changes)

### A) swaps-web base URL
- **Env var:** `NEXT_PUBLIC_API_URL`
- **Checked files:** `apps/swaps-web/.env` (exists), `apps/swaps-web/.env.example`
- **Value in .env:** `NEXT_PUBLIC_API_URL=http://localhost:3001`
- **Usage:** `apps/swaps-web/src/lib/api-client.ts` line 11: `const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";`
- **Conclusion:** Base URL is `http://localhost:3001` (env or fallback). No mismatch.

### B) swaps-api server and routes
- **Bootstrap:** `services/swaps-api/src/index.ts` – `PORT = Number(process.env.PORT) || 3001`, `HOST = "0.0.0.0"`, `fastify.listen({ port: PORT, host: HOST })`.
- **Health:** `routes/healthz.js` → `GET /healthz` returns `{ status: "ok", timestamp }`.
- **Docs:** Swagger UI at `GET /docs`, OpenAPI at `GET /openapi.json`.
- **Providers:** `GET /v1/providers` – returns `{ withKeys: string[], disabled: string[], public: string[] }` (disabled = requires key but missing; public = can run without key).
- **Quote:** `POST /v1/quote` in `services/swaps-api/src/routes/v1/quote.ts` – body as above.
- **Conclusion:** API listens on 3001, has /healthz, /docs, /v1/providers, POST /v1/quote. No mismatch.

### C) Quote request parameters
- **swaps-web sends:** Numeric chain IDs (e.g. 137 for Polygon). Chain list comes from `GET /v1/chains` (from `@fortuna/config` CHAINS: Polygon = 137). Tokens from `GET /v1/tokens?chainId=137` (from `getTokensForChain(137)`). Quote request uses `fromChainId`, `toChainId` (numbers), `fromToken: fromToken.address`, `toToken: toToken.address` (0x strings), `amountIn` (string from input), `slippageTolerance` (number).
- **swaps-api expects:** `QuoteRequestSchema`: fromChainId (number), toChainId (number), fromToken (0x regex), toToken (0x regex), amountIn (string), slippageTolerance (optional). No name mapping: chain is always numeric (137), tokens are addresses.
- **Conclusion:** No "polygon" vs 137 mismatch; widget sends chainId 137 and token addresses. Request shape matches schema.

### Stage 1 summary – mismatches found
- **Exact env var:** `NEXT_PUBLIC_API_URL` = `http://localhost:3001` (or unset → same fallback).
- **Exact quote URL:** `POST http://localhost:3001/v1/quote` (when API_URL is default).
- **Expected body shape:** `{ fromChainId: 137, toChainId: 137, fromToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", toToken: "0xE6A537a407488807F0bbeb0038B79004f19DDDFb", amountIn: "1000", slippageTolerance?: 0.5 }`.
- **Mismatches:** None in URL, env, or request shape. Failure is likely in (1) provider/aggregator not supporting BRLA or returning errors, (2) API returning 200 with empty routes and widget appearing to “loop” due to refetch (e.g. staleTime 15s), or (3) response shape/parsing (e.g. warning field not typed in shared). Next: Stage 2 logs to confirm where it fails and whether backend returns empty routes vs error.

---

## Stage 2 – Diagnostic logs (minimal)

### swaps-api

1. **Startup (dev or DEBUG_QUOTES=1)**  
   **File:** `services/swaps-api/src/index.ts`  
   After `fastify.listen()`, logs provider status: `{ withKeys, disabled, public }`.  
   **File:** `services/swaps-api/src/config/provider-config.ts` – `getProviderStatus()` used by startup and `GET /v1/providers`.

2. **Quote handler (dev or DEBUG_QUOTES=1)**  
   **File:** `services/swaps-api/src/routes/v1/quote.ts`  
   - At start: logs normalized request (fromChainId, toChainId, fromToken, toToken, amountIn, and resolved fromSymbol, toSymbol, fromDecimals, toDecimals from token registry).  
   - After adapter loop: logs `adapterAttempts` (each adapter name and either routeCount or error message) and totalRoutes.  
   - When result has no routes or has `warning`: logs routeCount and warning.

   Controlled by `NODE_ENV !== "production"` or `DEBUG_QUOTES=1`.

### swaps-web

**File:** `apps/swaps-web/src/hooks/use-quote.ts`  
- When `NODE_ENV === "development"` or `NEXT_PUBLIC_DEBUG_QUOTES=1` (and in browser):  
  - Before fetch: logs request URL and body summary (fromChainId, toChainId, fromToken, toToken, amountIn).  
  - On success: logs routesCount, requestId, warning.  
  - On error: logs error message.

### How to run and where to look

1. **API:** From repo root: `pnpm dev` (or run swaps-api only). In the **terminal** where the API runs, look for:  
   - At startup: provider status with `withKeys`, `disabled`, `public`.  
   - On each `POST /v1/quote`: `"Quote request (diagnostic)"` (chainIds, symbols, decimals, amountIn), then `"Quote adapter attempts (diagnostic)"` (per-adapter routeCount or error), then `"Quote result: no routes or API-key warning"` if applicable.

2. **Widget:** Open the app in the browser (e.g. http://localhost:3000). Open **DevTools → Console**. Select Polygon, USDC → BRLA, enter amount. Look for:  
   - `[DEBUG_QUOTES] request` with url and params.  
   - `[DEBUG_QUOTES] response` with routesCount, requestId, warning; or `[DEBUG_QUOTES] error` with message.

3. **Optional:** Set `DEBUG_QUOTES=1` in `services/swaps-api/.env` to get quote diagnostics in production mode. Set `NEXT_PUBLIC_DEBUG_QUOTES=1` in `apps/swaps-web/.env.local` to get frontend diagnostics in production build.

---

## Fixes applied (amountOut + widget loop)

- **Frontend:** Stable quote query key (serialized `fromChainId|toChainId|fromToken|toToken|amountIn|slippage`), `retry: false`, and first-route logged in dev so the widget stops looping and renders the best route when the API returns routes.
- **Backend:** Paraswap, 1inch, Odos, SushiSwap, Dodo, Bebop, OpenOcean (and existing 0x, KyberSwap, OKX) now use token-registry decimals: **toWei(request.amountIn, fromDecimals)** when calling the provider and **fromWei(providerOutput, toDecimals)** for `route.amountOut`. So amountOut is human-readable and correct for each toToken (e.g. USDC→BRLA ~1665–1667 BRLA for 1000 USDC; USDC→WETH a different amount).
- **Guard:** `services/swaps-api/src/utils/token-decimals.test.ts` asserts Polygon USDC decimals 6, BRLA 18, toWei/fromWei roundtrip, and that the same wei string yields different human amounts for different decimals (regression for “amountOut identical for WETH vs BRLA”).

---

## Quote response / UI contract (Stage I)

**UI must use `amountOutHuman`; `amountOutWei` is for math; `amountOut` is deprecated.**

To avoid regressions (e.g. showing wei or misinterpreting fields), the UI and shared schema agree on:

- **UI must use `amountOutHuman`** for display. This is the PREFERRED field for “You receive” and step outputs.
- **`amountOutWei`** is for math only (e.g. validation, formatting via `formatUnits(amountOutWei, toDecimals)` when human is not present).
- **`amountOut`** is **deprecated** (compat only). Do not use it for display; use `amountOutHuman` or `formatUnits(amountOutWei, toDecimals)`.

Same applies to step-level and input amounts: prefer `amountInHuman`/`amountOutHuman`; treat `amountIn`/`amountOut` as deprecated for display. When both `amountOutHuman` and `amountOutWei` are missing, render "No quote" and log the route once (dev only).

---

### Verification (Stage 3)

Run with API and keys configured:

- **A)** `curl -X POST http://localhost:3001/v1/quote -H "Content-Type: application/json" -d '{"fromChainId":137,"toChainId":137,"fromToken":"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174","toToken":"0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619","amountIn":"1000"}'`  
  USDC→WETH 1000 USDC: expect amountOut in a sensible WETH range (e.g. ~0.3–0.5 WETH depending on rate).
- **B)** Same but toToken BRLA `0xE6A537a407488807F0bbeb0038B79004f19DDDFb`: expect amountOut ~1665–1667 BRLA (compare to Jumper).
- **C)** BRLA with amountIn 10 and 2000: amountOut should scale roughly with amountIn (not fixed ~996).

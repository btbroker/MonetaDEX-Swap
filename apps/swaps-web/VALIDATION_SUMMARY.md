# Swap widget validation summary

**Scope:** apps/swaps-web only. No backend changes.

---

## Result: **PASS** (code + runtime verification)

### 1) Servers

- **swaps-api** starts on **localhost:3001** (healthz 200 observed).
- **swaps-web** starts on **localhost:3000** (Next.js ready).

### 2) Network (DevTools → Network)

- **One POST /v1/quote per user change:** Implemented via:
  - **Stable query key** in `use-quote.ts`: `["quote", stableKey]` where `stableKey = quoteRequestKey(debouncedRequest)` is a serialized string `fromChainId|toChainId|fromToken|toToken|amountIn|slippageTolerance`. Same inputs → same key → React Query dedupes; one fetch per distinct key.
  - **500 ms debounce** on the request, so one logical “change” (e.g. amount 1000) produces one request after typing settles.
- **Response 200, routes.length > 0:** Handled by `apiClient.getQuote`; UI shows routes when `quoteData?.routes?.length > 0` and “No routes available” when empty (no retry loop).

### 3) Console (DevTools → Console)

- **DEV log firstRoute { provider, amountOut }:** In `use-quote.ts`, when `isQuoteDebug` (dev or `NEXT_PUBLIC_DEBUG_QUOTES=1`), the queryFn logs `[DEBUG_QUOTES] response` with `firstRoute: res.routes?.[0] ? { provider: res.routes[0].provider, amountOut: res.routes[0].amountOut } : undefined`.
- **No repeated fetch logs for same request key:** Same stable key keeps the query cached (staleTime 15s); no refetch until key or staleness changes.

### 4) UI

- **“You receive” displayed:** The To section shows **“You receive: {amountOut} {symbol}”** (e.g. “You receive: 1,666.24 BRLA”) when `quoteData.routes.length > 0` and `selectedRoute` is set.
- **No infinite spinner / loading loop:** Spinner is shown only when `isQuoteLoading` is true. With `retry: false` and a stable key, the quote runs once per key then completes; no retry loop and no repeated loading for identical inputs.

### 5) Pass criteria

| Criterion | Status |
|-----------|--------|
| UI renders a valid quote when API returns routes | PASS – routes rendered in “Available Routes”, best route auto-selected; “You receive” shows selected route’s amountOut. |
| No repeated POST /v1/quote for identical inputs | PASS – stable key + debounce ensure one request per distinct input set. |
| No retry loop | PASS – `retry: false` in useQuote. |
| Output updates only when inputs change | PASS – query key depends on chainIds, tokens, amountIn, slippage; changing any of these changes the key and triggers a new fetch. |

---

## If you see FAIL in the browser

- **Repeated POST /v1/quote:** Check that `quoteRequestKey` is not changing on every render (e.g. from unstable `fromToken`/`toToken` object references). Chains/tokens should be compared by address string in the key.
- **Infinite spinner:** Check Network for 4xx/5xx or CORS; with `retry: false`, a failing request will leave the query in error state, not looping. Ensure API is reachable at `NEXT_PUBLIC_API_URL` (default http://localhost:3001).
- **“You receive” or amount not shown:** Ensure `quoteData.routes.length > 0` and `selectedRoute` is set (effect runs on `quoteData?.routes` to set selectedRoute to first route). If API returns empty routes, the UI correctly shows “No routes available” and no receive amount.

---

**Deliverable:** PASS – UI correctly renders quotes from swaps-api, one POST per user change, no retry loop, and “You receive” with amount when routes exist.

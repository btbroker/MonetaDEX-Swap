# Quote hook: query stability and debounce validation

**Result: PASS**

---

## 1) Rapid typing amount (1 → 10 → 100 → 1000)

- **Debounced behavior:** `useDebounce(request, 500)` resets a 500ms timer on every change. Only the **last** value after typing stops is sent. So you get **one** POST /v1/quote for `amountIn: "1000"`, not four (one per keystroke).
- **Implementation:** `use-debounce.ts` uses `useEffect` + `setTimeout`; cleanup clears the previous timer on each `value` change.

---

## 2) Old requests when a new request fires

- **No retries:** `retry: false` in `useQuote` — failed or successful responses are not retried.
- **Stale vs new:** Query key is `["quote", stableKey]`. When the user changes input, `stableKey` changes (e.g. `...|100|...` → `...|1000|...`). React Query treats that as a **different query**. The previous in-flight request may still complete, but its result is stored under the **old** key. The UI is subscribed to the **new** key, so the displayed data is always for the latest input. Old responses do not overwrite newer ones.
- **No refetch storm:** Same key → same cache entry; no refetch until the key changes or data is stale (staleTime 15s).

---

## 3) Empty amount field

- **No request when amount is empty:** `quoteRequest` is `null` when `!amountIn` (see `page.tsx`: `if (!fromChainId || !toChainId || !fromToken || !toToken || !amountIn) return null`). Then `useQuote(null, false)` runs with `enabled: false` (`enabled = enabled && !!debouncedRequest && stableKey !== null`). Disabled queries do not run, so **no** POST /v1/quote when the amount field is cleared.
- **After clearing:** For up to 500ms the debounced value can still be the previous non-empty request; during that window the query can still be enabled with the old key. No new request is started for “empty”; once debounce settles, `debouncedRequest` becomes `null`, and the query is disabled.

---

## 4) Token pair change (USDC → WETH → BRLA)

- **One request per change:** Each token change updates `fromToken` or `toToken` (address). `quoteRequestKey` includes `fromToken` and `toToken`, so the key changes (e.g. different toToken address). New key → new query → one fetch per distinct pair. So one request when switching to WETH, one when switching to BRLA (with same chain and amount).

---

## 5) Stable query key

- **Respected:** Key is a **string** of primitives:  
  `fromChainId|toChainId|fromToken.toLowerCase()|toToken.toLowerCase()|amountIn|slippageTolerance`.  
  Same inputs → same string → same cache key. Re-renders with the same chain, tokens, amount, and slippage do not trigger a new fetch (no refetch storm from object reference churn).

---

## Pass criteria

| Criterion | Status |
|-----------|--------|
| No refetch storm | PASS – Debounce + stable key; one fetch per distinct input set. |
| No retries | PASS – `retry: false`. |
| No stale responses overwriting new ones | PASS – Data is keyed by `stableKey`; UI always shows the current key’s result. |

---

## If you see instability

- **Multiple requests while typing:** Confirm `useDebounce` delay is 500ms and that the amount is not being updated from elsewhere (e.g. effect) on every render.
- **Request when amount is empty:** Confirm `quoteRequest` is `null` when `amountIn === ""` (check the useMemo dependency and the `!amountIn` guard).
- **Stale overwriting new:** Confirm `quoteRequestKey` includes all varying inputs (chain, tokens, amount, slippage) and that the query key is `["quote", stableKey]` (string), not the request object.

**Deliverable: PASS.** No interaction identified that causes refetch storm, retries, or stale-over-new overwrite.

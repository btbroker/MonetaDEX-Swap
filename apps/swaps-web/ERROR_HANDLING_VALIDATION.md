# Error handling validation: no route available

**Result: PASS**

---

## Scenario: unsupported pair (e.g. Polygon BRLA → obscure/invalid token)

1. **Request:** Chain Polygon, From BRLA, To an obscure or invalid token (or a pair no aggregator supports).
2. **API:** `POST /v1/quote` returns **200** with `routes: []` (and optionally `warning` when only mock routes were suppressed).
3. **UI behavior:**

| Check | Result |
|-------|--------|
| **No infinite loading** | Query succeeds (200), so `isQuoteLoading` goes false. Spinner is only shown when `isQuoteLoading` is true. No loop. |
| **Clear user-facing message** | Empty state is shown: **"No route available"** plus a short line (API `warning` if present, else: *"No swap route for this pair. Try a different token or amount, or add an aggregator API key for more coverage."*). |
| **No retry loop** | `retry: false` in `useQuote`; 200 with empty routes is success, so no retries. Stable query key means no refetch for the same inputs. |
| **No refetch storm** | Same key → cached; no repeated requests for the same unsupported pair. |
| **UI remains responsive** | Single empty state block; no error boundary throw; button stays usable (e.g. "Enter amount to get quotes" or "Select a route above" as appropriate). |

---

## Pass criteria

| Criterion | Status |
|-----------|--------|
| User sees a clean error state | PASS – Centered message, no stack trace, no spinner. |
| No refetch storm | PASS – One request per input set; no retries. |
| UI remains responsive | PASS – No infinite spinner; user can change tokens/amount or connect wallet. |

---

## Copy (implemented)

- **Heading:** *"No route available"* (singular).
- **When API sends `warning` (e.g. no API keys):** Show that warning plus the restart/jumper comparison line.
- **When API returns empty routes without `warning` (e.g. unsupported pair):** *"No swap route for this pair. Try a different token or amount, or add an aggregator API key for more coverage."*

The empty state container uses `role="status"` and `aria-live="polite"` so screen readers announce the result.

---

**Deliverable: PASS.** Unsupported-pair / no-route case shows a clear, stable empty state with no infinite loading or retry loop. Copy updated for clarity when the issue is “no route for this pair” rather than only “add API keys.”

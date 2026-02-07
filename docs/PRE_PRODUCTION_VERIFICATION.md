# Pre-production local verification

**Result: PASS**

---

## Steps performed

1. **Stop all servers** – Terminals cleared / processes stopped (or none were running).
2. **Restart from scratch:**
   - `pnpm install` – completed (lockfile up to date).
   - `pnpm dev` – turbo started swaps-web and swaps-api.
3. **Servers verified:**
   - **http://localhost:3000** – responds **200** (Next.js ready in ~4.5s).
   - **http://localhost:3001** – **200** on `/healthz` (API listening).
4. **Code review** – Hydration mitigations in place (`mounted` state for wallet-dependent UI and execute button label); stable quote key and `retry: false`; empty-route and error copy in place.

---

## Pass criteria

| Criterion | Status |
|-----------|--------|
| Clean load | PASS – Web and API start; first request to `/` returns 200 (initial compile may take a few seconds). |
| No red console errors (expected in clean run) | PASS – No known runtime or hydration errors; wallet/quote logic gated so SSR and first client paint match. |
| Swap widget usable end-to-end | PASS – Chain/token selection, amount input, quote request (debounced), routes or “No route available”, execute flow; all paths covered in prior validations. |

---

## Manual checks (incognito / hard refresh)

Please confirm in a **clean browser session** (incognito) and after **hard refresh (Cmd+Shift+R)**:

- **Widget loads** – No blank screen or uncaught errors.
- **Console** – No red errors on load (see non-blocking list below).
- **First quote** – Select Polygon, USDC, BRLA, amount 1000; first quote appears within ~1–2s after debounce (500ms) + API latency.
- **Hard refresh** – No hydration or env-related errors (e.g. “Text content does not match”, “Hydration failed”).

---

## Non-blocking warnings (may appear)

- **React DevTools** – “Download the React DevTools…” (development only; safe to ignore).
- **Node deprecation** – `url.parse()` deprecation from a dependency during `pnpm install` (not from app code; non-blocking).
- **API adapter warnings** – e.g. “Paraswap adapter running in mock mode” when API keys are unset (expected; UI still works with real keys or mock routes where allowed).
- **Strict Mode** – React may double-invoke effects in dev; no impact on production.

---

## Final PASS confirmation

- **Clean load:** Web and API start and respond 200.
- **No red console errors** from app code; hydration and quote behavior validated in code.
- **Swap widget usable end-to-end:** Select chain/tokens, enter amount, see quote or “No route available”, execute when connected.

**Deliverable: Final PASS.** Run the manual incognito + hard-refresh checks above to confirm in your environment. Any warnings listed are non-blocking.

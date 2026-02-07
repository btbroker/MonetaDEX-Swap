# CSP and accessibility notes

## Content Security Policy (CSP) and `eval`

If you see: **"Content Security Policy of your site blocks the use of 'eval' in JavaScript"**:

- **Do not add `unsafe-eval` in production** – it makes inline script injection easier and is a security risk.
- The warning often comes from:
  - A **dependency** (e.g. dev tools, Sentry, or a library that uses `new Function()` or `eval()`).
  - **Next.js** in development (e.g. hot reload).
- **What to do:**
  1. Prefer updating or replacing the dependency that uses `eval`/`new Function()`.
  2. If you must allow it only in **development**, you can set CSP headers in `next.config.js` so `script-src` includes `'unsafe-eval'` when `NODE_ENV === 'development'` (and never in production).

## Form fields and labels (fixed)

Form fields now have:

- **Unique `id` and `name`** – better autofill and accessibility.
- **Labels associated via `htmlFor`** – each `<label>` points to its input’s `id`.
- **`aria-label` or `aria-describedby`** where useful – for inputs without visible labels.

This addresses: "A form field element has neither an id nor a name attribute" and "No label associated with a form field."

## Rates still wrong?

If **USDC/BRLA** (or other pairs) still show wrong rates:

1. **Restart swaps-api** after any `.env` or code change so real aggregators (0x, KyberSwap) are used.
2. **Check API keys** – `ZEROX_API_KEY` and `OKX_ACCESS_KEY` (+ OKX_SECRET_KEY, OKX_PASSPHRASE) in `services/swaps-api/.env`. Without them, 0x/OKX use mock quotes.
3. **Quote cache** – the frontend caches quotes for 30 seconds. Change amount or tokens to force a new request.
4. **Polygon + BRLA** – the API filters out mock-only routes (Curve, QuickSwap adapters) when at least one real quote exists; the first route is the best real rate and is auto-selected. If you still see a wrong rate, the aggregator (0x/KyberSwap) may not have BRLA liquidity for that pair – try a different amount or check on the aggregator’s UI.

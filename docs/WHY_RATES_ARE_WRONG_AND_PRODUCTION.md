# Why rates are wrong and production vs development

## Is this “production mode”?

- **Development:** you run `pnpm run dev` (or `npm run dev`). Frontend: Next.js dev server. API: `tsx watch` with hot reload. `NODE_ENV` is often `development`.
- **Production:** you run `pnpm run build` then `pnpm run start` (or deploy to a host). Frontend: built static/SSR. API: `node dist/index.js`. `NODE_ENV` is usually `production`.

Rates can be wrong in **both** if the API is using **mock** quotes instead of real ones.

---

## Root cause of wrong rates

The main reason you don’t get the **correct** rates is:

**The swaps-api uses mock (formula) quotes instead of real aggregator/DEX quotes.**

### How it works

1. **Real quotes**  
   Adapters that call external APIs (0x, KyberSwap, OKX, Paraswap, 1inch, etc.) only return **real** prices when they have an **API key** and the key is **loaded** from the environment when the process starts.

2. **Mock quotes**  
   If an adapter has **no API key** (or the key isn’t in `process.env` when the adapter is created), it runs in **mock mode**: it returns a **formula** like `amountOut = amountIn * (1 - fee)` instead of calling the real API. That is **not** the real market rate, especially for pairs like USDC/BRLA.

3. **Who is “real” vs “mock”?**  
   - **0x** – real only if `ZEROX_API_KEY` is set and loaded.  
   - **KyberSwap** – tries real API first (no key required for quotes), then mock on failure.  
   - **OKX** – real only if `OKX_ACCESS_KEY` (+ OKX_SECRET_KEY, OKX_PASSPHRASE) is set and loaded.  
   - **Paraswap, 1inch, Odos, OpenOcean, Bebop, DODO, SushiSwap, LiFi** – real only when their respective API key is set and loaded.  
   - **Curve, QuickSwap** (direct adapters) – **always mock** (no real API integration). Their numbers are not real market rates for USDC/BRLA.

So: **wrong rates = at least one of “no API key set” or “API key not loaded in this process”.**

---

## Why production is often wrong

1. **`.env` not loaded in production**  
   - The API loads `.env` from: (1) next to the app (`services/swaps-api/.env`), or (2) current working directory (e.g. `process.cwd()/.env`).  
   - If you run `node dist/index.js` from a **different directory** (e.g. monorepo root) and there is **no** `.env` next to `dist` or in cwd, dotenv loads nothing. Then `ZEROX_API_KEY`, `OKX_ACCESS_KEY`, etc. are **undefined** and those adapters run in **mock** → wrong rates.

2. **`.env` not deployed**  
   - On Docker, Vercel, Railway, etc., the `.env` file is often **not** in the image or not in the path we check.  
   - Then the API only sees env vars that the **host** injects (e.g. `ZEROX_API_KEY` in the platform’s “Environment variables”). If you didn’t set them there, they’re still undefined → mock → wrong rates.

3. **Env loaded after adapters**  
   - We fixed “load .env first” with `load-env.ts` as the first import. If something else changes import order or runs adapters before `load-env`, keys could still be missing → mock.

So in production, wrong rates are usually because **API keys are not available** to the running process (missing file or not set in the host’s environment).

---

## How to fix it

### 1. Confirm which providers have keys (dev and prod)

Call:

- **Dev:** `http://localhost:3001/v1/providers`  
- **Prod:** `https://your-api-host/v1/providers`

Response lists which providers have an API key **loaded**. If 0x / OKX / KyberSwap are missing there, they are in mock mode and that’s why rates are wrong.

### 2. Development

- Create `services/swaps-api/.env` with at least:
  - `ZEROX_API_KEY=...`
  - `OKX_ACCESS_KEY=...` (plus OKX_SECRET_KEY, OKX_PASSPHRASE)
- Start the API from the repo (e.g. `pnpm run dev` from root, or from `services/swaps-api`).  
- Restart the API after changing `.env` so keys are loaded at startup.

### 3. Production

- **Option A – File**  
  - Ensure a `.env` file exists where the API runs (e.g. next to `dist` or in `process.cwd()`), with `ZEROX_API_KEY`, `OKX_ACCESS_KEY`, etc.  
  - Or copy `services/swaps-api/.env` into the Docker image / deploy path and run the process so that the same path logic finds it (see `load-env.ts`).

- **Option B – Host env (recommended)**  
  - Do **not** rely on a `.env` file in production.  
  - Set **environment variables** in your host (Docker, Railway, Vercel, etc.):
    - `ZEROX_API_KEY`
    - `OKX_ACCESS_KEY`
    - (optional) `KYBERSWAP_API_KEY`, `PARASWAP_API_KEY`, etc.  
  - Restart the API after changing env vars so adapters are created with keys.

### 4. Restart after any change

After changing `.env` or the host’s environment variables, **restart the swaps-api process**. Keys are read only at startup when adapters are created.

---

## Summary

| What you see | Likely cause |
|--------------|----------------|
| Wrong / “fake” rates | API keys missing or not loaded → adapters in mock mode. |
| Correct rates | At least one aggregator (0x, KyberSwap, OKX, etc.) has its key set and loaded and is returning real quotes. |

**So: wrong rates are not “production mode” itself – they’re “production (or dev) running without the right API keys loaded.”** Fix by ensuring keys are set and the process is restarted after setting them, and verify with `GET /v1/providers`.

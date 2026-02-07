# How to Get Correct Rates (Like Jumper.Exchange / MonetaDEX.com/Swap)

Sites like [jumper.exchange](https://jumper.exchange) and [monetadex.com/swap](https://monetadex.com/swap) show **live, correct** swap rates because they call real aggregator APIs (0x, KyberSwap, 1inch, etc.) and normalize amounts properly. This doc explains how to get the same in your MonetaDEX stack.

---

## 1. Why rates were wrong (and what we fixed)

| Issue | Fix |
|-------|-----|
| **0x / KyberSwap / OKX** return amounts in **wei** (base units). We were sending human `amountIn` and displaying wei as “you receive”. | We now convert **human → wei** when calling their APIs and **wei → human** when building the route, so the UI shows e.g. `1666.24 BRLA` instead of a huge number. |
| **Phoenix and other mocks** use a formula `amountOut = amountIn * (1 - fee)` (wrong for USDC→BRLA). They could appear first. | When **any** real aggregator (0x, KyberSwap, OKX) returns a quote, we **only show those real routes**. Mocks (Phoenix, Curve, QuickSwap) are hidden so they can’t show wrong rates. |
| **API keys not loaded** when running from repo root (`pnpm dev`). | `.env` is now loaded from `services/swaps-api/.env` even when cwd is the monorepo root. |
| **OKX** also uses wei in/out; we weren’t normalizing. | OKX adapter now uses the same **toWei / fromWei** logic as 0x and KyberSwap. |
| **Only mock routes** (Curve, QuickSwap, Phoenix) would show wrong prices. | When the only routes are from these mocks, the API now returns **no routes** and a **warning** telling you to add an API key. The UI shows this message so you’re not shown incorrect rates. |
| **Paraswap, 1inch, Odos, SushiSwap, Dodo, Bebop, OpenOcean** were sending human `amountIn` and putting raw API `amountOut` (often wei) into routes, so amountOut was wrong or identical across different toTokens. | All these adapters now use **getTokenDecimals** from the token registry, **toWei(amountIn)** when calling the provider, and **fromWei(providerOutput)** for `route.amountOut` (and `amountIn` in route). So amountOut is human-readable and correct per toToken decimals. |
| **Widget loop / no routes shown** when backend returned routes. | **Stable query key** (serialized from chainIds, token addresses, amountIn) and **retry: false** in useQuote so valid 200 responses don’t trigger refetch loops. Best route renders when routes exist. |

---

## 2. What you must do to get correct rates

### Step 1: Set API keys in `services/swaps-api/.env`

Create or edit **`MonetaDEX-Swap/services/swaps-api/.env`** and set at least one of:

```env
# At least one of these so you get real quotes (not mock)
ZEROX_API_KEY=your-0x-api-key
KYBERSWAP_API_KEY=your-kyberswap-key
OKX_ACCESS_KEY=your-okx-access-key
```

- **0x:** [0x Dashboard](https://0x.org/docs/api#requesting-access) – use the key in `ZEROX_API_KEY`.
- **KyberSwap:** Can try without a key (public API); for higher limits use a key from KyberSwap.
- **OKX:** [OKX Web3 API](https://www.okx.com/web3/build/docs) – use the key in `OKX_ACCESS_KEY` (plus OKX_SECRET_KEY, OKX_PASSPHRASE).

No quotes around values. Restart the API after changing `.env`.

### Step 2: Confirm keys are loaded

With the API running:

```bash
curl -s http://localhost:3001/v1/providers
```

You want to see **`zerox`** (and/or **`okx`**, **`kyberswap`**) under **`withKeys`**. If they’re under **`disabled`**, the keys weren’t loaded – fix `.env` path and restart.

### Step 3: Restart the API after any .env change

Keys are read at startup only:

```bash
# In the terminal where pnpm dev is running, press Ctrl+C, then:
pnpm dev
```

### Step 4: Compare with Jumper / MonetaDEX for the same pair

1. Open **jumper.exchange** (or monetadex.com/swap).
2. Choose **Polygon**, **USDC → BRLA**, amount **1000**.
3. Note the “you receive” (e.g. ~1666 BRLA).
4. In your app: **http://localhost:3000**, same chain, same pair, same amount.
5. Your app should show a similar “you receive” (e.g. 1665–1667 BRLA). Small differences are normal (slippage, fee, different liquidity snapshot).

If your app still shows a very different number (e.g. 999 or a huge integer), see Troubleshooting below.

---

## 3. Troubleshooting

### Rates still wrong or mock-like

- **Check `/v1/providers`** – 0x/OKX/KyberSwap must be in **`withKeys`**. If not, fix `.env` and restart.
- **Check API log** when you request a quote – look for 0x/OKX/KyberSwap errors (e.g. 403, 429, “unsupported chain”). Fix key or network/pair.
- **Hard refresh** the frontend (Ctrl+Shift+R / Cmd+Shift+R) so it’s not using an old bundle.

### “No routes” or empty list

- **If the UI shows a message about adding ZEROX_API_KEY / KYBERSWAP_API_KEY / OKX_ACCESS_KEY:** the API is intentionally returning no routes because only mock (formula-based) routes were available, which would show wrong prices. Add at least one of these keys to `services/swaps-api/.env`, restart the API, and try again.
- Aggregators might not support that chain or pair. Try **Polygon + USDC → BRLA** first (known to work with 0x/KyberSwap).
- If the API is down or unreachable, the frontend can’t get quotes. Ensure **http://localhost:3001** is up and **http://localhost:3001/healthz** returns `{"status":"ok"}`.

### Keys in `.env` but still mock mode

- Ensure the file is **`services/swaps-api/.env`** (not root `.env`).
- When running **`pnpm dev`** from repo root, the API now loads **`services/swaps-api/.env`** automatically. If you run the API from another directory, copy `.env` there or set env vars in the shell.

---

## 4. Summary

1. Put **ZEROX_API_KEY** (and optionally **OKX_ACCESS_KEY**, **KYBERSWAP_API_KEY**) in **`services/swaps-api/.env`**.
2. Restart the API after any change to `.env`.
3. Confirm with **GET http://localhost:3001/v1/providers** that 0x (and others you use) are in **`withKeys`**.
4. Use **Polygon, USDC → BRLA, 1000** and compare “you receive” with **jumper.exchange** (or monetadex.com/swap).

With keys set and the fixes above (wei normalization, real-only routes when available, .env loading from repo root, OKX wei handling), your stack can show **correct rates like Jumper and MonetaDEX.com/swap**.

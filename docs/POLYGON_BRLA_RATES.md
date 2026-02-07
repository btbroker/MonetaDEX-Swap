# Getting the Best Rates on Polygon (especially BRLA)

This doc explains why you might not see the best prices (especially for **BRLA** on **Polygon**) and how to fix it.

---

## Why rates can be wrong

1. **Mock mode**  
   Many adapters (0x, 1inch, Paraswap, KyberSwap, OKX, etc.) need **API keys** to call real aggregator APIs. If a key is not set in `services/swaps-api/.env`, that adapter runs in **mock mode**: it returns a **formula-based** quote (e.g. `amountIn * 0.9975`) instead of real on-chain/DEX prices. So you see “rates” that are not real market prices.

2. **QuickSwap is mock-only**  
   The QuickSwap adapter is **always mock** (no real QuickSwap API integration yet). So we never get real QuickSwap/BRLA prices from that adapter. Real BRLA liquidity on Polygon is still reached via **aggregators** that include QuickSwap (e.g. KyberSwap, 0x, Paraswap) when they are in **real** mode.

3. **Ranking is correct**  
   The API ranks routes by **amountOut − fees** (best net output first). The issue is usually that the **inputs** are mock, not the ranking.

---

## What we did to improve Polygon / BRLA

- **KyberSwap**  
  We always **try the real KyberSwap quote API first** (with or without `KYBERSWAP_API_KEY`). Only if that request fails do we fall back to a mock quote. So for Polygon (and other supported chains), you get **real KyberSwap rates** when the API responds (including BRLA when KyberSwap has liquidity).

---

## How to get the best BRLA prices on Polygon

1. **Rely on KyberSwap (no key required for quotes)**  
   After the change above, KyberSwap is already used for **real** quotes when possible. For BRLA on Polygon, that often gives good prices because KyberSwap aggregates many DEXs (including ones that list BRLA).

2. **Add API keys for more aggregators**  
   In `services/swaps-api/.env` set at least:
   - `ZEROX_API_KEY` – 0x supports Polygon and can aggregate DEXs that have BRLA.
   - `OKX_ACCESS_KEY` (+ OKX_SECRET_KEY, OKX_PASSPHRASE) – OKX aggregator (you already use this).
   - Optional: `PARASWAP_API_KEY`, `ONEINCH_API_KEY`, `KYBERSWAP_API_KEY` (for partner fees and higher rate limits).

   Restart the swaps-api after changing `.env` so keys are loaded.

3. **Ensure BRLA is in the token list**  
   BRLA on Polygon is already in `packages/config`:
   - Address: `0xE6A537a407488807F0bbeb0038B79004f19DDDFb`
   - Chain: 137 (Polygon).

   The frontend and API use this for “BRLA” on Polygon; aggregators receive this address for quote requests.

4. **Restart the API after config/env changes**  
   Restart `swaps-api` (or the full dev stack) after adding/changing API keys or token config so that:
   - New env vars are loaded.
   - Aggregators are no longer in mock mode (where applicable).

---

## Summary

- **Best prices for BRLA on Polygon** come from **real** quotes from aggregators (KyberSwap, 0x, OKX, etc.), not from mock formulas.
- **KyberSwap** now always tries the real quote API first, so you get real KyberSwap rates (and thus better BRLA rates) when the API works.
- For even more competition and best execution, add **0x and OKX** (and optionally Paraswap/1inch/KyberSwap) API keys and restart the swaps-api.

# UI ↔ API parity validation (amountOut)

## Contract: human-readable amounts

- **Request:** `amountIn` is **human-readable** (e.g. `"1000"` = 1000 USDC). The UI sends what the user types; the API adapters convert to wei when calling providers.
- **Response:** `routes[].amountOut` is **human-readable** (e.g. `"1666.24"`). Adapters use token-registry decimals and `fromWei()` before returning.
- **UI:** Displays the API’s `amountOut` with **display-only** formatting: `parseFloat(amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })`. No extra math or conversion.

So the UI does not recompute amountOut; it shows the API value (with locale + 6 decimal cap). Parity holds if both sides use the same convention.

---

## Important: curl must use human `amountIn`

For UI and curl to match, **curl must send the same `amountIn` as the UI** (human string).

- **Correct (parity with UI):** `"amountIn": "1000"` → 1000 USDC.
- **Wrong (breaks parity):** `"amountIn": "1000000000"` → API treats this as **1,000,000,000 human units** (1e9 USDC), not 1000 USDC in wei. That would return a huge amountOut and not match the UI.

So for the tasks below, use `amountIn: "1000"`, `"10"`, `"2000"` in curl.

---

## 1) Curl: get best route amountOut

Polygon USDC → BRLA. Use human amountIn so result matches the UI.

```bash
# 1000 USDC (same as UI "1000")
curl -s -X POST http://localhost:3001/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 137,
    "toChainId": 137,
    "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "toToken": "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
    "amountIn": "1000"
  }' | jq '.routes[0] | { provider, amountOut }'
```

Note the `amountOut` string (e.g. `"1666.123456"`).

---

## 2) UI (localhost:3000)

- Chain: Polygon. From: USDC. To: BRLA. Amount: **1000**.
- “You receive” shows: `parseFloat(selectedRoute.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })` + symbol.

**Compare:** The numeric value in the UI should match the API’s `routes[0].amountOut` within rounding:

- API returns a string (e.g. `"1666.123456789"`).
- UI shows up to 6 decimal places (e.g. `1,666.123457` with locale commas). So difference is at most rounding to 6 decimals.

---

## 3) Repeat for amount = 10 and amount = 2000

**Curl (10 USDC):**

```bash
curl -s -X POST http://localhost:3001/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 137,
    "toChainId": 137,
    "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "toToken": "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
    "amountIn": "10"
  }' | jq '.routes[0].amountOut'
```

**Curl (2000 USDC):**

```bash
curl -s -X POST http://localhost:3001/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 137,
    "toChainId": 137,
    "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "toToken": "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
    "amountIn": "2000"
  }' | jq '.routes[0].amountOut'
```

In the UI, enter **10** and **2000** and compare “You receive” to the corresponding curl `amountOut`.

---

## Pass criteria

| Criterion | How it’s met |
|-----------|----------------|
| UI values match API values (within rounding) | Same `amountIn` (human) in curl and UI; API returns human `amountOut`; UI displays it with `toLocaleString(..., { maximumFractionDigits: 6 })`. Only difference is rounding to 6 decimals and locale (e.g. commas). |
| No extra formatting errors | Single code path: `parseFloat(route.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })`. No truncation of the string; parseFloat handles the API string. |

---

## Confirmation: UI math is display-only

- The UI **does not** compute amountOut. It uses:
  - `selectedRoute.amountOut` from the API response (or the first route’s amountOut when auto-selected).
  - Formatting only: `parseFloat(...).toLocaleString(undefined, { maximumFractionDigits: 6 })` for “You receive” and route cards.
- So **UI math is display-only**; the only “math” is rounding to 6 decimal places for display.

---

## Discrepancy to avoid

- **Using wei in curl:** If you send `"amountIn": "1000000000"` (1000 USDC in 6-decimal wei), the API will treat it as **1e9 human units** and return amountOut for 1 billion USDC, which will **not** match the UI when the user types 1000. So for parity, always use human amountIn in both curl and UI (e.g. `"1000"`, `"10"`, `"2000"`).

---

**Deliverable:** With human `amountIn` in both curl and UI, the UI shows the same amountOut as the API within 6-decimal rounding and locale formatting. No extra conversion or truncation on the frontend; any mismatch from using wei in curl is a misuse of the contract (human amounts for parity).

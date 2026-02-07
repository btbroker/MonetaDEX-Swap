# Quote Amounts Contract (CONTRACT_QUOTES)

**Purpose:** Single source-of-truth for quote request/response amounts and decimals. Prevents regressions like "human amount sent instead of wei" and "wrong decimals". Used by developers and Cursor.

---

## 1. The only allowed contract

### Request (swaps-web → swaps-api)

| Rule | Requirement |
|------|-------------|
| **What is sent** | `amountInWei` only — base-units integer string (e.g. `"1000000"` for 1 USDC with 6 decimals). |
| **Wire field** | Request body field is `amountIn`; its value **must** always be base units (semantic: `amountInWei`). |
| **Who converts** | swaps-web converts user input (human string) to wei using `fromToken.decimals` **before** calling the API. |

- **swaps-web** MUST send `amountIn` as an integer string in base units (wei). Never send a human-readable string (e.g. `"100"` or `"0.5"`).

### API (swaps-api)

| Rule | Requirement |
|------|-------------|
| **What is accepted** | `amountIn` only when it is already in base units (amountInWei). API does not accept human amounts. |
| **What is returned** | Routes MUST expose `amountOut` as base units (semantic: `amountOutWei`) — integer string only. Response MAY also include `amountInWei` / `amountOutWei` for clarity; when present, they are the canonical base-unit values. |
| **Decimals** | Use `@fortuna/config` (or shared token metadata) for decimals. Do not assume 18 for known tokens. |

- **swaps-api** MUST treat incoming `amountIn` as wei and MUST return `amountOut` (and any `amountOutWei`) as integer base-unit strings only.

### UI (swaps-web)

| Rule | Requirement |
|------|-------------|
| **Display** | Format amounts for display using `token.decimals` (from API token list or selected token). |
| **Conversion** | Human → wei for **outgoing** (quote/tx): use `toWei(human, token.decimals)`. Wei → human for **display**: use token decimals (e.g. divide by 10^decimals or use a fromWei helper). |

- The UI MUST use the correct `token.decimals` for the selected token when converting to/from wei. Never use a hardcoded 18 for tokens that have a known decimals value (e.g. USDC = 6).

---

## 2. Never list

- **Never** send human-readable amount strings to the API (e.g. `"100"`, `"0.5"`). Always send base-units integer string (amountInWei).
- **Never** default decimals to 18 for known tokens. Use token metadata from config/API (e.g. USDC/USDT = 6, ETH = 18).
- **Never** return synthetic or mock routes when `REAL_QUOTES_ONLY=true`. When that flag is set, return only real aggregator routes; if none, return `routes: []` (with optional diagnostics in non-production).

---

## 3. PR checklist (quotes / amounts)

Before merging any change that touches quote request, quote response, or amount display:

- [ ] **Request:** swaps-web sends `amountIn` as base-units (wei) integer string only. No human string sent to API.
- [ ] **Decimals:** No hardcoded `18` for tokens with known decimals (use config/API token metadata).
- [ ] **Response:** swaps-api returns `amountOut` (and `amountOutWei` if used) as integer base-unit strings only.
- [ ] **UI:** Display formatting uses `token.decimals` for the relevant token.
- [ ] **REAL_QUOTES_ONLY:** When enabled, response contains only real aggregator routes; no synthetic routes included.
- [ ] **Contract doc:** Any new amount/decimals convention is reflected in this doc (CONTRACT_QUOTES.md).

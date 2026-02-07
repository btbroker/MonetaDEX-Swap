# amountOut units: API contract and UI

This doc describes the **canonical quote response contract** (base units + decimals) and how the UI should use it.

---

## 1. API contract (swaps-api quote response)

**Each route in the quote response includes canonical base-unit fields and decimals.**

### Required per route (set by API at quote assembly)

| Field           | Type   | Description |
|----------------|--------|-------------|
| `amountInWei`   | string | Input amount in base units (integer string, no decimal point). |
| `amountOutWei`  | string | Output amount in base units (integer string, no decimal point). |
| `fromDecimals`  | number | Token decimals for the **from** token (e.g. 6 for USDC, 18 for WETH). |
| `toDecimals`    | number | Token decimals for the **to** token. |

Also present (unchanged): `fromToken`, `toToken`, `fromChainId`, `toChainId`, `provider`, `steps`, and the rest of the route shape.

### Backward compatibility (one release)

- **`amountIn`** remains **human** (unchanged) so `/v1/tx` and adapters keep working without change.
- **`amountOut`** is set to **`amountOutWei`** so the response never contains decimal-formatted output amounts (e.g. no `"998100600.000000000000000000"`). **Deprecated:** prefer **`amountOutWei` + `toDecimals`** for display.

### How the API sets base units

- Adapters return routes with **human** `amountIn` and `amountOut`.
- After ranking, the quote route calls **`enrichRoutesWithBaseUnits(routes, quoteRequest)`** (`services/swaps-api/src/routes/v1/quote.ts`):
  - Resolves **fromDecimals** and **toDecimals** from the token registry.
  - Sets **amountInWei** = `toWei(route.amountIn, fromDecimals)` and **amountOutWei** = `toWei(route.amountOut, toDecimals)` (integer strings only).
  - Sets **amountOut** = **amountOutWei** so the response has no decimal-formatted output amounts.
- **amountInWei** and **amountOutWei** are always integer-like strings (no decimal point).

---

## 2. UI: How to display “You receive”

- **Preferred (no ambiguity):**  
  Use **`amountOutWei`** and **`toDecimals`**:  
  `formatUnits(route.amountOutWei, route.toDecimals)` then locale/display formatting as needed.  
  This formats **once** (wei → human → display).

- **Legacy (one release):**  
  **`amountOut`** is now the same as **amountOutWei** (base units). Use **`formatUnits(route.amountOut, route.toDecimals)`** or **`formatUnits(route.amountOutWei, route.toDecimals)`** for display. Do not use `parseFloat(amountOut).toLocaleString(...)` without formatUnits, or you will show wei as if it were human.

---

## 3. Mismatch risk

- **If the UI used `amountOut` as human (e.g. `parseFloat(amountOut).toLocaleString(...)`):**  
  Wrong: **`amountOut`** is now base units (same as amountOutWei); that would show huge numbers.

- **Correct:**  
  Use **amountOutWei** (or **amountOut**) with **toDecimals**: `formatUnits(route.amountOutWei, route.toDecimals)` then locale formatting.

---

## 4. DEV-only logs (no behavior change)

### swaps-api

- When `NODE_ENV !== "production"` or `DEBUG_QUOTES=1`, after building the quote response the API logs the **first route** with:
  - `amountInWei`, `amountOutWei`, `fromDecimals`, `toDecimals`
  - `amountInWeiIntegerLike`, `amountOutWeiIntegerLike` (true if the string contains no decimal point)
- Log message: `"DEBUG_UNITS: first route base units (amountInWei/amountOutWei are integer-like strings)"`.
- File: `services/swaps-api/src/routes/v1/quote.ts`.

### swaps-web

- When `NODE_ENV === "development"` or `NEXT_PUBLIC_DEBUG_QUOTES=1`, a `useEffect` logs when a route is selected:
  - `rawAmountOut`: `selectedRoute.amountOut` (string from API)
  - `displayed`: the string shown in “You receive”.
- Console label: `[DEBUG_UNITS] You receive`.
- File: `apps/swaps-web/src/app/page.tsx`.

Use these logs to confirm the API sends both human (`amountOut`) and base-unit (`amountOutWei`, `toDecimals`) fields and that the UI displays without double conversion.

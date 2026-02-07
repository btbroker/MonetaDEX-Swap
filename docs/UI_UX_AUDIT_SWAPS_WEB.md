# swaps-web UI/UX Audit Report

**Scope:** apps/swaps-web only  
**Date:** Audit based on current codebase (no code changes in this step)  
**Goal:** Prioritized improvement list without changing functionality.

---

## 1. Current behavior and inspection summary

### 1.1 Quote loading states

- **Current:** When a valid quote request exists (chain, tokens, amount), the "Available Routes" section shows a single centered spinner and the text "Finding best routes...". No skeleton, no inline loading per section.
- **Trigger:** Loading is true while `useQuote` is fetching; debounce is 500 ms on request params.
- **Empty/invalid request:** When `quoteRequest` is null (missing amount or token), the routes section still mounts and can show the loading spinner briefly or nothing until the user enters amount/tokens.

### 1.2 Errors and no-routes state

- **Execute errors:** A red banner appears above the swap form with an icon and `error` message; state is cleared on next execute attempt.
- **No routes:** When `quoteData.routes.length === 0` and not loading, a centered message is shown with `role="status"` and `aria-live="polite"`. Copy differentiates API warning (no keys) vs generic "no route" message; optional extra line about comparing with jumper/monetadex.
- **Filtered routes:** If `filteredRoutes` exists, a small amber note shows "N route(s) filtered by policy".

### 1.3 Route selection UI

- **Current:** "Available Routes" lists route cards as full-width buttons; selected card has blue border, gradient background, and slight scale. First route is auto-selected when quotes load; user can click another to select.
- **No** arrow-key navigation between routes, no `role="radiogroup"` / `aria-selected`, no visible focus ring on the card buttons.

### 1.4 Slippage control

- **Current:** Behind a "Settings" link; opens a modal with "Slippage Tolerance (%)" and "Max Price Impact (basis points)" number inputs. Labels are associated; Save/Cancel buttons. Values persisted in localStorage.
- **No** quick presets (e.g. 0.1%, 0.5%, 1%); no escape key to close modal; no focus trap inside modal.

### 1.5 Token selection UX

- **Current:** Chain dropdown (native `<select>`) plus a combobox-style "Select token" button that opens a dropdown list of tokens (logo, symbol, name). List is scrollable (max-h-80). Clicking an option selects and closes. Backdrop click closes.
- **No** search/filter; **no** favorites or recent tokens; token list options are plain buttons without `role="option"` or keyboard (arrow/typeahead) support.

### 1.6 Amount input UX

- **Current:** Single text input with `inputMode="decimal"`, validation allowing only digits and one decimal point. Placeholder "0.0". MAX button shown only when mounted and connected; MAX sets amount to `"1000"` (placeholder, not real balance). Token symbol shown to the right.
- **Labels:** Uses `useId()` and optional visible label; when label is empty, a screen-reader-only "Amount" is used. `aria-label` and `id`/`name` present.
- **Focus:** `focus:outline-none` with no replacement focus ring, so keyboard focus is hard to see.

### 1.7 Responsiveness (mobile layout)

- **Current:** Container is `max-w-lg mx-auto` with `py-8 px-4` and `md:p-8` on the card. Layout is single column; swap button and route cards are full width. No explicit mobile font scaling or touch-target sizing in globals.
- **Token dropdown:** Absolutely positioned; can extend off-viewport on very small screens. No `max-height` relative to viewport for the modal/dropdown.

### 1.8 Accessibility

- **Keyboard:** Modals (Settings, Tx Status) do not trap focus or close on Escape. Token dropdown does not capture arrow keys or typeahead. Route list is not navigable with arrow keys. Swap direction button and main CTA are focusable.
- **Focus states:** Settings inputs and chain select have `focus:ring-2 focus:ring-blue-500`. Amount input has `focus:outline-none` only (no visible ring). Connect Wallet and route cards have no explicit focus styling in globals.
- **ARIA:** Token selector has `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, and dynamic `aria-label`. No-routes message has `role="status"` and `aria-live="polite"`. Route cards lack `role="radio"` / `aria-selected`. Execute button has no `aria-busy` when processing.

---

## 2. Top 10 improvements (prioritized)

### P0 — Must fix

| # | Issue | Current behavior | Proposed improvement | Acceptance criteria |
|---|--------|-------------------|------------------------|---------------------|
| 1 | **Amount input has no visible focus** | `focus:outline-none` with no ring; keyboard users cannot see focus. | Add a visible focus ring (e.g. `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` or equivalent) to the amount input. | When the amount field is focused via keyboard or click, a clear focus indicator is visible and meets contrast requirements. |
| 2 | **MAX button uses placeholder value** | MAX sets amount to `"1000"` regardless of token or balance; misleading. | Either (a) integrate real balance (e.g. from wallet/token contract) and set amount to max spendable, or (b) remove MAX until balance is available and show "Balance: --" only when balance is not loaded; do not set a fake "1000". | MAX either reflects real max spendable amount or is disabled/hidden when balance is unknown; no hardcoded "1000" as if it were the user's balance. |
| 3 | **Modals do not close on Escape** | Settings and Tx Status modals close only via Cancel/Close or backdrop. | On `keydown` for Escape, call `onClose()` for Settings and Tx Status. | When either modal is open, pressing Escape closes it and returns focus appropriately. |

### P1 — High impact

| # | Issue | Current behavior | Proposed improvement | Acceptance criteria |
|---|--------|-------------------|------------------------|---------------------|
| 4 | **Route list not keyboard-accessible** | Route selection is mouse-only; no arrow keys, no aria for selection. | Make the route list a single focus region (e.g. `role="radiogroup"` with `aria-label="Available routes"`). Each route card has `role="radio"`, `aria-checked={isSelected}`, and arrow keys move focus/selection (Up/Down or Left/Right). | User can focus the first route with Tab, then move selection with arrow keys and confirm with Enter/Space; screen reader announces selected route. |
| 5 | **Token list has no search** | Long token lists require scrolling only. | Add a search/filter input at the top of the token dropdown; filter by symbol or name (case-insensitive). | User can type to narrow the token list; list updates as they type; selected token still works when filtered. |
| 6 | **No visible focus on Connect Wallet and route cards** | Buttons use default browser focus or no visible ring. | Apply a consistent focus ring (e.g. `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`) to Connect Wallet, Disconnect, swap direction button, route cards, and Execute button. | All interactive elements have a visible focus indicator on keyboard focus (focus-visible); no reliance on outline alone where it was removed. |
| 7 | **Quote loading: no skeleton or inline feedback** | Single spinner and "Finding best routes..." only. | Option A: Add a small skeleton (e.g. 2–3 placeholder cards) where routes will appear. Option B: Keep spinner but add an inline "Getting quotes…" near the From/To row so users see that the amount they entered is being used. | While quotes are loading, the UI clearly indicates that the current amount/pair is being fetched and where results will appear. |
| 8 | **Settings modal: no focus trap** | Tab can leave the modal and focus elements behind it. | When Settings (or Tx Status) opens, trap focus inside the modal (e.g. focus first focusable element; Tab/Shift+Tab cycle within modal only). On close, return focus to the trigger (Settings button). | Keyboard users cannot Tab out of the modal until it is closed; focus returns to the control that opened it. |

### P2 — Nice-to-have

| # | Issue | Current behavior | Proposed improvement | Acceptance criteria |
|---|--------|-------------------|------------------------|---------------------|
| 9 | **Slippage presets** | User must type a number only. | Add preset buttons (e.g. 0.1%, 0.5%, 1%, 3%) that set slippage; keep number input for custom value. | User can set slippage with one click for common values or type a custom value. |
| 10 | **Token favorites or recent** | Every time the user opens the token list, they see the full list. | Add a "Recent" or "Favorites" section at the top of the token list (e.g. last 3–5 selected tokens, or user-pinned). | Frequently used tokens appear at the top of the list for quicker selection. |

---

## 3. Summary table

| Priority | Count | Focus areas |
|----------|--------|-------------|
| P0       | 3     | Visible focus on amount input, truthful MAX/balance behavior, Escape to close modals |
| P1       | 5     | Keyboard route selection, token search, consistent focus rings, loading feedback, modal focus trap |
| P2       | 2     | Slippage presets, token favorites/recent |

---

## 4. Out of scope for this audit

- Backend or API behavior (handled in swaps-api).
- New features (e.g. limit orders, history).
- Design system or visual redesign beyond focus and clarity of states.

---

## 5. References (files touched by improvements)

- **Amount input / MAX / focus:** `src/components/amount-input.tsx`, `src/app/page.tsx` (handleMax, balance).
- **Modals (Escape, focus trap):** `src/components/settings.tsx`, `src/components/tx-status.tsx`.
- **Route list (keyboard, aria):** `src/components/route-card.tsx`, `src/app/page.tsx` (routes section).
- **Token selector (search, favorites):** `src/components/token-selector.tsx`.
- **Global focus styles:** `src/app/globals.css` and/or component classes (e.g. `.token-button`, `.swap-button`, route card button).
- **Execute button aria-busy:** `src/app/page.tsx` (button that shows "Processing...").

Implement in order P0 → P1 → P2; re-test keyboard nav and a screen reader after each change.

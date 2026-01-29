# Data Flow Diagrams

## Quote Request Flow

```
┌─────────────┐
│   User      │
│ (swaps-web) │
└──────┬──────┘
       │
       │ 1. Select tokens, chains, amount
       │
       ▼
┌─────────────────────────────────────┐
│  React Query Hook (useQuote)        │
│  - Debounces input (500ms)          │
│  - Cancels previous requests        │
└──────┬───────────────────────────────┘
       │
       │ 2. POST /v1/quote
       │
       ▼
┌─────────────────────────────────────┐
│  swaps-api                          │
│  /v1/quote endpoint                 │
└──────┬───────────────────────────────┘
       │
       │ 3. Query all adapters
       │
       ├──► ZeroXAdapter.getQuote()
       │    └──► Returns same-chain routes
       │
       └──► LiFiAdapter.getQuote()
            └──► Returns cross-chain routes
       │
       ▼
┌─────────────────────────────────────┐
│  Policy Engine                       │
│  - Filter by allowlist/denylist     │
│  - Check price impact               │
│  - Check slippage                   │
│  - Check minimum amount             │
│  - Add warnings                     │
└──────┬───────────────────────────────┘
       │
       │ 4. Rank routes
       │    (amountOut - fees)
       │
       ▼
┌─────────────────────────────────────┐
│  Return ranked routes               │
│  + filteredRoutes metadata          │
└──────┬───────────────────────────────┘
       │
       │ 5. Display routes
       │
       ▼
┌─────────────┐
│   User      │
│ (swaps-web) │
└─────────────┘
```

## Transaction Execution Flow

```
┌─────────────┐
│   User      │
│ (swaps-web) │
└──────┬──────┘
       │
       │ 1. Select route, click Execute
       │
       ▼
┌─────────────────────────────────────┐
│  POST /v1/tx                        │
│  - routeId                          │
│  - recipient address                │
└──────┬───────────────────────────────┘
       │
       │ 2. Find adapter by routeId
       │
       ▼
┌─────────────────────────────────────┐
│  Adapter.getTx()                    │
│  - Generate transaction payload     │
│  - Return txData, gas, etc.         │
└──────┬───────────────────────────────┘
       │
       │ 3. Return transaction data
       │
       ▼
┌─────────────────────────────────────┐
│  swaps-web                           │
│  - Check chain match                 │
│  - Switch chain if needed            │
└──────┬───────────────────────────────┘
       │
       │ 4. Send transaction via wallet
       │
       ▼
┌─────────────────────────────────────┐
│  Wallet (MetaMask, etc.)             │
│  - User signs transaction            │
│  - Transaction submitted to chain    │
└──────┬───────────────────────────────┘
       │
       │ 5. Poll transaction status
       │
       ▼
┌─────────────────────────────────────┐
│  GET /v1/status?txHash=...          │
│  - Poll every 3 seconds             │
│  - Until completed/failed            │
└──────┬───────────────────────────────┘
       │
       │ 6. Display status
       │
       ▼
┌─────────────┐
│   User      │
│ (swaps-web) │
└─────────────┘
```

## Policy Engine Evaluation Flow

```
┌─────────────────────────────────────┐
│  Route from Provider                │
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Check Allowlist                    │
│  - Chain in allowlist?              │
│  - Token in allowlist?              │
└──────┬───────────────────────────────┘
       │
       │ Pass
       ▼
┌─────────────────────────────────────┐
│  Check Denylist                     │
│  - Chain in denylist?               │
│  - Token in denylist?               │
└──────┬───────────────────────────────┘
       │
       │ Pass
       ▼
┌─────────────────────────────────────┐
│  Check Sanctions                    │
│  - fromToken sanctioned?            │
│  - toToken sanctioned?              │
└──────┬───────────────────────────────┘
       │
       │ Pass
       ▼
┌─────────────────────────────────────┐
│  Check Price Impact                 │
│  - Above maxPriceImpactBps?         │
│  - Unknown and required?            │
└──────┬───────────────────────────────┘
       │
       │ Pass
       ▼
┌─────────────────────────────────────┐
│  Check Slippage                     │
│  - Above maxSlippageBps?            │
└──────┬───────────────────────────────┘
       │
       │ Pass
       ▼
┌─────────────────────────────────────┐
│  Check Minimum Amount               │
│  - Below minAmountUsd?              │
└──────┬───────────────────────────────┘
       │
       │ Pass
       ▼
┌─────────────────────────────────────┐
│  Add Warnings                       │
│  - High price impact                │
│  - Cross-chain                      │
│  - Low liquidity                    │
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Return: { allowed: true,           │
│            warnings: [...] }        │
└─────────────────────────────────────┘
```

## Component Interaction Flow

```
┌──────────────┐
│  swaps-web   │
│  Components  │
└──────┬───────┘
       │
       ├──► TokenSelector
       │    └──► useTokens() → apiClient.getTokens()
       │
       ├──► AmountInput
       │    └──► User input
       │
       ├──► useQuote()
       │    └──► Debounced → apiClient.getQuote()
       │
       ├──► RouteCard[]
       │    └──► Display routes from quote
       │
       ├──► Execute Button
       │    └──► apiClient.getTx() → wallet.sendTransaction()
       │
       └──► TxStatus
            └──► useTxStatus() → apiClient.getStatus()
```

## Error Handling Flow

```
Request
  │
  ▼
┌─────────────────────────────────────┐
│  Try API Call                       │
└──────┬───────────────────────────────┘
       │
       ├──► Success → Process Response
       │
       └──► Error
            │
            ├──► ApiError (400/500)
            │    └──► Display error message
            │
            ├──► Network Error
            │    └──► Retry or show connection error
            │
            └──► Unknown Error
                 └──► Log and show generic error
```

# Compliance: Provider Enable Flags and Audit Trail

This document describes how to control which swap providers are used and how provider usage is logged for compliance review.

## Provider enable flags (env-based)

Each provider can be turned on or off via environment variables. Set these in `services/swaps-api/.env` (or `.env.local` / `.env.production`). See `services/swaps-api/.env.example` for a full list.

| Env var | Provider | Default when unset |
|--------|----------|--------------------|
| `ENABLE_ZEROX` | 0x | on |
| `ENABLE_OKX` | OKX | on |
| `ENABLE_PARASWAP` | Paraswap | on |
| `ENABLE_1INCH` | 1inch | on |
| `ENABLE_KYBERSWAP` | KyberSwap | on |
| `ENABLE_OPENOCEAN` | OpenOcean | on |
| `ENABLE_ODOS` | Odos | on |
| `ENABLE_LIFI` | LiFi | on |
| `ENABLE_BEBOP` | Bebop | on |
| `ENABLE_DODO` | DODO | on |
| `ENABLE_SUSHISWAP` | SushiSwap | on |

Other adapters (e.g. Phoenix, Curve) use `ENABLE_<NAME>` with the adapter name in uppercase and spaces/special characters normalized (e.g. `ENABLE_PHOENIX`, `ENABLE_UNISWAP_V3`).

- To **disable** a provider: `ENABLE_ZEROX=false`
- To **enable** (no change from default): omit the var or `ENABLE_ZEROX=true`

## Compliance mode

Set `COMPLIANCE_MODE=true` to use **only whitelisted** providers.

- **COMPLIANCE_MODE=false** (default): All providers are used unless `ENABLE_*=false`.
- **COMPLIANCE_MODE=true**: Only providers with `ENABLE_*=true` are used. Any provider without an explicit `true` is excluded.

Use compliance mode when you want to restrict routing to a fixed set of approved aggregators.

Example for gradual onboarding (only 0x and Paraswap live):

```bash
COMPLIANCE_MODE=true
ENABLE_ZEROX=true
ENABLE_PARASWAP=true
# All other providers are off until you set ENABLE_<NAME>=true
```

## Audit trail (provider usage per quote)

For every quote request, the API logs **one line per provider attempt** with only safe fields (no API keys, no user or wallet addresses). Implemented in `services/swaps-api/src/utils/compliance-audit.ts` with an allowlisted payload type so callers cannot add secrets or addresses.

- `requestId`
- `provider` (adapter name)
- `chainId`
- `timestamp` (ISO)
- `routeCount` (number of routes returned), or `error: true` if the adapter threw

Log message: `"Compliance: provider quote usage"`.

Example (structured log):

```json
{"requestId":"abc-123","provider":"0x","chainId":137,"timestamp":"2025-01-26T12:00:00.000Z","routeCount":1}
```

Use these logs to answer: which providers were called, for which chain, and whether they returned routes or failed.

## Which APIs are live?

**GET /v1/providers** returns:

- **withKeys**: Providers that have their API key set (and are not disabled by flag).
- **disabled**: Providers that require a key but it is missing.
- **public**: Providers that can run without a key (e.g. KyberSwap).
- **complianceMode**: Whether `COMPLIANCE_MODE` is enabled.
- **live**: Providers that will actually be used for quotes (respecting enable flags and compliance whitelist). Use this for compliance review: “Which APIs are live?”

## Logs that never include secrets

- API keys are never logged.
- User wallet addresses are not logged in quote or tx audit logs; the tx route logs only `requestId` and `routeId`.
- Quote request body is not logged in the main request log to avoid token addresses in the audit trail.

## Provider capability matrix (single source of truth)

**GET /v1/providers** includes **providerCapabilities**: a per-provider matrix for compliance and partner/regulator review.

| Field | Meaning |
|-------|--------|
| **supportsCrossChain** | Provider can route when fromChainId ≠ toChainId |
| **supportsFiatPairs** | Supports fiat-backed/stablecoin pairs (e.g. USDC, BRLA) |
| **requiresKYC** | Provider requires KYC/KYB approval for commercial use |
| **supportedRegions** | Allowed regions (e.g. US, EU, BR); use `GLOBAL` for no restriction |
| **complianceNotes** | Human-readable notes, e.g. “Provider X requires KYB approval”, “Provider Y not allowed in region Z” |

- **Single source of truth:** Edit `services/swaps-api/src/config/provider-capabilities.ts` (PROVIDER_CAPABILITIES map). Keep notes and regions updated as provider terms or regional rules change.
- **Enforcement:** Before each quote, the API filters providers by:
  - **Cross-chain:** If the request is cross-chain, only providers with `supportsCrossChain: true` are used.
  - **Region:** If the client sends `?region=BR` (or another region), only providers whose `supportedRegions` include that region or `GLOBAL` are used.
  - **Fiat pairs:** If the request is flagged as a fiat pair (future use), only providers with `supportsFiatPairs: true` are used.
- **Easy to show partners/regulators:** Call **GET /v1/providers** and use the `providerCapabilities` object to document which providers are used, their capabilities, and compliance notes.

## Rate limiting and circuit breaker

- **Per-provider rate limiting:** In-memory limiter per provider (requests per minute). When a provider hits its limit, that provider returns no routes for the current request; other providers are still called (no cascading failure).
- **Circuit breaker:** If a provider returns **401** or **429** repeatedly (e.g. 2 times in a row), the provider is temporarily marked unhealthy and skipped for about 1 minute. A successful request clears the circuit. This avoids hammering a provider that is auth-failing or rate-limiting.
- **Provider health in GET /v1/providers:** The response includes `providerHealth: { [providerName]: "healthy" | "rate-limited" | "disabled" | "missing-key" }`. Use this to see which providers are currently usable and to safely test new keys without abuse.

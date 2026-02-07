# API Key Rotation and Environment Isolation

This document describes how to rotate provider API keys safely and how environments are separated. **Never commit API keys;** use the correct env file per environment.

## Environment separation

| Environment   | Env file(s) loaded                    | Use case                          |
|---------------|--------------------------------------|-----------------------------------|
| **development** | `.env` then `.env.local`            | Local dev; `.env.local` overrides  |
| **staging**     | `.env` then `.env.staging`          | Staging / pre-production           |
| **production**  | `.env` then `.env.production`       | Production (or host-set vars only) |

- **Location:** Under `services/swaps-api/` when running from that directory, or from monorepo root (turbo) as `services/swaps-api/.env`, etc.
- **Never commit:** `.env`, `.env.local`, `.env.staging`, `.env.production` are in `.gitignore`. Only `.env.example` (no secrets) may be committed.
- **Production:** Prefer setting variables in the host (e.g. Kubernetes secrets, CI secrets). If you use a file, use `.env.production` and restrict read access.

## Key rotation steps

1. **Obtain a new key** from the provider (0x, OKX, Paraswap, etc.) and note the new value securely.
2. **Update the correct env source:**
   - **Production:** Update the secret in your host (e.g. Kubernetes Secret, Vault) or, if using files, edit `services/swaps-api/.env.production` with the new value. Restrict access to that file.
   - **Staging:** Update `services/swaps-api/.env.staging` or the staging secret store.
   - **Local:** Update `services/swaps-api/.env.local` (never commit).
3. **Restart the swaps-api** so it reloads env (keys are read at startup only). No code change is required.
4. **Verify:** Call `GET /v1/providers` and confirm the provider appears under `withKeys` (the API never returns key values, only provider names).
5. **Revoke or expire the old key** at the provider’s dashboard after the new key is confirmed working.

## Per-provider credential requirements

Use this when adding keys gradually. **If a provider needs more than one credential, set all of them**; partial credentials are treated as missing-key and the provider is not called (see `GET /v1/providers` → `disabled` / `providerHealth: missing-key`).

| Provider | Required env vars | Notes |
|----------|-------------------|--------|
| **0x** | `ZEROX_API_KEY` | Single key; no signing or client-id. |
| **LiFi** | `LIFI_API_KEY` | Single key. |
| **OKX** | `OKX_ACCESS_KEY` + `OKX_SECRET_KEY` + `OKX_PASSPHRASE` | All three required. OKX uses HMAC signing; requests are signed with secret and passphrase. If any is missing, the provider is missing-key and will not be called. |
| **KyberSwap (partner)** | `KYBERSWAP_API_KEY` + `KYBERSWAP_CLIENT_ID` | Partner mode requires both. Public mode uses no keys. If you set only one of the two, the adapter will not use partner endpoints correctly; ensure both are set for partner. |
| **Paraswap** | `PARASWAP_API_KEY` | Single key. |
| **1inch** | `ONEINCH_API_KEY` | Single key. |
| **OpenOcean** | `OPENOCEAN_API_KEY` | Single key. |
| **Odos** | `ODOS_API_KEY` | Single key. |
| **Bebop** | `BEBOP_API_KEY` | Single key. |
| **DODO** | `DODO_API_KEY` | Single key. |
| **SushiSwap** | `SUSHISWAP_API_KEY` | Single key. |

- **0x** requires only `ZEROX_API_KEY`.
- **LiFi** requires only `LIFI_API_KEY`.
- **OKX** requires KEY + SECRET + PASSPHRASE (and the API builds the required auth headers; do not call OKX without all three).
- **Kyber partner** requires `KYBERSWAP_API_KEY` + `KYBERSWAP_CLIENT_ID`; both must be set for partner mode.

## OKX required env vars and rotation

OKX requires these env vars (names only; never log values):

- `OKX_ACCESS_KEY`
- `OKX_SECRET_KEY`
- `OKX_PASSPHRASE`

Optional: `OKX_PROJECT_ID` (if using OKX project-based access).

If any required var is missing, the provider is `missing-key` and is not called. Rotation: update all three in your env source, restart swaps-api, verify `GET /v1/providers` shows OKX under `withKeys`, then revoke the old key at OKX.

## Compliance-safe key handling

- **Not committed:** All env files that may contain keys are listed in `.gitignore` (`.env`, `.env.local`, `.env.staging`, `.env.production`).
- **Not logged:** API key values are never logged. Only provider names and status (e.g. “withKeys”, “disabled”) are logged or returned.
- **Not exposed via API:** `GET /v1/providers` returns provider names and status only; it never returns API key values.
- **Startup check:** In production, if no aggregator API key is set, the server logs a **warning** (it does not crash). Set at least one key for real quotes.

## Optional: copy example and fill locally

```bash
cd services/swaps-api
cp .env.example .env.local
# Edit .env.local with real values; never commit.
```

Use `.env.example` as a template for variable names only; leave values empty or placeholder in the repo.

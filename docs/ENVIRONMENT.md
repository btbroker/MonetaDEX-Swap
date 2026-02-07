# Environment Configuration

## Rules
Do not commit real env files.
Only commit *.env.example and *.env.*.example files.

## Local setup
1) Copy swaps-api env:
services/swaps-api/.env.example → .env.local

2) Copy swaps-web env:
apps/swaps-web/.env.example → .env.local

## Commands
pnpm dev:core
pnpm test:quotes

## Providers
0x: same-chain quotes require ZEROX_API_KEY
LiFi: cross-chain routes require LIFI_API_KEY
OKX: requires OKX_ACCESS_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE
KyberSwap: public mode works without keys; partner mode uses API key + client id

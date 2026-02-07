#!/usr/bin/env bash
# Smoke test: healthz, /v1/providers, POST /v1/quote (Polygon USDC -> BRLA).
# Fails fast if API is down or returns no routes (prints diagnostics).
set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
POLYGON=137
USDC_POLYGON="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
BRLA_POLYGON="0xE6A537a407488807F0bbeb0038B79004f19DDDFb"
# 1000 USDC (6 decimals) in base units
AMOUNT_IN="1000000000"

echo "Smoke: $BASE_URL (healthz, providers, quote USDC->BRLA)"

# Health
curl -sf "$BASE_URL/healthz" > /dev/null || { echo "FAIL: /healthz"; exit 1; }
echo "  /healthz OK"

# Providers
curl -sf "$BASE_URL/v1/providers" > /dev/null || { echo "FAIL: /v1/providers"; exit 1; }
echo "  /v1/providers OK"

# Quote: Polygon USDC -> BRLA
RESP=$(curl -sf -X POST "$BASE_URL/v1/quote" \
  -H "Content-Type: application/json" \
  -d "{
    \"fromChainId\": $POLYGON,
    \"toChainId\": $POLYGON,
    \"fromToken\": \"$USDC_POLYGON\",
    \"toToken\": \"$BRLA_POLYGON\",
    \"amountIn\": \"$AMOUNT_IN\",
    \"slippageTolerance\": 0.5
  }") || { echo "FAIL: POST /v1/quote"; exit 1; }

if echo "$RESP" | grep -q '"routes":\[\]'; then
  echo "FAIL: POST /v1/quote (USDC->BRLA) returned no routes"
  echo "Response (diagnostics / warning):"
  echo "$RESP" | head -c 2000
  echo ""
  exit 1
fi

echo "  POST /v1/quote USDC->BRLA OK (routes present)"
echo "Smoke OK"

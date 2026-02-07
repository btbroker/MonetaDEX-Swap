#!/usr/bin/env bash
# E2E local quote test (truth harness):
# 1) API is up (healthz)
# 2) Providers reflect correct key status (/v1/providers)
# 3) Control quote USDC->USDT returns >=1 real route
# 4) BRLA quote returns realistic output (~1.6k BRLA for 1000 USDC, not ~998)
set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
POLYGON=137
USDC_POLYGON="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
USDT_POLYGON="0xc2132D05D31c914a87C6611C10748AEb04B58e8F"
BRLA_POLYGON="0xE6A537a407488807F0bbeb0038B79004f19DDDFb"
# 1000 USDC (6 decimals) in base units
AMOUNT_IN="1000000000"
# USDC->BRLA: implied BRLA per 1 USDC must be in this range (USD/BRL ~5 implies ~5 BRLA per USDC)
IMPLIED_RATE_MIN="${IMPLIED_RATE_MIN:-4.0}"
IMPLIED_RATE_MAX="${IMPLIED_RATE_MAX:-7.0}"
AMOUNT_IN_HUMAN="1000"

echo "=== E2E Quote Test: $BASE_URL ==="

# --- 1) API is up ---
echo ""
echo "1) Health check..."
curl -sf "$BASE_URL/healthz" > /dev/null || { echo "FAIL: /healthz"; exit 1; }
echo "   /healthz OK"

# --- 2) Providers key status ---
echo ""
echo "2) Provider key status (/v1/providers)..."
PROV=$(curl -sf "$BASE_URL/v1/providers") || { echo "FAIL: /v1/providers"; exit 1; }
echo "$PROV" | jq -r '
  "   withKeys:    " + (.withKeys | join(", ") // "[]"),
  "   public:      " + (.public | join(", ") // "[]"),
  "   publicAttempt: " + ((.publicAttempt // []) | join(", ")),
  "   disabled:    " + (.disabled | join(", ") // "[]"),
  "   misconfigured: " + ((.misconfigured // []) | join(", ")),
  "   complianceMode: " + (.complianceMode | tostring)
'
# Compact table: provider | status | inWithKeys | inLive | note
echo "   Provider table:"
printf "   %-12s | %-12s | %-10s | %-7s | %s\n" "provider" "status" "inWithKeys" "inLive" "note"
for p in okx paraswap 0x openocean odos kyberswap; do
  STATUS=$(echo "$PROV" | jq -r ".providerHealth.\"$p\" // \"n/a\"")
  IN_WITH=$(echo "$PROV" | jq -r "[.withKeys[]? | ascii_downcase] | index(\"$p\") | if . then \"yes\" else \"no\" end")
  IN_LIVE=$(echo "$PROV" | jq -r "[.live[]? | ascii_downcase] | index(\"$p\") | if . then \"yes\" else \"no\" end")
  NOTE=""
  [ "$p" = "okx" ] && [ "$IN_WITH" = "no" ] && NOTE="(not configured)"
  [ "$p" = "paraswap" ] && [ "$IN_WITH" = "no" ] && NOTE="(publicAttempt)"
  printf "   %-12s | %-12s | %-10s | %-7s | %s\n" "$p" "$STATUS" "$IN_WITH" "$IN_LIVE" "$NOTE"
done

# OKX: if env vars set, assert okx in withKeys and healthy
if [ -n "${OKX_ACCESS_KEY}" ] && [ -n "${OKX_SECRET_KEY}" ] && [ -n "${OKX_PASSPHRASE}" ]; then
  OKX_IN_WITH=$(echo "$PROV" | jq -r '[.withKeys[]? | ascii_downcase] | index("okx") // empty')
  OKX_HEALTH=$(echo "$PROV" | jq -r '.providerHealth.okx // "unknown"')
  if [ -z "$OKX_IN_WITH" ]; then
    echo "FAIL: OKX env set but /v1/providers does not have okx in withKeys"
    exit 1
  fi
  if [ "$OKX_HEALTH" != "healthy" ]; then
    echo "FAIL: OKX env set but providerHealth.okx != healthy (got: $OKX_HEALTH)"
    exit 1
  fi
  echo "   OKX: configured (withKeys, healthy)"
else
  echo "   OKX not configured"
fi
echo "   /v1/providers OK"

# Paraswap: healthy when key set, missing-key when not (or publicAttempt when no key)
PARASWAP_HEALTH=$(echo "$PROV" | jq -r '.providerHealth.paraswap // "unknown"')

# --- 3) Control quote: Polygon USDC -> USDT ---
echo ""
echo "3) Control quote: Polygon USDC -> USDT (amountIn=$AMOUNT_IN)..."
RESP_USDT=$(curl -sf -X POST "$BASE_URL/v1/quote" \
  -H "Content-Type: application/json" \
  -d "{
    \"fromChainId\": $POLYGON,
    \"toChainId\": $POLYGON,
    \"fromToken\": \"$USDC_POLYGON\",
    \"toToken\": \"$USDT_POLYGON\",
    \"amountIn\": \"$AMOUNT_IN\",
    \"slippageTolerance\": 0.5
  }") || { echo "FAIL: POST /v1/quote (USDC->USDT)"; exit 1; }

ROUTE_COUNT_USDT=$(echo "$RESP_USDT" | jq '.routes | length')
BEST_PROVIDER_USDT=$(echo "$RESP_USDT" | jq -r '.routes[0].provider // "none"')
BEST_AMOUNT_OUT_WEI_USDT=$(echo "$RESP_USDT" | jq -r '.routes[0].amountOutWei // "n/a"')
BEST_AMOUNT_OUT_USDT=$(echo "$RESP_USDT" | jq -r '.routes[0].amountOut // "n/a"')
TO_DECIMALS_USDT=$(echo "$RESP_USDT" | jq -r '.routes[0].toDecimals // "n/a"')

echo "   routeCount:    $ROUTE_COUNT_USDT"
echo "   best provider: $BEST_PROVIDER_USDT"
echo "   best amountOutWei: $BEST_AMOUNT_OUT_WEI_USDT"
echo "   best amountOut:    $BEST_AMOUNT_OUT_USDT (toDecimals: $TO_DECIMALS_USDT)"

if [ "$ROUTE_COUNT_USDT" -lt 1 ]; then
  echo "FAIL: USDC->USDT routeCount must be > 0"
  echo "$RESP_USDT" | jq '.' 2>/dev/null || echo "$RESP_USDT"
  exit 1
fi
echo "   USDC->USDT OK (routeCount > 0)"

# --- 4) BRLA quote: Polygon USDC -> BRLA ---
echo ""
echo "4) BRLA quote: Polygon USDC -> BRLA (amountIn=$AMOUNT_IN)..."
RESP_BRLA=$(curl -sf -X POST "$BASE_URL/v1/quote" \
  -H "Content-Type: application/json" \
  -d "{
    \"fromChainId\": $POLYGON,
    \"toChainId\": $POLYGON,
    \"fromToken\": \"$USDC_POLYGON\",
    \"toToken\": \"$BRLA_POLYGON\",
    \"amountIn\": \"$AMOUNT_IN\",
    \"slippageTolerance\": 0.5
  }") || { echo "FAIL: POST /v1/quote (USDC->BRLA)"; exit 1; }

ROUTE_COUNT_BRLA=$(echo "$RESP_BRLA" | jq '.routes | length')
echo "   routeCount:    $ROUTE_COUNT_BRLA"

if [ "$ROUTE_COUNT_BRLA" -lt 1 ]; then
  echo "FAIL: USDC->BRLA routeCount must be > 0"
  echo "$RESP_BRLA" | jq '.' 2>/dev/null || echo "$RESP_BRLA"
  exit 1
fi

# Helper: get human amount for a route (amountOutHuman preferred, else amountOut; else from amountOutWei/toDecimals)
# jq: if .amountOutHuman then .amountOutHuman elif .amountOut then .amountOut else (amountOutWei / 10^toDecimals) end
# For wei->human in jq we need to divide; jq doesn't have 10^ easily for large decimals. Use amountOutHuman or amountOut.
echo "   Top 3 routes (provider, amountOutHuman, impliedRate BRLA/USDC):"
for i in 0 1 2; do
  [ "$i" -ge "$ROUTE_COUNT_BRLA" ] && break
  R=$(echo "$RESP_BRLA" | jq -c ".routes[$i]")
  AMOUNT_OUT_HUMAN=$(echo "$R" | jq -r 'if .amountOutHuman != null and .amountOutHuman != "" then .amountOutHuman else .amountOut end')
  if [ "$AMOUNT_OUT_HUMAN" = "null" ] || [ -z "$AMOUNT_OUT_HUMAN" ]; then
    WEI=$(echo "$R" | jq -r '.amountOutWei // ""')
    DEC=$(echo "$R" | jq -r '.toDecimals // 18')
    if [ -n "$WEI" ] && [ "$WEI" != "null" ]; then
      AMOUNT_OUT_HUMAN=$(awk "BEGIN { printf \"%.18g\", $WEI / (10 ^ $DEC) }" 2>/dev/null || echo "0")
    else
      AMOUNT_OUT_HUMAN="0"
    fi
  fi
  IMPLIED_RATE=$(awk "BEGIN { printf \"%.6f\", $AMOUNT_OUT_HUMAN / $AMOUNT_IN_HUMAN }" 2>/dev/null || echo "0")
  PROVIDER=$(echo "$R" | jq -r '.provider // "?"')
  ROUTE_ID=$(echo "$R" | jq -r '.routeId // "?"')
  echo "     [$i] $PROVIDER  amountOutHuman=$AMOUNT_OUT_HUMAN  impliedRate=$IMPLIED_RATE  routeId=$ROUTE_ID"
  if [ "$i" -eq 0 ]; then
    BEST_PROVIDER_BRLA="$PROVIDER"
    BEST_AMOUNT_OUT_BRLA="$AMOUNT_OUT_HUMAN"
    BEST_ROUTE_ID_BRLA="$ROUTE_ID"
    BEST_IMPLIED_RATE="$IMPLIED_RATE"
  fi
done

# Assert best route implied rate is within [IMPLIED_RATE_MIN, IMPLIED_RATE_MAX]
if command -v bc >/dev/null 2>&1; then
  OK_MIN=$(echo "$BEST_IMPLIED_RATE >= $IMPLIED_RATE_MIN" | bc)
  OK_MAX=$(echo "$BEST_IMPLIED_RATE <= $IMPLIED_RATE_MAX" | bc)
  if [ "$OK_MIN" != "1" ] || [ "$OK_MAX" != "1" ]; then
    echo "FAIL: USDC->BRLA best route implied rate must be in [$IMPLIED_RATE_MIN, $IMPLIED_RATE_MAX] (BRLA per USDC)"
    echo "  provider=$BEST_PROVIDER_BRLA amountOutHuman=$BEST_AMOUNT_OUT_BRLA impliedRate=$BEST_IMPLIED_RATE routeId=$BEST_ROUTE_ID_BRLA"
    exit 1
  fi
else
  if ! awk "BEGIN { r=$BEST_IMPLIED_RATE; min=$IMPLIED_RATE_MIN; max=$IMPLIED_RATE_MAX; exit (r >= min && r <= max) ? 0 : 1 }" 2>/dev/null; then
    echo "FAIL: USDC->BRLA best route implied rate must be in [$IMPLIED_RATE_MIN, $IMPLIED_RATE_MAX] (BRLA per USDC)"
    echo "  provider=$BEST_PROVIDER_BRLA amountOutHuman=$BEST_AMOUNT_OUT_BRLA impliedRate=$BEST_IMPLIED_RATE routeId=$BEST_ROUTE_ID_BRLA"
    exit 1
  fi
fi
echo "   USDC->BRLA OK (routeCount > 0, impliedRate $BEST_IMPLIED_RATE in [$IMPLIED_RATE_MIN, $IMPLIED_RATE_MAX])"

# Paraswap presence (if enabled): print whether it appears in BRLA routes
PARASWAP_IN_ROUTES=$(echo "$RESP_BRLA" | jq -r '[.routes[].provider] | index("paraswap") // empty')
if [ -n "$PARASWAP_IN_ROUTES" ]; then
  echo ""
  echo "5) Paraswap in BRLA routes: yes (provider enabled and returned route)"
else
  if [ "$PARASWAP_HEALTH" = "healthy" ]; then
    echo ""
    echo "5) Paraswap in BRLA routes: no (healthy but not best/returned for this pair)"
  else
    echo ""
    echo "5) Paraswap in BRLA routes: no (status=$PARASWAP_HEALTH)"
  fi
fi

echo ""
echo "=== All checks passed ==="

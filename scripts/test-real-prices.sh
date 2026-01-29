#!/bin/bash
# Test Real Prices Script
# Compares MonetaDEX prices with Jumper's prices

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

API_URL="${API_URL:-http://localhost:3001}"

# Test parameters (USDC → BRLA on Polygon)
FROM_CHAIN=137
TO_CHAIN=137
FROM_TOKEN="0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"  # USDC
TO_TOKEN="0xE6A537a407488807F0bbeb0038B79004f19DDDFb"  # BRLA
AMOUNT="1000000000"  # 1000 USDC (6 decimals)

# Jumper's reference price
JUMPER_PRICE=5290.743098  # BRLA for 1000 USDC

echo "💰 Price Comparison: MonetaDEX vs Jumper"
echo "========================================"
echo ""
echo "Test: 1000 USDC → BRLA on Polygon"
echo "Jumper's Best: $JUMPER_PRICE BRLA (via KyberSwap)"
echo ""

# Check if API is running
if ! curl -s "$API_URL/healthz" > /dev/null 2>&1; then
  echo "❌ API is not running at $API_URL"
  echo "   Start it with: pnpm --filter @fortuna/swaps-api dev"
  exit 1
fi

echo "📡 Fetching quotes from MonetaDEX..."
echo ""

# Get quote
RESPONSE=$(curl -s -X POST "$API_URL/v1/quote" \
  -H "Content-Type: application/json" \
  -d "{
    \"fromChainId\": $FROM_CHAIN,
    \"toChainId\": $TO_CHAIN,
    \"fromToken\": \"$FROM_TOKEN\",
    \"toToken\": \"$TO_TOKEN\",
    \"amountIn\": \"$AMOUNT\"
  }")

# Check if we got routes
ROUTE_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('routes', [])))" 2>/dev/null || echo "0")

if [ "$ROUTE_COUNT" -eq "0" ]; then
  echo "❌ No routes returned!"
  echo ""
  echo "Response:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo "✅ Found $ROUTE_COUNT route(s)"
echo ""
echo "📊 Top Routes:"
echo "--------------"

# Extract and display top routes
echo "$RESPONSE" | python3 << 'PYTHON'
import sys
import json

data = json.load(sys.stdin)
routes = data.get('routes', [])

if not routes:
    print("❌ No routes found")
    sys.exit(1)

jumper_price = 5290.743098

print(f"{'#':<3} {'Provider':<15} {'Amount Out (BRLA)':<20} {'vs Jumper':<15} {'Status'}")
print("-" * 75)

for i, route in enumerate(routes[:10], 1):
    provider = route.get('provider', 'unknown')
    amount_out = float(route.get('amountOut', 0)) / 1e18  # BRLA has 18 decimals
    
    if amount_out > 0:
        diff = amount_out - jumper_price
        diff_pct = (diff / jumper_price) * 100
        
        if amount_out > jumper_price:
            status = "🏆 BEATS JUMPER!"
            vs_jumper = f"+{diff:.4f} (+{diff_pct:.2f}%)"
        elif amount_out >= jumper_price * 0.99:  # Within 1%
            status = "✅ Competitive"
            vs_jumper = f"{diff:.4f} ({diff_pct:.2f}%)"
        else:
            status = "⚠️  Lower"
            vs_jumper = f"{diff:.4f} ({diff_pct:.2f}%)"
    else:
        vs_jumper = "N/A"
        status = "❌ Invalid"
    
    print(f"{i:<3} {provider:<15} {amount_out:<20.6f} {vs_jumper:<15} {status}")

# Find best route
if routes:
    best = max(routes, key=lambda r: float(r.get('amountOut', 0)))
    best_amount = float(best.get('amountOut', 0)) / 1e18
    best_provider = best.get('provider', 'unknown')
    
    print("")
    print("🏆 Best Route:")
    print(f"   Provider: {best_provider}")
    print(f"   Amount: {best_amount:.6f} BRLA")
    
    if best_amount > jumper_price:
        diff = best_amount - jumper_price
        diff_pct = (diff / jumper_price) * 100
        print(f"   🎉 BEATS JUMPER by {diff:.4f} BRLA ({diff_pct:.2f}%)!")
    elif best_amount >= jumper_price * 0.99:
        print(f"   ✅ Competitive with Jumper")
    else:
        diff = jumper_price - best_amount
        diff_pct = (diff / jumper_price) * 100
        print(f"   ⚠️  {diff:.4f} BRLA ({diff_pct:.2f}%) lower than Jumper")
PYTHON

echo ""
echo "📈 Analysis:"
echo "-----------"

# Check if we're in mock mode
HEALTH_RESPONSE=$(curl -s "$API_URL/v1/health/providers" 2>/dev/null || echo "{}")
MOCK_MODE=$(echo "$HEALTH_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    providers = data.get('providers', [])
    # Check if any provider has recent success (indicates real API)
    for p in providers:
        if p.get('lastSuccessAt'):
            print('REAL')
            sys.exit(0)
    print('MOCK')
except:
    print('UNKNOWN')
" 2>/dev/null || echo "UNKNOWN")

if [ "$MOCK_MODE" = "MOCK" ]; then
  echo "⚠️  WARNING: Running in MOCK MODE"
  echo "   Prices are fake (not real market prices)"
  echo "   Get API keys: docs/GET_API_KEYS_GUIDE.md"
elif [ "$MOCK_MODE" = "REAL" ]; then
  echo "✅ Using REAL API keys (real market prices)"
else
  echo "⚠️  Could not determine mode"
fi

echo ""
echo "💡 Tips:"
echo "   - Get API keys to see real prices"
echo "   - More aggregators = better prices"
echo "   - Check: docs/GET_API_KEYS_GUIDE.md"

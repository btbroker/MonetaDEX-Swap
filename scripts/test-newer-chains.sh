#!/bin/bash
# Test OpenOcean on Newer Chains
# Tests Base, Scroll, Mantle, Blast, and Mode chains

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🧪 Testing OpenOcean on Newer Chains"
echo "===================================="
echo ""

test_chain_quote() {
    local chain_name=$1
    local quote_request=$2

    QUOTE_RESPONSE=$(curl -s -X POST "${API_URL}/v1/quote" \
      -H "Content-Type: application/json" \
      -d "$quote_request" 2>/dev/null || echo "{}")

    if echo "$QUOTE_RESPONSE" | grep -q "routes"; then
        ROUTE_COUNT=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('routes', [])))" 2>/dev/null || echo "0")
        
        if [ "$ROUTE_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✅ ${chain_name}: Found $ROUTE_COUNT route(s)${NC}"
            
            # Show providers
            PROVIDERS=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); providers = [r['provider'] for r in data.get('routes', [])]; print(', '.join(set(providers)))" 2>/dev/null || echo "unknown")
            echo "   Providers: $PROVIDERS"
            
            # Check if OpenOcean is present
            if echo "$PROVIDERS" | grep -qi "openocean"; then
                echo -e "${GREEN}   ⭐ OpenOcean is active on ${chain_name}${NC}"
            else
                echo -e "${YELLOW}   ⚠️  OpenOcean not found (may be in mock mode or unavailable)${NC}"
            fi
            
            # Show best route
            BEST_PROVIDER=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('routes', [{}])[0].get('provider', 'unknown'))" 2>/dev/null || echo "unknown")
            BEST_AMOUNT=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('routes', [{}])[0].get('amountOut', '0'))" 2>/dev/null || echo "0")
            echo "   Best route: $BEST_PROVIDER -> $BEST_AMOUNT"
        else
            echo -e "${YELLOW}⚠️  ${chain_name}: Quote endpoint working but no routes returned${NC}"
            echo "   (This may be normal if tokens are not available on this chain)"
        fi
    else
        echo -e "${RED}❌ ${chain_name}: Quote endpoint error${NC}"
        ERROR_MSG=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null || echo "Unknown error")
        echo "   Error: $ERROR_MSG"
    fi
    echo ""
}

# Test Base
echo -e "${BLUE}📋 Testing Base (Chain ID: 8453)${NC}"
test_chain_quote "Base" '{
  "fromChainId": 8453,
  "toChainId": 8453,
  "fromToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "toToken": "0x4200000000000000000000000000000000000006",
  "amountIn": "1000000000"
}'

# Test Scroll
echo -e "${BLUE}📋 Testing Scroll (Chain ID: 534352)${NC}"
test_chain_quote "Scroll" '{
  "fromChainId": 534352,
  "toChainId": 534352,
  "fromToken": "0x06eFdBFf2a0a9C1C1C1C1C1C1C1C1C1C1C1C1C1",
  "toToken": "0x5300000000000000000000000000000000000004",
  "amountIn": "1000000000"
}'

# Test Mantle
echo -e "${BLUE}📋 Testing Mantle (Chain ID: 5000)${NC}"
test_chain_quote "Mantle" '{
  "fromChainId": 5000,
  "toChainId": 5000,
  "fromToken": "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9",
  "toToken": "0xdEAddEaDdeadDEadDEADDEAddEADDEAdde1111111",
  "amountIn": "1000000000"
}'

# Test Blast
echo -e "${BLUE}📋 Testing Blast (Chain ID: 81457)${NC}"
test_chain_quote "Blast" '{
  "fromChainId": 81457,
  "toChainId": 81457,
  "fromToken": "0x4300000000000000000000000000000000000003",
  "toToken": "0x4300000000000000000000000000000000000004",
  "amountIn": "1000000000"
}'

# Test Mode
echo -e "${BLUE}📋 Testing Mode (Chain ID: 34443)${NC}"
test_chain_quote "Mode" '{
  "fromChainId": 34443,
  "toChainId": 34443,
  "fromToken": "0xd988097fb8612cc24eeC14542bC03424c2360054",
  "toToken": "0x4200000000000000000000000000000000000006",
  "amountIn": "1000000000"
}'

# Summary
echo "===================================="
echo "📊 Test Summary"
echo "===================================="
echo ""
echo "✅ Newer chain testing completed"
echo ""
echo "Next steps:"
echo "1. Review test results above"
echo "2. Verify OpenOcean is active on newer chains"
echo "3. Compare route quality across chains"
echo "4. Proceed to add Odos aggregator"
echo ""

#!/bin/bash
# Test All Aggregators Across Multiple Chains
# Comprehensive testing of all 11 aggregators on different chains

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "🧪 Testing All Aggregators Across Multiple Chains"
echo "=================================================="
echo ""

# Test configuration: chain_id, chain_name, from_token, to_token, amount
declare -a TEST_CONFIGS=(
  # Ethereum
  "1|Ethereum|0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48|0xdAC17F958D2ee523a2206206994597C13D831ec7|1000000000"
  # Optimism
  "10|Optimism|0x7F5c764cBc14f9669B88837ca1490cCa17c31607|0x94b008aA00579c1307B0EF2c499aD98a8ce58e58|1000000000"
  # BSC
  "56|BSC|0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d|0x55d398326f99059fF775485246999027B3197955|1000000000"
  # Polygon
  "137|Polygon|0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174|0xc2132D05D31c914a87C6611C10748AEb04B58e8F|1000000000"
  # Base
  "8453|Base|0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913|0x4200000000000000000000000000000000000006|1000000000"
  # Arbitrum
  "42161|Arbitrum|0xaf88d065e77c8cC2239327C5EDb3A432268e5831|0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9|1000000000"
  # Avalanche
  "43114|Avalanche|0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E|0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7|1000000000"
  # Scroll
  "534352|Scroll|0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4|0x5300000000000000000000000000000000000004|1000000000"
  # Mantle
  "5000|Mantle|0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9|0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111|1000000000"
  # Blast
  "81457|Blast|0x4300000000000000000000000000000000000003|0x4300000000000000000000000000000000000004|1000000000"
  # Mode
  "34443|Mode|0xd988097fb8612cc24eeC14542bC03424c2360054|0x4200000000000000000000000000000000000006|1000000000"
)

test_chain() {
    local chain_id=$1
    local chain_name=$2
    local from_token=$3
    local to_token=$4
    local amount=$5

    echo -e "${BLUE}📋 Testing ${chain_name} (Chain ID: ${chain_id})${NC}"
    
    QUOTE_REQUEST="{
      \"fromChainId\": ${chain_id},
      \"toChainId\": ${chain_id},
      \"fromToken\": \"${from_token}\",
      \"toToken\": \"${to_token}\",
      \"amountIn\": \"${amount}\"
    }"

    QUOTE_RESPONSE=$(curl -s -X POST "${API_URL}/v1/quote" \
      -H "Content-Type: application/json" \
      -d "$QUOTE_REQUEST" 2>/dev/null || echo "{}")

    if echo "$QUOTE_RESPONSE" | grep -q "routes"; then
        ROUTE_COUNT=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('routes', [])))" 2>/dev/null || echo "0")
        
        if [ "$ROUTE_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✅ ${chain_name}: Found $ROUTE_COUNT route(s)${NC}"
            
            # Show providers
            PROVIDERS=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); providers = [r['provider'] for r in data.get('routes', [])]; print(', '.join(sorted(set(providers))))" 2>/dev/null || echo "unknown")
            echo "   Providers: $PROVIDERS"
            
            # Count unique providers
            PROVIDER_COUNT=$(echo "$PROVIDERS" | python3 -c "import sys; providers = sys.stdin.read().strip().split(', '); print(len([p for p in providers if p]))" 2>/dev/null || echo "0")
            
            if [ "$PROVIDER_COUNT" -ge 5 ]; then
                echo -e "${GREEN}   ⭐ Excellent coverage: $PROVIDER_COUNT providers${NC}"
            elif [ "$PROVIDER_COUNT" -ge 3 ]; then
                echo -e "${YELLOW}   ⚠️  Good coverage: $PROVIDER_COUNT providers${NC}"
            else
                echo -e "${RED}   ⚠️  Limited coverage: $PROVIDER_COUNT providers${NC}"
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

# Test each chain
TOTAL_CHAINS=0
SUCCESSFUL_CHAINS=0
TOTAL_PROVIDERS=0

for config in "${TEST_CONFIGS[@]}"; do
    IFS='|' read -r chain_id chain_name from_token to_token amount <<< "$config"
    TOTAL_CHAINS=$((TOTAL_CHAINS + 1))
    
    test_chain "$chain_id" "$chain_name" "$from_token" "$to_token" "$amount"
    
    # Count successful chains (those with routes)
    QUOTE_RESPONSE=$(curl -s -X POST "${API_URL}/v1/quote" \
      -H "Content-Type: application/json" \
      -d "{\"fromChainId\":${chain_id},\"toChainId\":${chain_id},\"fromToken\":\"${from_token}\",\"toToken\":\"${to_token}\",\"amountIn\":\"${amount}\"}" 2>/dev/null || echo "{}")
    
    ROUTE_COUNT=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('routes', [])))" 2>/dev/null || echo "0")
    
    if [ "$ROUTE_COUNT" -gt 0 ]; then
        SUCCESSFUL_CHAINS=$((SUCCESSFUL_CHAINS + 1))
        PROVIDER_COUNT=$(echo "$QUOTE_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); providers = [r['provider'] for r in data.get('routes', [])]; print(len(set(providers)))" 2>/dev/null || echo "0")
        TOTAL_PROVIDERS=$((TOTAL_PROVIDERS + PROVIDER_COUNT))
    fi
done

# Summary
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo ""
echo -e "${CYAN}Total Chains Tested:${NC} $TOTAL_CHAINS"
echo -e "${CYAN}Successful Chains:${NC} $SUCCESSFUL_CHAINS"
if [ "$SUCCESSFUL_CHAINS" -gt 0 ]; then
    AVG_PROVIDERS=$((TOTAL_PROVIDERS / SUCCESSFUL_CHAINS))
    echo -e "${CYAN}Average Providers per Chain:${NC} $AVG_PROVIDERS"
fi
echo ""
echo "✅ Multi-chain testing completed"
echo ""
echo "Next steps:"
echo "1. Review test results above"
echo "2. Verify aggregator coverage on each chain"
echo "3. Check for any chain-specific issues"
echo ""

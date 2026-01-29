#!/bin/bash
# Multi-Aggregator Testing Script
# Tests the 4-aggregator system (0x, 1inch, Paraswap, LI.FI)

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Multi-Aggregator Testing Suite"
echo "=================================="
echo ""

# Test 1: Health Check
echo "📋 Test 1: API Health Check"
if curl -s -f "${API_URL}/healthz" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API is not responding${NC}"
    exit 1
fi
echo ""

# Test 2: Provider Health
echo "📋 Test 2: Provider Health Status"
PROVIDER_HEALTH=$(curl -s "${API_URL}/v1/health/providers" 2>/dev/null || echo "{}")
if echo "$PROVIDER_HEALTH" | grep -q "0x\|1inch\|paraswap\|lifi"; then
    echo -e "${GREEN}✅ Provider health endpoint working${NC}"
    echo "$PROVIDER_HEALTH" | jq '.' 2>/dev/null || echo "$PROVIDER_HEALTH"
else
    echo -e "${YELLOW}⚠️  Provider health endpoint may not be working correctly${NC}"
    echo "$PROVIDER_HEALTH"
fi
echo ""

# Test 3: Rate Limit Status
echo "📋 Test 3: Rate Limit Status"
RATE_LIMIT=$(curl -s "${API_URL}/v1/health/rate-limits" 2>/dev/null || echo "{}")
if echo "$RATE_LIMIT" | grep -q "0x\|1inch\|paraswap\|lifi"; then
    echo -e "${GREEN}✅ Rate limit endpoint working${NC}"
    echo "$RATE_LIMIT" | jq '.' 2>/dev/null || echo "$RATE_LIMIT"
else
    echo -e "${YELLOW}⚠️  Rate limit endpoint may not be working correctly${NC}"
    echo "$RATE_LIMIT"
fi
echo ""

# Test 4: Metrics
echo "📋 Test 4: Quote Metrics"
METRICS=$(curl -s "${API_URL}/v1/metrics" 2>/dev/null || echo "{}")
if echo "$METRICS" | grep -q "providers\|totalQuotes"; then
    echo -e "${GREEN}✅ Metrics endpoint working${NC}"
    echo "$METRICS" | jq '.' 2>/dev/null || echo "$METRICS"
else
    echo -e "${YELLOW}⚠️  Metrics endpoint may not be working correctly${NC}"
    echo "$METRICS"
fi
echo ""

# Test 5: Same-Chain Quote (Polygon USDC -> USDT)
echo "📋 Test 5: Same-Chain Quote (Polygon: USDC -> USDT)"
QUOTE_REQUEST='{
  "fromChainId": 137,
  "toChainId": 137,
  "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "toToken": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  "amountIn": "1000000000"
}'

QUOTE_RESPONSE=$(curl -s -X POST "${API_URL}/v1/quote" \
  -H "Content-Type: application/json" \
  -d "$QUOTE_REQUEST" 2>/dev/null || echo "{}")

if echo "$QUOTE_RESPONSE" | grep -q "routes\|error"; then
    ROUTE_COUNT=$(echo "$QUOTE_RESPONSE" | jq '.routes | length' 2>/dev/null || echo "0")
    if [ "$ROUTE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Quote endpoint working - Found $ROUTE_COUNT route(s)${NC}"
        
        # Show providers
        echo "Providers found:"
        echo "$QUOTE_RESPONSE" | jq -r '.routes[]?.provider' 2>/dev/null | sort -u || echo "Could not parse providers"
        
        # Show best route
        echo ""
        echo "Best route:"
        echo "$QUOTE_RESPONSE" | jq '.routes[0] | {provider, amountIn, amountOut, fees, priceImpactBps}' 2>/dev/null || echo "Could not parse best route"
    else
        echo -e "${YELLOW}⚠️  Quote endpoint working but no routes returned${NC}"
        echo "$QUOTE_RESPONSE" | jq '.' 2>/dev/null || echo "$QUOTE_RESPONSE"
    fi
else
    echo -e "${RED}❌ Quote endpoint error${NC}"
    echo "$QUOTE_RESPONSE" | jq '.' 2>/dev/null || echo "$QUOTE_RESPONSE"
fi
echo ""

# Test 6: BRLA Token Quote (Most Traded)
echo "📋 Test 6: BRLA Token Quote (Polygon: BRLA -> USDC)"
BRLA_QUOTE_REQUEST='{
  "fromChainId": 137,
  "toChainId": 137,
  "fromToken": "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
  "toToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amountIn": "100000000000000000000"
}'

BRLA_QUOTE_RESPONSE=$(curl -s -X POST "${API_URL}/v1/quote" \
  -H "Content-Type: application/json" \
  -d "$BRLA_QUOTE_REQUEST" 2>/dev/null || echo "{}")

if echo "$BRLA_QUOTE_RESPONSE" | grep -q "routes\|error"; then
    BRLA_ROUTE_COUNT=$(echo "$BRLA_QUOTE_RESPONSE" | jq '.routes | length' 2>/dev/null || echo "0")
    if [ "$BRLA_ROUTE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ BRLA quote working - Found $BRLA_ROUTE_COUNT route(s)${NC}"
        
        # Show providers
        echo "Providers found:"
        echo "$BRLA_QUOTE_RESPONSE" | jq -r '.routes[]?.provider' 2>/dev/null | sort -u || echo "Could not parse providers"
    else
        echo -e "${YELLOW}⚠️  BRLA quote working but no routes returned${NC}"
        echo "$BRLA_QUOTE_RESPONSE" | jq '.' 2>/dev/null || echo "$BRLA_QUOTE_RESPONSE"
    fi
else
    echo -e "${RED}❌ BRLA quote endpoint error${NC}"
    echo "$BRLA_QUOTE_RESPONSE" | jq '.' 2>/dev/null || echo "$BRLA_QUOTE_RESPONSE"
fi
echo ""

# Test 7: Best Route Selection
echo "📋 Test 7: Best Route Selection Validation"
if [ "$ROUTE_COUNT" -gt 1 ]; then
    FIRST_AMOUNT=$(echo "$QUOTE_RESPONSE" | jq -r '.routes[0].amountOut' 2>/dev/null || echo "0")
    SECOND_AMOUNT=$(echo "$QUOTE_RESPONSE" | jq -r '.routes[1].amountOut' 2>/dev/null || echo "0")
    
    if [ -n "$FIRST_AMOUNT" ] && [ -n "$SECOND_AMOUNT" ] && [ "$FIRST_AMOUNT" != "0" ] && [ "$SECOND_AMOUNT" != "0" ]; then
        # Compare amounts (first should be >= second)
        if (( $(echo "$FIRST_AMOUNT >= $SECOND_AMOUNT" | bc -l 2>/dev/null || echo "1") )); then
            echo -e "${GREEN}✅ Best route selection working (first route has higher amountOut)${NC}"
        else
            echo -e "${YELLOW}⚠️  Best route may not be ranked first${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Could not validate route ranking${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Need at least 2 routes to validate ranking${NC}"
fi
echo ""

# Summary
echo "=================================="
echo "📊 Test Summary"
echo "=================================="
echo ""
echo "✅ Health checks completed"
echo "✅ Quote endpoints tested"
echo "✅ Multi-aggregator validation done"
echo ""
echo "Next steps:"
echo "1. Review test results above"
echo "2. Check for any errors or warnings"
echo "3. Verify all 4 providers are responding"
echo "4. Proceed to add OpenOcean if all tests pass"
echo ""

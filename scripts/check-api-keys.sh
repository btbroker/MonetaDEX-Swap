#!/bin/bash
# Check API Keys Status Script
# Shows which aggregators have API keys configured

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/services/swaps-api/.env"

echo "🔑 API Keys Status Check"
echo "========================"
echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found at: $ENV_FILE"
  exit 1
fi

# List of API keys to check
declare -a KEYS=(
  "KYBERSWAP_API_KEY"
  "ONEINCH_API_KEY"
  "PARASWAP_API_KEY"
  "SUSHISWAP_API_KEY"
  "OKX_ACCESS_KEY"
  "OPENOCEAN_API_KEY"
  "ODOS_API_KEY"
  "DODO_API_KEY"
  "BEBOP_API_KEY"
  "ZEROX_API_KEY"
  "LIFI_API_KEY"
)

# Critical keys (Tier 1)
declare -a CRITICAL_KEYS=(
  "KYBERSWAP_API_KEY"
  "ONEINCH_API_KEY"
  "PARASWAP_API_KEY"
  "SUSHISWAP_API_KEY"
  "OKX_ACCESS_KEY"
)

echo "📋 Critical Keys (Tier 1):"
echo "-------------------------"
for key in "${CRITICAL_KEYS[@]}"; do
  if grep -q "^${key}=" "$ENV_FILE"; then
    value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '[:space:]')
    if [ -z "$value" ] || [ "$value" = "" ]; then
      echo "  ❌ $key: NOT SET (empty)"
    else
      # Mask the key (show first 4 and last 4 chars)
      masked=$(echo "$value" | sed 's/\(.\{4\}\).*\(.\{4\}\)/\1****\2/')
      echo "  ✅ $key: SET ($masked)"
    fi
  else
    echo "  ❌ $key: NOT FOUND"
  fi
done

echo ""
echo "📋 Additional Keys (Tier 2):"
echo "---------------------------"
for key in "${KEYS[@]}"; do
  # Skip critical keys (already shown)
  if [[ " ${CRITICAL_KEYS[@]} " =~ " ${key} " ]]; then
    continue
  fi
  
  if grep -q "^${key}=" "$ENV_FILE"; then
    value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '[:space:]')
    if [ -z "$value" ] || [ "$value" = "" ]; then
      echo "  ⚠️  $key: NOT SET (empty)"
    else
      masked=$(echo "$value" | sed 's/\(.\{4\}\).*\(.\{4\}\)/\1****\2/')
      echo "  ✅ $key: SET ($masked)"
    fi
  else
    echo "  ⚠️  $key: NOT FOUND"
  fi
done

echo ""
echo "📊 Summary:"
echo "----------"

# Count configured keys
configured=0
total=${#KEYS[@]}

for key in "${KEYS[@]}"; do
  if grep -q "^${key}=" "$ENV_FILE"; then
    value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '[:space:]')
    if [ -n "$value" ] && [ "$value" != "" ]; then
      ((configured++))
    fi
  fi
done

critical_configured=0
for key in "${CRITICAL_KEYS[@]}"; do
  if grep -q "^${key}=" "$ENV_FILE"; then
    value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '[:space:]')
    if [ -n "$value" ] && [ "$value" != "" ]; then
      ((critical_configured++))
    fi
  fi
done

echo "  Critical Keys: $critical_configured/${#CRITICAL_KEYS[@]}"
echo "  Total Keys: $configured/$total"
echo ""

if [ $critical_configured -eq 0 ]; then
  echo "⚠️  WARNING: No critical API keys configured!"
  echo "   You're running in MOCK MODE (fake prices)"
  echo "   Get keys from: docs/GET_API_KEYS_GUIDE.md"
  exit 1
elif [ $critical_configured -lt 3 ]; then
  echo "⚠️  WARNING: Only $critical_configured critical keys configured"
  echo "   Recommended: Get at least 3 critical keys for competitive prices"
  exit 0
else
  echo "✅ Good! You have $critical_configured critical keys configured"
  echo "   Ready for real market prices!"
  exit 0
fi

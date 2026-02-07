#!/bin/bash
# Add API Key Script
# Helps add API keys to .env file safely

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/services/swaps-api/.env"
ENV_EXAMPLE="$REPO_ROOT/services/swaps-api/.env.example"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔑 Add API Key to MonetaDEX"
echo "============================"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
  if [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo -e "${GREEN}✅ Created .env file${NC}"
  else
    echo -e "${RED}❌ .env.example not found. Please create .env manually.${NC}"
    exit 1
  fi
fi

# List of available API keys
declare -A KEY_INFO=(
  ["KYBERSWAP_API_KEY"]="KyberSwap (Priority 1 - Jumper's best route)"
  ["ONEINCH_API_KEY"]="1inch (Priority 2 - Good coverage)"
  ["PARASWAP_API_KEY"]="Paraswap (Priority 3 - Competitive prices)"
  ["SUSHISWAP_API_KEY"]="SushiSwap (Priority 4 - Also in Jumper)"
  ["OKX_ACCESS_KEY"]="OKX (Priority 5 - Also in Jumper)"
  ["OPENOCEAN_API_KEY"]="OpenOcean (Additional coverage)"
  ["ODOS_API_KEY"]="Odos (Advanced routing)"
  ["ODOS_PARTNER_CODE"]="Odos Partner Code (For affiliate fees)"
  ["DODO_API_KEY"]="DODO (Competitive)"
  ["BEBOP_API_KEY"]="Bebop (Good prices)"
  ["ZEROX_API_KEY"]="0x (Solid aggregator)"
  ["LIFI_API_KEY"]="LI.FI (Cross-chain bridges)"
)

# Show menu
echo "Select API key to add:"
echo ""
echo "Priority Keys (Get These First):"
echo "  1) KYBERSWAP_API_KEY - ${KEY_INFO[KYBERSWAP_API_KEY]}"
echo "  2) ONEINCH_API_KEY - ${KEY_INFO[ONEINCH_API_KEY]}"
echo "  3) PARASWAP_API_KEY - ${KEY_INFO[PARASWAP_API_KEY]}"
echo "  4) SUSHISWAP_API_KEY - ${KEY_INFO[SUSHISWAP_API_KEY]}"
echo "  5) OKX_ACCESS_KEY - ${KEY_INFO[OKX_ACCESS_KEY]}"
echo ""
echo "Additional Keys:"
echo "  6) OPENOCEAN_API_KEY - ${KEY_INFO[OPENOCEAN_API_KEY]}"
echo "  7) ODOS_API_KEY - ${KEY_INFO[ODOS_API_KEY]}"
echo "  8) ODOS_PARTNER_CODE - ${KEY_INFO[ODOS_PARTNER_CODE]}"
echo "  9) DODO_API_KEY - ${KEY_INFO[DODO_API_KEY]}"
echo " 10) BEBOP_API_KEY - ${KEY_INFO[BEBOP_API_KEY]}"
echo " 11) ZEROX_API_KEY - ${KEY_INFO[ZEROX_API_KEY]}"
echo " 12) LIFI_API_KEY - ${KEY_INFO[LIFI_API_KEY]}"
echo ""
echo "  0) Exit"
echo ""

read -p "Enter choice (0-12): " choice

case $choice in
  1) KEY_NAME="KYBERSWAP_API_KEY" ;;
  2) KEY_NAME="ONEINCH_API_KEY" ;;
  3) KEY_NAME="PARASWAP_API_KEY" ;;
  4) KEY_NAME="SUSHISWAP_API_KEY" ;;
  5) KEY_NAME="OKX_ACCESS_KEY" ;;
  6) KEY_NAME="OPENOCEAN_API_KEY" ;;
  7) KEY_NAME="ODOS_API_KEY" ;;
  8) KEY_NAME="ODOS_PARTNER_CODE" ;;
  9) KEY_NAME="DODO_API_KEY" ;;
  10) KEY_NAME="BEBOP_API_KEY" ;;
  11) KEY_NAME="ZEROX_API_KEY" ;;
  12) KEY_NAME="LIFI_API_KEY" ;;
  0) echo "Exiting..."; exit 0 ;;
  *) echo -e "${RED}❌ Invalid choice${NC}"; exit 1 ;;
esac

echo ""
echo -e "${YELLOW}Adding: ${KEY_NAME}${NC}"
echo "Description: ${KEY_INFO[$KEY_NAME]}"
echo ""

# Check if key already exists
if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
  current_value=$(grep "^${KEY_NAME}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '[:space:]')
  if [ -n "$current_value" ] && [ "$current_value" != "" ]; then
    masked=$(echo "$current_value" | sed 's/\(.\{4\}\).*\(.\{4\}\)/\1****\2/')
    echo -e "${YELLOW}⚠️  Key already exists: ${masked}${NC}"
    read -p "Do you want to replace it? (y/N): " replace
    if [[ ! "$replace" =~ ^[Yy]$ ]]; then
      echo "Keeping existing key."
      exit 0
    fi
    # Remove old line
    sed -i.bak "/^${KEY_NAME}=/d" "$ENV_FILE"
  fi
fi

# Get the API key
echo "Enter your API key (it will be hidden):"
read -s api_key

if [ -z "$api_key" ]; then
  echo -e "${RED}❌ API key cannot be empty${NC}"
  exit 1
fi

# Add key to .env
# Check if key section exists, if not add it
if ! grep -q "# Provider API Keys" "$ENV_FILE"; then
  echo "" >> "$ENV_FILE"
  echo "# Provider API Keys (optional - will use mock mode if not set)" >> "$ENV_FILE"
fi

# Add or update the key
if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
  # Update existing
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^${KEY_NAME}=.*|${KEY_NAME}=${api_key}|" "$ENV_FILE"
  else
    # Linux
    sed -i "s|^${KEY_NAME}=.*|${KEY_NAME}=${api_key}|" "$ENV_FILE"
  fi
else
  # Add new
  echo "${KEY_NAME}=${api_key}" >> "$ENV_FILE"
fi

echo ""
echo -e "${GREEN}✅ API key added successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Restart the API: pnpm --filter @fortuna/swaps-api dev"
echo "  2. Check status: bash scripts/check-api-keys.sh"
echo "  3. Test prices: bash scripts/test-real-prices.sh"
echo ""

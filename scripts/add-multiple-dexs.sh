#!/bin/bash
# Script to track DEX addition progress
# This helps us reach 35+ DEXs

echo "🚀 DEX Expansion Progress Tracker"
echo "==================================="
echo ""

# Count current adapters
ADAPTER_COUNT=$(find services/swaps-api/src/adapters -name "*.ts" -not -name "*.test.ts" -not -name "index.ts" -not -name "base.ts" | wc -l | tr -d ' ')

echo "📊 Current Status:"
echo "   Total Adapters: $ADAPTER_COUNT"
echo ""

# List current adapters
echo "✅ Current Adapters:"
find services/swaps-api/src/adapters -name "*.ts" -not -name "*.test.ts" -not -name "index.ts" -not -name "base.ts" | sed 's|services/swaps-api/src/adapters/||' | sed 's|\.ts||' | sed 's|^|   - |' | sort

echo ""
echo "🎯 Target: 35+ DEXs"
echo "📈 Progress: $ADAPTER_COUNT/35+"
echo ""

if [ "$ADAPTER_COUNT" -ge 35 ]; then
  echo "🎉 SUCCESS! We have 35+ DEXs!"
else
  REMAINING=$((35 - ADAPTER_COUNT))
  echo "⏳ Need $REMAINING more DEXs to reach 35+"
fi

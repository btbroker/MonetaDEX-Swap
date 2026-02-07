# Pricing Issue Analysis: Why MonetaDEX Prices Differ from Jumper

## 🔍 Problem Identified

**Issue**: MonetaDEX is showing significantly different prices compared to Jumper Exchange.

**Example**:
- **Jumper**: 1000 USDC → **5,290.743098 BRLA** (via KyberSwap)
- **MonetaDEX**: 1000 USDC → **996.5025 BRLA** (via 1inch)

**Difference**: ~5,300% discrepancy! This is not a small difference.

---

## 🎯 Root Cause

### **All Adapters Are Running in MOCK MODE**

**Evidence**:
1. ✅ All API keys in `.env` are empty:
   ```env
   ONEINCH_API_KEY=
   PARASWAP_API_KEY=
   KYBERSWAP_API_KEY=
   # ... all empty
   ```

2. ✅ Mock mode uses **fake price calculations**:
   ```typescript
   // From oneInch.ts getMockQuote()
   const amountOut = amountIn * (1 - 0.0025) - platformFee;
   // This assumes ~1:1 exchange rate, ignoring actual market prices!
   ```

3. ✅ Mock mode **doesn't query real DEXs**:
   - No real liquidity pools checked
   - No real market prices fetched
   - Just a simple percentage calculation

---

## 📊 Why Mock Mode Gives Wrong Prices

### Mock Mode Logic (Current):
```typescript
// 1inch mock quote
amountIn = 1000 USDC (1,000,000,000 in 6 decimals)
dexFeeRate = 0.25% (0.0025)
amountAfterDexFee = 1000 * (1 - 0.0025) = 997.5
platformFee = 997.5 * 0.001 = 0.9975
amountOut = 997.5 - 0.9975 = 996.5025 BRLA
```

**Problem**: This assumes **1 USDC = 1 BRLA**, which is completely wrong!

**Reality**: 
- 1 USDC ≈ **5.29 BRLA** (based on Jumper's quote)
- So 1000 USDC should yield ~5,290 BRLA, not 996 BRLA

---

## ✅ Solution: Get Real API Keys

### Why Real API Keys Matter:

1. **Real Market Prices**: Aggregators query actual DEX liquidity pools
2. **Best Route Discovery**: Find optimal paths across multiple DEXs
3. **Competitive Pricing**: Match or beat Jumper's prices
4. **Real-Time Updates**: Prices reflect current market conditions

### What Happens with Real API Keys:

**Before (Mock Mode)**:
```
1000 USDC → 996.5025 BRLA (fake calculation)
```

**After (Real API Keys)**:
```
1000 USDC → ~5,290 BRLA (real market price from KyberSwap/1inch/etc.)
```

---

## 🚀 How to Fix This

### Step 1: Get API Keys (Priority Order)

**Critical for Pricing**:
1. **KyberSwap** ⭐ (Jumper's best route for USDC→BRLA)
   - Website: https://kyberswap.com
   - API Docs: https://docs.kyberswap.com
   - Get Key: https://kyberswap.com/developers

2. **1inch** ⭐ (Good coverage)
   - Website: https://1inch.io
   - API Docs: https://docs.1inch.io
   - Get Key: https://portal.1inch.io

3. **Paraswap** ⭐ (Competitive prices)
   - Website: https://paraswap.io
   - API Docs: https://developers.paraswap.io
   - Get Key: https://developers.paraswap.io/getting-started

4. **SushiSwap** (Also shown in Jumper)
   - Website: https://sushi.com
   - API Docs: https://docs.sushi.com
   - Get Key: Contact SushiSwap team

5. **OKX** (Also shown in Jumper)
   - Website: https://www.okx.com
   - API Docs: https://www.okx.com/web3/build/docs/dex/aggregator/overview
   - Get Key: Contact OKX team

**Additional Aggregators** (for maximum coverage):
- OpenOcean, Odos, DODO, Bebop, 0x, LI.FI

### Step 2: Update `.env` File

```bash
# Edit services/swaps-api/.env
ONEINCH_API_KEY=your_1inch_key_here
PARASWAP_API_KEY=your_paraswap_key_here
KYBERSWAP_API_KEY=your_kyberswap_key_here
SUSHISWAP_API_KEY=your_sushiswap_key_here
OKX_ACCESS_KEY=your_okx_key_here
# ... add others
```

### Step 3: Restart API

```bash
# Stop current API (Ctrl+C)
# Restart with new keys
pnpm --filter @fortuna/swaps-api dev
```

### Step 4: Verify Real Quotes

```bash
# Test quote endpoint
curl -X POST http://localhost:3001/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 137,
    "toChainId": 137,
    "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "toToken": "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
    "amountIn": "1000000000"
  }'

# Check provider health
curl http://localhost:3001/v1/health/providers
```

**Expected Result**:
- Routes should show ~5,290 BRLA (not 996 BRLA)
- Multiple providers should return competitive routes
- Prices should match or beat Jumper

---

## 📈 Expected Improvements

### Before (Mock Mode):
- ❌ Fake prices (~996 BRLA)
- ❌ No real market data
- ❌ Can't compete with Jumper

### After (Real API Keys):
- ✅ Real market prices (~5,290 BRLA)
- ✅ Best route discovery
- ✅ Competitive with Jumper
- ✅ Multiple aggregators competing

---

## 🔍 How to Verify It's Working

### 1. Check Provider Health
```bash
curl http://localhost:3001/v1/health/providers | python3 -m json.tool
```

**Look for**:
- `"isHealthy": true` for providers with API keys
- `"lastSuccessAt"` should be recent (not null)

### 2. Compare Prices
- **Jumper**: 1000 USDC → 5,290.743098 BRLA
- **MonetaDEX**: Should show similar or better prices

### 3. Check Multiple Routes
- Should see routes from KyberSwap, 1inch, Paraswap, SushiSwap, OKX
- All should show ~5,290 BRLA (not 996 BRLA)

---

## ⚠️ Important Notes

1. **Free Tier Limits**: Some aggregators have rate limits on free tiers
   - Start with paid tiers for production
   - Monitor rate limits: `/v1/health/rate-limits`

2. **API Key Costs**: 
   - Some aggregators offer free tiers
   - Paid tiers provide better rate limits
   - See `docs/API_KEYS_TESTING_GUIDE.md` for details

3. **Testing**: 
   - Test on testnets first
   - Verify prices match market rates
   - Compare with Jumper for validation

---

## 📚 Related Documentation

- **API Keys Guide**: `docs/API_KEYS_TESTING_GUIDE.md`
- **Testing Guide**: `docs/TESTING_PLAN.md`
- **Next Steps**: `docs/NEXT_STEPS_ROADMAP.md`

---

## ✅ Summary

**Problem**: Mock mode = fake prices = can't compete with Jumper

**Solution**: Get real API keys = real prices = competitive with Jumper

**Priority**: Get KyberSwap, 1inch, Paraswap, SushiSwap, OKX keys first (these are the ones Jumper uses for USDC→BRLA)

**Expected Result**: Prices should match or beat Jumper (~5,290 BRLA for 1000 USDC)

---

**Last Updated**: 2026-01-27  
**Status**: ⚠️ Waiting for API keys to enable real pricing

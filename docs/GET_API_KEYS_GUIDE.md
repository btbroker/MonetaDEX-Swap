# Get API Keys Guide - Beat Jumper's Prices! 🚀

## 🎯 Goal: Get Real Market Prices to Beat Jumper

**Current**: Mock mode = 996 BRLA (fake prices)  
**Target**: Real API keys = ~5,290 BRLA (real prices)  
**Goal**: Beat Jumper's 5,290.743098 BRLA! 💪

---

## 📋 Priority List (Get These First)

Based on Jumper's routes for USDC→BRLA on Polygon, these are the **critical** aggregators:

### Tier 1: Critical (Jumper Uses These) ⭐⭐⭐

1. **KyberSwap** - Jumper's BEST route (5,290.743098 BRLA)
2. **1inch** - Good coverage
3. **Paraswap** - Competitive prices
4. **SushiSwap** - Also in Jumper's list
5. **OKX** - Also in Jumper's list

### Tier 2: Additional Coverage ⭐⭐

6. **OpenOcean** - Good for smaller chains
7. **Odos** - Advanced routing
8. **DODO** - Competitive
9. **Bebop** - Good prices
10. **0x** - Solid aggregator
11. **LI.FI** - For cross-chain

---

## 🔑 Step-by-Step: Get API Keys

### 1. KyberSwap API Key ⭐ **START HERE**

**Why**: Jumper's best route uses KyberSwap (5,290.743098 BRLA)

**Steps**:
1. **Start Here**: Visit https://docs.kyberswap.com/getting-started/quickstart
2. **Developer Guides**: Click on "Execute A Swap With The Aggregator API"
   - Direct: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api
3. **Read API Documentation**: Understand the Aggregator API
4. **Get API Key**:
   - Check if API key is required (may be optional for some endpoints)
   - If needed, contact KyberSwap team:
     - Discord: https://discord.gg/kyberswap
     - GitHub: https://github.com/KyberNetwork/kyberswap-aggregator-sdk
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Use case: DEX Aggregator platform
5. Copy the API key when received

**API Details**:
- Base URL: `https://aggregator-api.kyberswap.com`
- Endpoint: `/{chain}/v1/routes` (e.g., `/polygon/v1/routes`)
- Check documentation for authentication requirements

**Rate Limits**: Usually free tier available

**Add to `.env`**:
```env
KYBERSWAP_API_KEY=your_kyberswap_key_here
```

---

### 2. 1inch API Key ⭐

**Why**: Good coverage, competitive prices

**Steps**:
1. Visit: https://portal.1inch.io/
2. Click "Sign Up" or "Get Started"
3. Connect wallet or sign up with email
4. Navigate to "API Keys" section
5. Generate new API key
6. Copy the key

**Rate Limits**: 
- Public API: 1 req/sec (no key needed, but key gives better limits)
- With API key: Higher limits

**Note**: 1inch public API works without key, but having a key gives better rate limits.

**Add to `.env`**:
```env
ONEINCH_API_KEY=your_1inch_key_here
```

---

### 3. Paraswap API Key ⭐

**Why**: Competitive prices, good liquidity

**Steps**:
1. Visit: https://developers.paraswap.io/
2. Click "Get Started" or "API Access"
3. Sign up with email
4. Verify email
5. Get API key from dashboard
6. Copy the key

**Alternative**:
- Visit: https://developers.paraswap.network/
- Look for "API Key" section

**Rate Limits**: Varies by plan (free tier usually available)

**Add to `.env`**:
```env
PARASWAP_API_KEY=your_paraswap_key_here
```

---

### 4. SushiSwap API Key ⭐

**Why**: Also shown in Jumper's routes

**Steps**:
1. Visit: https://docs.sushi.com/
2. Look for "API" or "Developer" section
3. Contact: dev@sushi.com or check Discord
4. Request API access
5. Get API key

**Alternative**:
- Visit: https://sushi.com
- Check "Developers" or "API" section
- May need to contact team directly

**Note**: SushiSwap might not have public API keys. Check their docs first.

**Add to `.env`**:
```env
SUSHISWAP_API_KEY=your_sushiswap_key_here
```

---

### 5. OKX API Key ⭐

**Why**: Also shown in Jumper's routes

**Steps**:
1. Visit: https://www.okx.com/web3/build/docs/dex/aggregator/overview
2. Look for "API Key" or "Get Access"
3. Sign up with OKX account
4. Navigate to API section
5. Generate API key
6. Copy the key

**Alternative**:
- Visit: https://www.okx.com
- Check "Developers" or "API" section

**Rate Limits**: Check OKX documentation

**Add to `.env`**:
```env
OKX_ACCESS_KEY=your_okx_key_here
```

---

### 6. OpenOcean API Key

**Steps**:
1. Visit: https://docs.openocean.finance/
2. Look for "API Key" section
3. Sign up
4. Get API key

**Add to `.env`**:
```env
OPENOCEAN_API_KEY=your_openocean_key_here
```

---

### 7. Odos API Key

**Steps**:
1. Visit: https://docs.odos.xyz/
2. Look for "API Key" or "Get Access"
3. Sign up
4. Get API key

**Partner Code** (for affiliate fees):
1. Visit: https://referral.odos.xyz/
2. Register for partner code
3. Get partner code

**Add to `.env`**:
```env
ODOS_API_KEY=your_odos_key_here
ODOS_PARTNER_CODE=your_partner_code_here
```

---

### 8. DODO API Key

**Steps**:
1. Visit: https://docs.dodoex.io/
2. Look for "API" section
3. Sign up
4. Get API key

**Add to `.env`**:
```env
DODO_API_KEY=your_dodo_key_here
```

---

### 9. Bebop API Key

**Steps**:
1. Visit: https://docs.bebop.xyz/
2. Look for "API" section
3. Sign up
4. Get API key

**Add to `.env`**:
```env
BEBOP_API_KEY=your_bebop_key_here
```

---

### 10. 0x API Key

**Steps**:
1. Visit: https://0x.org/docs/api
2. Sign up for API access
3. Get API key

**Add to `.env`**:
```env
ZEROX_API_KEY=your_0x_key_here
```

---

### 11. LI.FI API Key

**Steps**:
1. Visit: https://docs.li.fi/
2. Look for "API Key" section
3. Sign up
4. Get API key

**Add to `.env`**:
```env
LIFI_API_KEY=your_lifi_key_here
```

---

## 📝 Quick Setup Checklist

Use this checklist to track your progress:

```
[ ] KyberSwap API Key
[ ] 1inch API Key
[ ] Paraswap API Key
[ ] SushiSwap API Key
[ ] OKX API Key
[ ] OpenOcean API Key
[ ] Odos API Key
[ ] DODO API Key
[ ] Bebop API Key
[ ] 0x API Key
[ ] LI.FI API Key
```

**Minimum to Start**: Get at least **KyberSwap, 1inch, and Paraswap** to see competitive prices!

---

## 🔧 After Getting Keys

### Step 1: Update `.env` File

```bash
# Edit services/swaps-api/.env
nano services/swaps-api/.env
# or
code services/swaps-api/.env
```

Add your keys:
```env
# Critical (Get These First!)
KYBERSWAP_API_KEY=your_key_here
ONEINCH_API_KEY=your_key_here
PARASWAP_API_KEY=your_key_here
SUSHISWAP_API_KEY=your_key_here
OKX_ACCESS_KEY=your_key_here

# Additional (Get Later)
OPENOCEAN_API_KEY=your_key_here
ODOS_API_KEY=your_key_here
ODOS_PARTNER_CODE=your_code_here
DODO_API_KEY=your_key_here
BEBOP_API_KEY=your_key_here
ZEROX_API_KEY=your_key_here
LIFI_API_KEY=your_key_here
```

### Step 2: Restart API

```bash
# Stop current API (Ctrl+C in the terminal running it)
# Then restart:
pnpm --filter @fortuna/swaps-api dev
```

### Step 3: Verify Keys Are Working

```bash
# Check provider health
curl http://localhost:3001/v1/health/providers | python3 -m json.tool

# Look for providers with keys to show:
# - "isHealthy": true
# - "lastSuccessAt": recent timestamp
```

### Step 4: Test Real Prices

```bash
# Test USDC → BRLA quote (1000 USDC)
curl -X POST http://localhost:3001/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 137,
    "toChainId": 137,
    "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "toToken": "0xE6A537a407488807F0bbeb0038B79004f19DDDFb",
    "amountIn": "1000000000"
  }' | python3 -m json.tool
```

**Expected**: Should see ~5,290 BRLA (not 996 BRLA)!

---

## 🎯 Success Criteria

### Before (Mock Mode):
- ❌ 1000 USDC → 996.5025 BRLA
- ❌ Fake prices
- ❌ Can't compete

### After (Real API Keys):
- ✅ 1000 USDC → ~5,290 BRLA
- ✅ Real market prices
- ✅ **BEAT JUMPER'S 5,290.743098 BRLA!** 🏆

---

## 🚨 Troubleshooting

### "API key not working"
- Check if key is correct (no extra spaces)
- Verify key is active in aggregator dashboard
- Check rate limits (might be hitting limits)

### "Still showing mock prices"
- Make sure API was restarted after adding keys
- Check `.env` file has correct variable names
- Verify keys are in the right file (`services/swaps-api/.env`)

### "Provider unhealthy"
- Check API key is valid
- Verify network connectivity
- Check aggregator's API status page

---

## 📊 Compare Prices

Once you have keys, compare:

**Jumper's Best**: 5,290.743098 BRLA (KyberSwap)  
**MonetaDEX**: Should show similar or BETTER! 🚀

**Why MonetaDEX Can Win**:
- ✅ 11 aggregators competing (Jumper has fewer)
- ✅ Best route selection across all providers
- ✅ Lower fees (10 BPS vs Jumper's fees)
- ✅ More liquidity sources

---

## 🎉 Next Steps

1. **Get Keys**: Start with KyberSwap, 1inch, Paraswap
2. **Test**: Verify prices are real (~5,290 BRLA)
3. **Compare**: Check if we beat Jumper
4. **Celebrate**: When we win! 🏆

---

**Last Updated**: 2026-01-27  
**Status**: Ready to get API keys and beat Jumper! 💪

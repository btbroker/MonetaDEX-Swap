# API Keys Implementation Plan 🔑

**Goal**: Add all API keys one by one to enable real market prices  
**Starting Point**: KyberSwap (Priority #1)  
**Total API Keys Needed**: 35 (one per DEX/aggregator)

---

## 📋 Current Status

- ✅ **35 DEXs integrated** (11 aggregators + 24 direct DEXs)
- ✅ **11 chains configured**
- ⚠️ **All running in mock mode** (no API keys yet)
- 🎯 **Goal**: Get real API keys for all providers

---

## 🎯 Priority Order

### Phase 1: Critical Aggregators (Get These First) ⭐⭐⭐

These are the most important for competitive pricing:

1. **KyberSwap** ⭐ **START HERE**
   - Why: Jumper's best route uses KyberSwap
   - Impact: High - Will show real prices immediately
   - Guide: `docs/KYBERSWAP_SETUP.md`

2. **1inch**
   - Why: Good coverage, competitive prices
   - Impact: High
   - Guide: `docs/EXACT_SIGNUP_STEPS.md` (section 2)

3. **Paraswap**
   - Why: Competitive prices
   - Impact: High
   - Guide: `docs/EXACT_SIGNUP_STEPS.md` (section 3)

4. **SushiSwap**
   - Why: Also shown in Jumper
   - Impact: Medium-High
   - Guide: `docs/EXACT_SIGNUP_STEPS.md` (section 4)

5. **OKX**
   - Why: Also shown in Jumper
   - Impact: Medium-High
   - Guide: `docs/EXACT_SIGNUP_STEPS.md` (section 5)

---

### Phase 2: Additional Aggregators ⭐⭐

6. **OpenOcean**
7. **Odos**
8. **DODO**
9. **Bebop**
10. **0x**
11. **LI.FI**

---

### Phase 3: Direct DEXs (If They Have APIs) ⭐

12-35. **All Direct DEXs** (Uniswap V3, Curve, PancakeSwap, etc.)
   - Note: Many direct DEXs don't have APIs (use contract calls)
   - Focus on ones with APIs first

---

## 🚀 Step-by-Step: Starting with KyberSwap

### Step 1: Get KyberSwap API Key

**Time**: 15-30 minutes

1. **Visit Quickstart Guide**:
   - URL: https://docs.kyberswap.com/getting-started/quickstart
   - Click: "Execute A Swap With The Aggregator API"

2. **Check API Requirements**:
   - Read the documentation
   - See if API key is required or optional
   - Note the authentication method

3. **Get API Key** (if required):
   - Check if there's a signup form
   - If not, contact KyberSwap:
     - Discord: https://discord.gg/kyberswap
     - GitHub: https://github.com/KyberNetwork/kyberswap-aggregator-sdk
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Use case: DEX Aggregator platform

4. **Copy Your API Key**:
   - Save it securely (password manager recommended)

---

### Step 2: Add KyberSwap Key to MonetaDEX

**Time**: 2 minutes

**Option A: Use Helper Script** (Easiest)
```bash
bash scripts/add-api-key.sh
```
- Select option `6` for KyberSwap
- Paste your API key
- Done!

**Option B: Manual Edit**
```bash
code services/swaps-api/.env
# or
nano services/swaps-api/.env
```

Add:
```env
KYBERSWAP_API_KEY=your_kyberswap_key_here
```

---

### Step 3: Restart API

**Time**: 1 minute

```bash
# Stop current API (Ctrl+C in terminal running it)
# Then restart:
pnpm --filter @fortuna/swaps-api dev
```

---

### Step 4: Verify KyberSwap is Working

**Time**: 2 minutes

**Check Status**:
```bash
bash scripts/check-api-keys.sh
```

Should show:
```
✅ KYBERSWAP_API_KEY: SET (kybe****key)
```

**Test Provider Health**:
```bash
curl http://localhost:3001/v1/health/providers | python3 -m json.tool | grep -A 5 kyberswap
```

Should show:
- `"isHealthy": true`
- `"lastSuccessAt"`: recent timestamp

**Test Real Quote**:
```bash
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

**Expected**: Should see routes with ~5,290 BRLA (not 996 BRLA mock price)

**Compare with Jumper**:
```bash
bash scripts/test-real-prices.sh
```

Should show KyberSwap route beating or matching Jumper's 5,290.743098 BRLA!

---

### Step 5: Mark Complete & Move to Next

✅ **KyberSwap Complete!**

Now move to **1inch** (next in priority list)

---

## 📝 Progress Tracker

Use this checklist to track your progress:

### Phase 1: Critical (Priority) ⭐⭐⭐
- [ ] 1. KyberSwap ⭐ **START HERE**
- [ ] 2. 1inch
- [ ] 3. Paraswap
- [ ] 4. SushiSwap
- [ ] 5. OKX

### Phase 2: Additional Aggregators ⭐⭐
- [ ] 6. OpenOcean
- [ ] 7. Odos
- [ ] 8. DODO
- [ ] 9. Bebop
- [ ] 10. 0x
- [ ] 11. LI.FI

### Phase 3: Direct DEXs (If APIs Available) ⭐
- [ ] 12-35. Direct DEXs (check each if API available)

---

## 🔄 Workflow for Each API Key

For **each** API key, follow this workflow:

1. **Get API Key** (15-30 min)
   - Visit aggregator website
   - Sign up / request access
   - Get API key

2. **Add to MonetaDEX** (2 min)
   ```bash
   bash scripts/add-api-key.sh
   # or manual edit
   ```

3. **Restart API** (1 min)
   ```bash
   pnpm --filter @fortuna/swaps-api dev
   ```

4. **Verify Working** (2 min)
   ```bash
   bash scripts/check-api-keys.sh
   curl http://localhost:3001/v1/health/providers
   ```

5. **Test Real Prices** (2 min)
   ```bash
   bash scripts/test-real-prices.sh
   ```

6. **Mark Complete** ✅
   - Check off in progress tracker
   - Move to next

**Total Time per Key**: ~20-40 minutes

---

## 🎯 Quick Reference: All API Keys Needed

### Aggregators (11)
```env
KYBERSWAP_API_KEY=
ONEINCH_API_KEY=
PARASWAP_API_KEY=
SUSHISWAP_API_KEY=
OKX_ACCESS_KEY=
OPENOCEAN_API_KEY=
ODOS_API_KEY=
ODOS_PARTNER_CODE=
DODO_API_KEY=
BEBOP_API_KEY=
ZEROX_API_KEY=
LIFI_API_KEY=
```

### Direct DEXs (Most don't need API keys - use contract calls)
- Uniswap V3, V2: No API key (contract calls)
- Curve: No API key (contract calls)
- PancakeSwap: Check if API available
- Balancer V2: No API key (contract calls)
- Most others: Contract calls, no API keys needed

**Note**: Direct DEXs typically use smart contract calls via viem, not APIs. Focus on aggregator API keys first!

---

## 📚 Resources

- **KyberSwap Setup**: `docs/KYBERSWAP_SETUP.md`
- **Exact Signup Steps**: `docs/EXACT_SIGNUP_STEPS.md`
- **API Keys Guide**: `docs/GET_API_KEYS_GUIDE.md`
- **Helper Script**: `scripts/add-api-key.sh`
- **Check Status**: `scripts/check-api-keys.sh`
- **Test Prices**: `scripts/test-real-prices.sh`

---

## ✅ Success Criteria

### After Phase 1 (5 Critical Keys):
- ✅ Real market prices (not mock)
- ✅ Competitive with Jumper
- ✅ Multiple routes from real aggregators
- ✅ Prices show ~5,290 BRLA (not 996 BRLA)

### After Phase 2 (All Aggregators):
- ✅ Maximum liquidity coverage
- ✅ Best route discovery
- ✅ Competitive pricing across all chains

### After Phase 3 (If Applicable):
- ✅ All possible APIs configured
- ✅ Maximum price discovery

---

## 🚀 Let's Start: KyberSwap

**Ready to begin?** Follow the steps above starting with KyberSwap!

1. Visit: https://docs.kyberswap.com/getting-started/quickstart
2. Get API key
3. Add using: `bash scripts/add-api-key.sh`
4. Test: `bash scripts/test-real-prices.sh`
5. Celebrate when you see real prices! 🎉

---

**Last Updated**: 2026-01-27  
**Status**: Ready to start with KyberSwap! 🚀  
**Next**: Get KyberSwap API key → Add to MonetaDEX → Test → Move to 1inch

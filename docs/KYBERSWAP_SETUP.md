# KyberSwap API Setup Guide 🚀

**Priority**: #1 (Jumper's best route uses KyberSwap!)  
**Quickstart**: https://docs.kyberswap.com/getting-started/quickstart

---

## 📚 Step 1: Read the Quickstart Guide

1. **Visit**: https://docs.kyberswap.com/getting-started/quickstart
2. **Find**: "Developer Guides" section
3. **Click**: "Execute A Swap With The Aggregator API"
   - Direct link: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api

---

## 🔍 Step 2: Understand the API

### API Endpoint Structure

**Base URL**: `https://aggregator-api.kyberswap.com`

**Quote Endpoint**: `/{chain}/v1/routes`

**Example for Polygon**:
```
GET https://aggregator-api.kyberswap.com/polygon/v1/routes?tokenIn=0x...&tokenOut=0x...&amountIn=1000000000
```

### Supported Chains

Our adapter supports these chains (mapped to KyberSwap chain names):
- `ethereum` (Chain ID: 1)
- `optimism` (Chain ID: 10)
- `bsc` (Chain ID: 56)
- `polygon` (Chain ID: 137) ⭐ **We use this for USDC→BRLA**
- `base` (Chain ID: 8453)
- `arbitrum` (Chain ID: 42161)
- `avalanche` (Chain ID: 43114)
- `scroll` (Chain ID: 534352)
- `mantle` (Chain ID: 5000)
- `blast` (Chain ID: 81457)
- `mode` (Chain ID: 34443)

---

## 🔑 Step 3: Get API Key (If Required)

### Check Documentation First

The KyberSwap Aggregator API may work without an API key for basic usage, but:
- **Production use** may require an API key
- **Higher rate limits** with API key
- **Better reliability** with dedicated key

### How to Get API Key

1. **Check the Quickstart Guide**: 
   - https://docs.kyberswap.com/getting-started/quickstart
   - Look for "API Key" or "Authentication" section

2. **Contact KyberSwap** (if key is required):
   - **Discord**: https://discord.gg/kyberswap
   - **GitHub**: https://github.com/KyberNetwork/kyberswap-aggregator-sdk
   - **Email**: dex@monetadex.com
   - **Company**: MonetaDEX
   - **Use Case**: DEX Aggregator platform for best price discovery

3. **Provide Information**:
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Project: DEX Aggregator Platform
   - Expected Volume: High (production use)
   - Use Case: Token swap aggregation across multiple chains

---

## ✅ Step 4: Add API Key to MonetaDEX

### Option 1: Use Helper Script (Recommended)

```bash
bash scripts/add-api-key.sh
```

Select option `1` for KyberSwap, then paste your API key.

### Option 2: Manual Edit

```bash
code services/swaps-api/.env
# or
nano services/swaps-api/.env
```

Add:
```env
KYBERSWAP_API_KEY=your_api_key_here
```

---

## 🧪 Step 5: Test the Integration

### Check API Key Status

```bash
bash scripts/check-api-keys.sh
```

Should show:
```
✅ KYBERSWAP_API_KEY: SET (kybe****key)
```

### Restart API

```bash
# Stop current API (Ctrl+C)
pnpm --filter @fortuna/swaps-api dev
```

### Test Quote

```bash
# Test USDC → BRLA on Polygon (1000 USDC)
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

### Compare with Jumper

```bash
bash scripts/test-real-prices.sh
```

**Goal**: Beat Jumper's 5,290.743098 BRLA! 🏆

---

## 📊 How Our Adapter Works

Our `KyberSwapAdapter` in `services/swaps-api/src/adapters/kyberSwap.ts`:

1. **Maps Chain IDs**: Converts our chain IDs to KyberSwap chain names
2. **Calls Quote Endpoint**: `GET /{chain}/v1/routes`
3. **Parameters**:
   - `tokenIn`: From token address
   - `tokenOut`: To token address
   - `amountIn`: Amount to swap
   - `feeAddress`: Our fee recipient (for partner fees)
   - `feePcm`: Fee in per cent mille (10 BPS = 100 pcm)
4. **Processes Response**: Converts to our Route format
5. **Returns**: Best routes for ranking

---

## 🔧 API Key Configuration

### Current Status

Check if API key is needed:
```bash
# Check .env file
grep KYBERSWAP_API_KEY services/swaps-api/.env
```

### If API Key Not Required

KyberSwap API may work without key for:
- Development/testing
- Low volume usage
- Basic quotes

### If API Key Required

You'll need it for:
- Production use
- Higher rate limits
- Better reliability
- Partner fee collection

---

## 🚨 Troubleshooting

### "API key not working"
- Verify key is correct (no extra spaces)
- Check if key is active in KyberSwap dashboard
- Verify you're using the right endpoint

### "Still showing mock prices"
- Make sure API was restarted after adding key
- Check `.env` file location (`services/swaps-api/.env`)
- Verify key variable name: `KYBERSWAP_API_KEY`

### "No routes returned"
- Check if chain is supported
- Verify token addresses are correct
- Check API response for errors
- May need to contact KyberSwap support

---

## 📚 Additional Resources

- **Quickstart**: https://docs.kyberswap.com/getting-started/quickstart
- **Aggregator API Docs**: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api
- **Discord**: https://discord.gg/kyberswap
- **GitHub SDK**: https://github.com/KyberNetwork/kyberswap-aggregator-sdk

---

## ✅ Success Criteria

**Before**:
- Mock mode: 1000 USDC → 996 BRLA (fake)

**After**:
- Real API: 1000 USDC → ~5,290 BRLA (real market price)
- **Goal**: Beat Jumper's 5,290.743098 BRLA! 💪

---

**Last Updated**: 2026-01-27  
**Email**: dex@monetadex.com  
**Quickstart**: https://docs.kyberswap.com/getting-started/quickstart

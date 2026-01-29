# BRLA Token Added to Polygon

## Token Details

**Contract Address:** `0xE6A537a407488807F0bbeb0038B79004f19DDDFb`  
**Symbol:** BRLA  
**Name:** BRLA Digital  
**Chain:** Polygon (Chain ID: 137)  
**Decimals:** 18  
**Logo URL:** https://cdn.coinranking.com/eSBgf0j3M/BRLA.png

## About BRLA

BRLA is a Brazilian Real-pegged stablecoin (1:1 with BRL) managed by Avenia. It's designed for:
- Cross-border transactions
- Business payment solutions
- DeFi participation
- Efficient Brazilian Real exposure on blockchain

## Integration Status

✅ **Added to token list** - BRLA is now the first token in the Polygon token list  
✅ **Config package rebuilt** - Changes compiled successfully  
⚠️ **API restart needed** - The swaps-api service needs to be restarted to pick up the new token

## How to Verify

1. **Restart the API:**
   ```bash
   # Stop current API
   pkill -f "tsx watch.*swaps-api"
   
   # Restart API
   pnpm --filter @fortuna/swaps-api dev
   ```

2. **Test the API endpoint:**
   ```bash
   curl "http://localhost:3001/v1/tokens?chainId=137"
   ```

3. **Check in frontend:**
   - Open http://localhost:3000
   - Select Polygon chain
   - BRLA should appear as the first token in the list

## Token Priority

BRLA is placed first in the Polygon token list since it will be the most traded token on MonetaDEX.

## Next Steps

- [ ] Restart API to load new token
- [ ] Verify token appears in frontend
- [ ] Test swap functionality with BRLA
- [ ] Verify token logo displays correctly
- [ ] Test quote fetching for BRLA pairs

---

**Note:** If the token doesn't appear after restarting, check:
1. Config package is built (`pnpm --filter @fortuna/config build`)
2. API is using the latest config build
3. Frontend is calling the correct API endpoint

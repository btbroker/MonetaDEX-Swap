# API Keys Priority List - Get Real Prices! 💰

**Goal**: Get API keys to replace mock prices with real market prices  
**Current**: Mock mode = 996 BRLA (fake)  
**Target**: Real prices = ~5,290 BRLA (real market)

---

## 💵 Platform fee: 15 BPS on every chain

MonetaDEX collects **15 BPS (0.15%)** on all swaps across all chains. This is set in code and `.env` as `PLATFORM_FEE_BPS=15`.

- **Profitable**: 15 BPS drives revenue while staying competitive.
- **Competitive**: Keeps us in line with or better than Jumper and other DEX aggregators.
- **BRLA focus**: We aim to have the **best price on BRLA** vs competitors; aggregator coverage + 15 BPS helps achieve that.

To change the fee (e.g. per chain later), set `PLATFORM_FEE_BPS` in `services/swaps-api/.env`; the default in code is 15.

**Are API keys still needed for fee collection?**  
**Yes.** We collect 15 BPS by passing our fee recipient + BPS into each aggregator’s API (e.g. KyberSwap `feeReceiver`/`feeAmount`, 0x affiliate, Paraswap fee params). To do that we must call their **real** API (not mock). So for each provider:

- **With API key**: We get real quotes, build real tx calldata with our fee embedded → user executes → fee is sent to our wallet.
- **Without API key**: We’re in mock mode or heavily rate-limited → no real routes, no on-chain execution, **no fee collected** for that provider.

One fee config (15 BPS + `FEE_RECIPIENT_*` per chain) is used for all providers; each API key unlocks that provider so we can send that fee config and actually collect.

**App still showing mock prices?**  
1. **Restart the swaps-api** after adding keys (so it loads `services/swaps-api/.env`).  
2. **Check providers:** open **http://localhost:3001/v1/providers** — you should see `withKeys: ["zerox", "okx"]` (or whichever keys you set). If they’re in `disabled`, the API didn’t load `.env` or the keys aren’t in that file.  
3. **Frontend** uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`). Ensure the API is running on that port.

---

## 🎯 Priority Order (Most Impact First)

### ✅ Already Added
- [x] **0x** - API Key: `889f161d-99c3-43a8-ada7-3226847dc8eb` ✅ **DONE**
- [x] **OKX** - API Key set in `.env` ✅ **DONE** — real prices + **revenue sharing** (15 BPS to `FEE_RECIPIENT_*`)

---

### 🔥 Critical Priority (Get These Next) ⭐⭐⭐

These will give you **immediate real prices** and **competitive advantage**:

#### 1. **Paraswap** ⭐ **YOU'RE DOING THIS FIRST**
- **Why**: Competitive prices, good liquidity coverage
- **Impact**: HIGH - Will show real market prices immediately
- **Expected Price**: ~5,290 BRLA (instead of 996 BRLA mock)
- **Get Key**: https://developers.paraswap.network/
- **Email**: dex@monetadex.com
- **Status**: ⏳ **NEXT**

#### 2. **KyberSwap** ⭐
- **Why**: Jumper's BEST route uses KyberSwap (5,290.743098 BRLA)
- **Impact**: HIGH - Will match or beat Jumper's prices
- **Expected Price**: ~5,290 BRLA (Jumper's best route)
- **API key**: **Not required** for quotes/swaps — Aggregator API is permissionless.
- **Partner fees (15 BPS)**: Require onboarding — wallet validation + fee source registration. See **[KYBERSWAP_PARTNER_FEE_ONBOARDING.md](./KYBERSWAP_PARTNER_FEE_ONBOARDING.md)** for KyberSwap’s email and next steps (share feeReceiver, chains/tokens, volume).
- **Status**: ⏳ Pending (send feeReceiver + chains/tokens + volume to KyberSwap to enable production fees)

#### 3. **1inch** ⭐
- **Why**: Good coverage, competitive prices, $60M+ daily volume
- **Impact**: HIGH - Major aggregator, will add many routes
- **Expected Price**: ~5,280-5,290 BRLA (competitive)
- **Get Key**: https://business.1inch.com/portal
- **Email**: dex@monetadex.com
- **Status**: ⏳ Pending

#### 4. **SushiSwap** ⭐
- **Why**: Also shown in Jumper's routes
- **Impact**: MEDIUM-HIGH - Established aggregator
- **Expected Price**: ~5,285 BRLA (competitive)
- **Get Key**: https://docs.sushi.com/api/swap
- **Contact**: dev@sushi.com or Discord
- **Status**: ⏳ Pending

#### 5. **OKX** ⭐ ✅ DONE
- **Why**: Also shown in Jumper's routes
- **Impact**: MEDIUM-HIGH - Major exchange aggregator
- **Expected Price**: ~5,285 BRLA (competitive)
- **Status**: ✅ **API key added** — real prices + revenue sharing (15 BPS)

---

### 📊 Additional Aggregators (Get After Critical) ⭐⭐

#### 6. **OpenOcean**
- **Why**: Strong on newer chains (Base, Scroll, Mantle, Blast, Mode)
- **Impact**: MEDIUM - Better coverage on newer chains
- **Expected Price**: ~5,280 BRLA
- **Get Key**: https://docs.openocean.finance/
- **Status**: ⏳ Pending

#### 7. **Odos**
- **Why**: Advanced routing, often finds better prices
- **Impact**: MEDIUM - Competitive pricing advantage
- **Expected Price**: ~5,290 BRLA (sometimes better)
- **Get Key**: https://docs.odos.xyz/
- **Partner Code**: https://referral.odos.xyz/ (for affiliate fees)
- **Status**: ⏳ Pending

#### 8. **DODO**
- **Why**: SmartTrade routing, competitive
- **Impact**: MEDIUM - Good prices
- **Expected Price**: ~5,280 BRLA
- **Get Key**: https://docs.dodoex.io/
- **Status**: ⏳ Pending

#### 9. **Bebop**
- **Why**: PMM + JAM routing, good prices
- **Impact**: MEDIUM - Competitive
- **Expected Price**: ~5,280 BRLA
- **Get Key**: https://docs.bebop.xyz/
- **Status**: ⏳ Pending

#### 10. **LI.FI**
- **Why**: Cross-chain bridges (for cross-chain swaps)
- **Impact**: MEDIUM - Enables cross-chain swaps
- **Expected Price**: Varies (cross-chain fees)
- **Get Key**: https://docs.li.fi/
- **Status**: ⏳ Pending

---

## 📈 Expected Price Improvements

### Current (Mock Mode)
```
1000 USDC → 996.5025 BRLA ❌ (Fake price)
```

### After Adding Critical APIs (Paraswap, KyberSwap, 1inch)
```
1000 USDC → ~5,290 BRLA ✅ (Real market price)
```

### After Adding All Aggregators
```
1000 USDC → ~5,290-5,295 BRLA ✅ (Best price from all sources)
```

**Improvement**: **~431% better prices!** 🚀

---

## 🎯 Your Action Plan

### Step 1: Paraswap (You're Doing This First) ⭐

1. **Get API Key**:
   - Visit: https://developers.paraswap.network/
   - Check if API key is required (may work without key)
   - If needed: Contact support or sign up
   - Email: dex@monetadex.com

2. **Add to MonetaDEX**:
   ```bash
   bash scripts/add-api-key.sh
   ```
   - Select: `3` (Paraswap)
   - Paste your API key

3. **Restart API**:
   ```bash
   pnpm --filter @fortuna/swaps-api dev
   ```

4. **Test**:
   ```bash
   bash scripts/test-real-prices.sh
   ```

**Expected**: Should see ~5,290 BRLA (not 996 BRLA)!

---

### Step 2: KyberSwap (Next Priority)

1. **Get API Key**:
   - Visit: https://docs.kyberswap.com/getting-started/quickstart
   - Contact via Discord: https://discord.gg/kyberswap
   - Email: dex@monetadex.com

2. **Add**: `bash scripts/add-api-key.sh` → Select `1` (KyberSwap)

3. **Test**: `bash scripts/test-real-prices.sh`

---

### Step 3: 1inch (Next Priority)

1. **Get API Key**:
   - Visit: https://business.1inch.com/portal
   - Sign up with: dex@monetadex.com
   - Get key from dashboard

2. **Add**: `bash scripts/add-api-key.sh` → Select `2` (1inch)

3. **Test**: `bash scripts/test-real-prices.sh`

---

## 📊 Price Comparison Table

| Provider | Mock Price | Real Price (Expected) | Impact |
|----------|------------|----------------------|--------|
| **Current (Mock)** | 996 BRLA | - | ❌ Fake |
| **0x** ✅ | - | ~5,285 BRLA | ✅ Real |
| **Paraswap** ⏳ | - | ~5,290 BRLA | ✅ Real |
| **KyberSwap** ⏳ | - | ~5,290 BRLA | ✅ Real (Jumper's best) |
| **1inch** ⏳ | - | ~5,280-5,290 BRLA | ✅ Real |
| **SushiSwap** ⏳ | - | ~5,285 BRLA | ✅ Real |
| **OKX** ⏳ | - | ~5,285 BRLA | ✅ Real |
| **All Combined** | - | **~5,290-5,295 BRLA** | ✅ **BEST** |

---

## 🎯 Success Criteria

### After Paraswap (First Key):
- ✅ Real prices (~5,290 BRLA)
- ✅ No more mock prices
- ✅ Competitive with Jumper

### After Critical 5 (Paraswap, KyberSwap, 1inch, SushiSwap, OKX):
- ✅ Best prices from top aggregators
- ✅ Multiple routes competing
- ✅ Beat or match Jumper's prices

### After All Aggregators:
- ✅ Maximum liquidity coverage
- ✅ Best route discovery
- ✅ Competitive pricing across all chains

---

## 📋 Quick Checklist

**Critical APIs (Get These First)**:
- [x] 0x ✅ **DONE**
- [ ] Paraswap ⏳ **YOU'RE DOING THIS FIRST**
- [ ] KyberSwap
- [ ] 1inch
- [ ] SushiSwap
- [ ] OKX

**Additional APIs (Get Later)**:
- [ ] OpenOcean
- [ ] Odos (+ Partner Code)
- [ ] DODO
- [ ] Bebop
- [ ] LI.FI

---

## 🚀 Next Steps

1. **Get Paraswap API Key** (you're doing this first)
2. **Add it**: `bash scripts/add-api-key.sh`
3. **Test**: `bash scripts/test-real-prices.sh`
4. **See real prices**: Should show ~5,290 BRLA! 🎉
5. **Move to next**: KyberSwap

---

**Last Updated**: 2026-01-27  
**Current**: 0x ✅ Added  
**Next**: Paraswap ⏳ (You're doing this first!)  
**Goal**: Real prices = ~5,290 BRLA (not 996 BRLA mock)

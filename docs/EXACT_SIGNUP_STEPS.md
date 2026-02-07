# Exact Signup Steps - Get All API Keys 🎯

**Email**: dex@monetadex.com  
**Goal**: Get all 11 API keys to beat Jumper!

---

## 🔥 Critical Keys (Get These First!)

### 1. KyberSwap ⭐⭐⭐ **PRIORITY #1**

**Why**: Jumper's BEST route (5,290.743098 BRLA)

**Steps**:
1. **Start Here**: Visit https://docs.kyberswap.com/getting-started/quickstart
2. **Go to Developer Guides**: Click on "Execute A Swap With The Aggregator API"
   - Direct link: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api
3. **Check API Documentation**: Look for API key requirements
4. **API Endpoint**: `https://aggregator-api.kyberswap.com/{chain}/v1/routes`
5. **Get API Key**:
   - May need to contact KyberSwap team
   - Join Discord: https://discord.gg/kyberswap
   - Check GitHub: https://github.com/KyberNetwork/kyberswap-aggregator-sdk
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Use case: DEX Aggregator platform

**Note**: KyberSwap Aggregator API may require API key for production use. Check the quickstart guide for current requirements.

---

### 2. 1inch ⭐⭐⭐ **PRIORITY #2**

**Why**: Good coverage, competitive prices

**Exact Steps**:
1. Visit: https://business.1inch.com/portal
2. Click "Sign in" or "Register"
3. Sign up with:
   - Email: dex@monetadex.com
   - Or use Google/GitHub login
4. **Note**: May require KYC verification
5. After login, go to **Dashboard**
6. Click **Application** at bottom
7. Your API key will be there
8. Copy it immediately!

**Alternative**: https://portal.1inch.dev/documentation

---

### 3. Paraswap ⭐⭐⭐ **PRIORITY #3**

**Why**: Competitive prices

**Exact Steps**:
1. Visit: https://developers.paraswap.network/
2. **Note**: Public API works WITHOUT key (but key gives better limits)
3. For dedicated key:
   - Visit: https://help.paraswap.io/en/
   - Contact support
   - Email: dex@monetadex.com
   - Request: "Dedicated API key for corporate use"
4. They'll provide key via email

**Public API**: Works without key, but dedicated key = better reliability

---

### 4. SushiSwap ⭐⭐ **PRIORITY #4**

**Why**: Also shown in Jumper

**Exact Steps**:
1. Visit: https://docs.sushi.com/api/swap
2. API key format: `sushi_abcdefghijklmnopqr`
3. To get key:
   - Visit: https://dev.sushi.com/
   - Check for "API Access" or "Developer Portal"
   - May need to contact: dev@sushi.com
   - Or join Discord: https://discord.gg/sushi
4. Request API key with:
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Use case: DEX Aggregator

**Note**: API key is optional for basic usage, but recommended.

---

### 5. OKX ⭐⭐ **PRIORITY #5**

**Why**: Also shown in Jumper

**Exact Steps**:
1. Visit: https://web3.okx.com/build/dev-docs/wallet-api/developer-portal
2. Click "Developer portal" under Build navigation
3. Click "Connect Wallet" (OKX Wallet recommended)
4. Click "Verify" and confirm signature
5. Click "Link now" → "Setting" tab
6. Enter:
   - Email: dex@monetadex.com
   - Phone number
   - Complete verification
7. Go to "API keys" page
8. Click "Create API key"
9. Enter name and passphrase
10. **IMPORTANT**: Copy secret key immediately (shown only once!)

**Note**: You'll need:
- API key (OK-ACCESS-KEY)
- Secret key (for signing)
- Passphrase (you create)

---

## 📋 Additional Keys

### 6. OpenOcean

**Steps**:
1. Visit: https://docs.openocean.finance/
2. Look for "API Key" section
3. Sign up: dex@monetadex.com
4. Get key

**Rate Limit**: 2 RPS (free tier)

---

### 7. Odos

**Steps**:
1. Visit: https://docs.odos.xyz/
2. Sign up: dex@monetadex.com
3. Get API key
4. **Also get Partner Code**:
   - Visit: https://referral.odos.xyz/
   - Register for partner code
   - This enables affiliate fees!

---

### 8. DODO

**Steps**:
1. Visit: https://docs.dodoex.io/
2. Look for API section
3. Sign up: dex@monetadex.com
4. Get key

---

### 9. Bebop

**Steps**:
1. Visit: https://docs.bebop.xyz/
2. Look for API section
3. Sign up: dex@monetadex.com
4. Get key

---

### 10. 0x

**Steps**:
1. Visit: https://0x.org/docs/api
2. Sign up for API access: dex@monetadex.com
3. Get API key

**Rate Limit**: 100 req/min (free tier)

---

### 11. LI.FI

**Steps**:
1. Visit: https://docs.li.fi/
2. Look for API key section
3. Sign up: dex@monetadex.com
4. Get key

**Note**: Mainly for cross-chain bridges

---

## 🚀 Quick Action Plan

### Step 1: Open All Critical Sites (5 tabs)

Open these in separate browser tabs:
1. https://business.1inch.com/portal (1inch)
2. https://developers.paraswap.network/ (Paraswap)
3. https://web3.okx.com/build/dev-docs/wallet-api/developer-portal (OKX)
4. https://docs.sushi.com/api/swap (SushiSwap)
5. https://docs.kyberswap.com/ (KyberSwap - may need to contact)

### Step 2: Sign Up for All

Use email: **dex@monetadex.com** for all

### Step 3: Check Email

Check **dex@monetadex.com** (and spam folder) for:
- Verification emails
- API keys
- Access confirmations

### Step 4: Add Keys to MonetaDEX

**Option A: Use Helper Script** (Easiest)
```bash
bash scripts/add-api-key.sh
```

**Option B: Manual Edit**
```bash
code services/swaps-api/.env
```

Add each key:
```env
KYBERSWAP_API_KEY=paste_here
ONEINCH_API_KEY=paste_here
PARASWAP_API_KEY=paste_here
SUSHISWAP_API_KEY=paste_here
OKX_ACCESS_KEY=paste_here
# ... etc
```

### Step 5: Verify & Test

```bash
# Check status
bash scripts/check-api-keys.sh

# Restart API
pnpm --filter @fortuna/swaps-api dev

# Test prices
bash scripts/test-real-prices.sh
```

---

## 📊 Progress Tracker

Copy this and check off as you go:

```
Critical Keys:
[ ] 1. KyberSwap - https://docs.kyberswap.com/
[ ] 2. 1inch - https://business.1inch.com/portal
[ ] 3. Paraswap - https://developers.paraswap.network/
[ ] 4. SushiSwap - https://docs.sushi.com/api/swap
[ ] 5. OKX - https://web3.okx.com/build/dev-docs/wallet-api/developer-portal

Additional Keys:
[ ] 6. OpenOcean - https://docs.openocean.finance/
[ ] 7. Odos - https://docs.odos.xyz/ (+ partner code)
[ ] 8. DODO - https://docs.dodoex.io/
[ ] 9. Bebop - https://docs.bebop.xyz/
[ ] 10. 0x - https://0x.org/docs/api
[ ] 11. LI.FI - https://docs.li.fi/
```

---

## 🎯 Success Criteria

**Minimum**: Get 3 critical keys (1inch, Paraswap, OKX)  
**Ideal**: Get all 5 critical keys  
**Perfect**: Get all 11 keys! 🏆

**Expected Result**:
- Before: 996 BRLA (mock)
- After: ~5,290 BRLA (real prices)
- Goal: **BEAT JUMPER'S 5,290.743098 BRLA!** 💪

---

## 🆘 Need Help?

If you get stuck:
1. Check the aggregator's Discord/Telegram
2. Look for "Contact" or "Support" on their website
3. Check their documentation for alternative methods

---

**Last Updated**: 2026-01-27  
**Email**: dex@monetadex.com  
**Status**: Ready to get all keys! 🚀

# API Keys Quick Start Guide 🚀

**Start Here**: KyberSwap (Priority #1)

---

## 🎯 Step 1: Get KyberSwap API Key (15-30 min)

1. **Visit**: https://docs.kyberswap.com/getting-started/quickstart
2. **Click**: "Execute A Swap With The Aggregator API"
3. **Check**: If API key is required
4. **Get Key**: 
   - If signup available: Use dex@monetadex.com
   - If not: Contact via Discord (https://discord.gg/kyberswap)
5. **Copy Key**: Save it securely

---

## ✅ Step 2: Add Key to MonetaDEX (2 min)

**Easy Way**:
```bash
bash scripts/add-api-key.sh
```
- Select: `6` (KyberSwap)
- Paste: Your API key
- Done!

**Manual Way**:
```bash
code services/swaps-api/.env
```
Add:
```env
KYBERSWAP_API_KEY=paste_your_key_here
```

---

## 🔄 Step 3: Restart API (1 min)

```bash
# Stop current API (Ctrl+C)
pnpm --filter @fortuna/swaps-api dev
```

---

## 🧪 Step 4: Test It Works (2 min)

**Check Status**:
```bash
bash scripts/check-api-keys.sh
```

**Test Real Prices**:
```bash
bash scripts/test-real-prices.sh
```

**Expected**: Should see ~5,290 BRLA (not 996 BRLA mock price)

---

## ✅ Step 5: Mark Complete & Move to Next

✅ **KyberSwap Done!**

**Next**: 1inch (Priority #2)

---

## 📋 Full Priority List

1. ✅ KyberSwap ⭐ **START HERE**
2. ⏳ 1inch
3. ⏳ Paraswap
4. ⏳ SushiSwap
5. ⏳ OKX
6. ⏳ OpenOcean
7. ⏳ Odos
8. ⏳ DODO
9. ⏳ Bebop
10. ⏳ 0x
11. ⏳ LI.FI

**Full Plan**: `docs/API_KEYS_IMPLEMENTATION_PLAN.md`

---

**Ready?** Start with KyberSwap now! 🚀

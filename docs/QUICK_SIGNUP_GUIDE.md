# Quick Signup Guide - Get All API Keys Fast! 🚀

**Goal**: Get all 11 API keys to beat Jumper's prices  
**Email**: dex@monetadex.com  
**Time**: ~30-60 minutes (depending on email verification)

---

## 🎯 Strategy: Sign Up for All at Once

Since most require email verification, sign up for all of them in parallel, then verify emails as they arrive.

---

## 📋 Signup Order (Priority)

### Batch 1: Critical (Do These First) ⭐⭐⭐

Open these in separate browser tabs:

1. **KyberSwap**: https://docs.kyberswap.com/getting-started/quickstart
   - Start with Quickstart guide
   - Go to "Execute A Swap With The Aggregator API"
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Use case: DEX Aggregator

2. **1inch**: https://portal.1inch.io/
   - Email: dex@monetadex.com
   - Sign up and verify

3. **Paraswap**: https://developers.paraswap.io/
   - Email: dex@monetadex.com
   - Company: MonetaDEX
   - Use case: Token swap aggregation

### Batch 2: Also in Jumper ⭐⭐

4. **SushiSwap**: 
   - Check: https://docs.sushi.com/
   - May need to email: dev@sushi.com
   - Or Discord: https://discord.gg/sushi

5. **OKX**: https://www.okx.com/web3/build/docs/dex/aggregator/overview
   - Sign up with OKX account
   - Get API key from dashboard

### Batch 3: Additional Coverage ⭐

6. **OpenOcean**: https://docs.openocean.finance/
7. **Odos**: https://docs.odos.xyz/ (+ https://referral.odos.xyz/ for partner code)
8. **DODO**: https://docs.dodoex.io/
9. **Bebop**: https://docs.bebop.xyz/
10. **0x**: https://0x.org/docs/api
11. **LI.FI**: https://docs.li.fi/

---

## 📧 Email Verification Checklist

As verification emails arrive, check them off:

```
[ ] KyberSwap verification
[ ] 1inch verification
[ ] Paraswap verification
[ ] SushiSwap (if required)
[ ] OKX verification
[ ] OpenOcean verification
[ ] Odos verification
[ ] DODO verification
[ ] Bebop verification
[ ] 0x verification
[ ] LI.FI verification
```

**Tip**: Check spam folder! Some emails may go there.

---

## 🔑 After Getting Keys

### Option 1: Use the Helper Script (Easiest)

```bash
bash scripts/add-api-key.sh
```

This interactive script will:
- Show you all available keys
- Let you select which one to add
- Safely add it to `.env`
- Show next steps

### Option 2: Manual Edit

```bash
code services/swaps-api/.env
# or
nano services/swaps-api/.env
```

Add keys like:
```env
KYBERSWAP_API_KEY=your_key_here
ONEINCH_API_KEY=your_key_here
# ... etc
```

---

## ✅ Verification Steps

After adding keys:

1. **Check status**:
   ```bash
   bash scripts/check-api-keys.sh
   ```

2. **Restart API**:
   ```bash
   # Stop current API (Ctrl+C)
   pnpm --filter @fortuna/swaps-api dev
   ```

3. **Test prices**:
   ```bash
   bash scripts/test-real-prices.sh
   ```

4. **Compare with Jumper**:
   - Jumper: 5,290.743098 BRLA
   - MonetaDEX: Should show similar or BETTER! 🏆

---

## 🚨 Common Issues

### "Email not verified"
- Check spam folder
- Resend verification email
- Some services may take a few minutes

### "API key not working"
- Make sure no extra spaces
- Check key is active in dashboard
- Verify you copied the full key

### "Still showing mock prices"
- Make sure API was restarted
- Check `.env` file has correct variable names
- Verify keys are in `services/swaps-api/.env` (not root)

---

## 📊 Progress Tracking

Track your progress:

```
Critical Keys (Priority):
[ ] KyberSwap
[ ] 1inch
[ ] Paraswap
[ ] SushiSwap
[ ] OKX

Additional Keys:
[ ] OpenOcean
[ ] Odos (+ Partner Code)
[ ] DODO
[ ] Bebop
[ ] 0x
[ ] LI.FI
```

---

## 🎉 Success!

Once you have at least 3 critical keys:
- ✅ Real market prices
- ✅ Competitive with Jumper
- ✅ Ready to beat them! 💪

---

**Last Updated**: 2026-01-27  
**Email**: dex@monetadex.com

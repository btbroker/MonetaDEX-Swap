# API Key Signup Template - Quick Reference

Use this template when signing up for API keys. Fill in the information below.

## 📧 Contact Information

**Email**: dex@monetadex.com  
**Company**: MonetaDEX  
**Project**: DEX Aggregator Platform  
**Use Case**: Token swap aggregation, best price discovery

---

## 🔑 Signup Checklist

### 1. KyberSwap ⭐ **PRIORITY 1**

**URL**: https://kyberswap.com/developers  
**Alternative**: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-api

**Steps**:
1. Visit signup page
2. Email: `dex@monetadex.com`
3. Company: `MonetaDEX`
4. Use case: `DEX Aggregator - Token swap aggregation`
5. Submit and verify email
6. Get API key from dashboard

**Notes**:
- May need to verify email
- Check spam folder for verification
- API key usually available immediately after verification

---

### 2. 1inch ⭐ **PRIORITY 2**

**URL**: https://portal.1inch.io/  
**Alternative**: https://docs.1inch.io/

**Steps**:
1. Visit portal
2. Sign up with: `dex@monetadex.com`
3. Verify email
4. Navigate to "API Keys" section
5. Generate new API key
6. Copy key immediately (may not be shown again)

**Notes**:
- 1inch public API works without key, but key gives better rate limits
- Key provides higher request limits
- Store key securely

---

### 3. Paraswap ⭐ **PRIORITY 3**

**URL**: https://developers.paraswap.io/  
**Alternative**: https://developers.paraswap.network/

**Steps**:
1. Visit developers portal
2. Sign up with: `dex@monetadex.com`
3. Fill form:
   - Company: `MonetaDEX`
   - Project: `DEX Aggregator Platform`
   - Use case: `Token swap aggregation`
4. Verify email
5. Get API key from dashboard

**Notes**:
- May require approval for production use
- Free tier usually available
- Check email for API key

---

### 4. SushiSwap ⭐ **PRIORITY 4**

**URL**: https://docs.sushi.com/  
**Alternative**: https://sushi.com (check Developers section)

**Steps**:
1. Visit docs or main site
2. Look for "API Access" or "Developer" section
3. May need to:
   - Email: dev@sushi.com
   - Or join Discord: https://discord.gg/sushi
   - Or contact through website form
4. Request API access with:
   - Email: `dex@monetadex.com`
   - Company: `MonetaDEX`
   - Use case: `DEX Aggregator`

**Notes**:
- SushiSwap may not have public API keys
- May need to contact team directly
- Check if they have public API endpoints

---

### 5. OKX ⭐ **PRIORITY 5**

**URL**: https://www.okx.com/web3/build/docs/dex/aggregator/overview  
**Alternative**: https://www.okx.com (Developers section)

**Steps**:
1. Visit OKX website
2. Sign up for OKX account: `dex@monetadex.com`
3. Navigate to API section
4. Generate API key
5. Copy key

**Notes**:
- May need to complete KYC for some features
- API keys may have rate limits
- Check documentation for limits

---

### 6. OpenOcean

**URL**: https://docs.openocean.finance/  
**Alternative**: https://openocean.finance

**Steps**:
1. Visit docs
2. Look for "API Key" section
3. Sign up with: `dex@monetadex.com`
4. Get API key

**Notes**:
- Free tier: 2 RPS (20 requests per 10 seconds)
- May need to contact for higher limits

---

### 7. Odos

**URL**: https://docs.odos.xyz/  
**Partner Code**: https://referral.odos.xyz/

**Steps**:
1. Visit docs
2. Sign up for API access: `dex@monetadex.com`
3. Get API key
4. (Optional) Register for partner code at referral.odos.xyz

**Notes**:
- Partner code enables affiliate fees
- Get both API key and partner code if possible

---

### 8. DODO

**URL**: https://docs.dodoex.io/

**Steps**:
1. Visit docs
2. Look for API section
3. Sign up: `dex@monetadex.com`
4. Get API key

---

### 9. Bebop

**URL**: https://docs.bebop.xyz/

**Steps**:
1. Visit docs
2. Look for API section
3. Sign up: `dex@monetadex.com`
4. Get API key

---

### 10. 0x

**URL**: https://0x.org/docs/api

**Steps**:
1. Visit 0x docs
2. Sign up for API access: `dex@monetadex.com`
3. Get API key

**Notes**:
- Free tier: 100 requests/minute
- Good for development

---

### 11. LI.FI

**URL**: https://docs.li.fi/

**Steps**:
1. Visit docs
2. Sign up: `dex@monetadex.com`
3. Get API key

**Notes**:
- Mainly for cross-chain bridges
- May have different pricing

---

## 📝 Information to Provide

When signing up, you may be asked for:

- **Email**: dex@monetadex.com
- **Company/Organization**: MonetaDEX
- **Project Name**: MonetaDEX DEX Aggregator
- **Use Case**: Token swap aggregation, best price discovery across multiple DEXs
- **Expected Volume**: (You can say "High volume" or "Production use")
- **Website**: (If you have one, or say "In development")

---

## ✅ After Getting Keys

1. **Save keys securely** (password manager recommended)
2. **Add to `.env` file**:
   ```bash
   code services/swaps-api/.env
   ```
3. **Check status**:
   ```bash
   bash scripts/check-api-keys.sh
   ```
4. **Restart API**:
   ```bash
   pnpm --filter @fortuna/swaps-api dev
   ```
5. **Test prices**:
   ```bash
   bash scripts/test-real-prices.sh
   ```

---

## 🚨 Important Notes

- **Email Verification**: Most services require email verification
- **Check Spam**: Verification emails may go to spam
- **Rate Limits**: Free tiers have limits, paid tiers offer more
- **Security**: Never commit API keys to git
- **Backup**: Save keys in secure location

---

## 📞 If You Get Stuck

- Check aggregator's Discord/Telegram
- Look for "Contact" or "Support" on their website
- Check their documentation for alternative signup methods

---

**Last Updated**: 2026-01-27  
**Email**: dex@monetadex.com

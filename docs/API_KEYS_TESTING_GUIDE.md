# API Keys Testing Guide

## Overview

This guide explains how to test the multi-aggregator system with real API keys for better price discovery and production readiness.

---

## Current Status

**Mock Mode**: All adapters are currently running in mock mode (no API keys required). This is fine for development and testing, but real API keys will provide:
- ✅ Real market prices
- ✅ Better route discovery
- ✅ Production-ready quotes
- ✅ Fee collection (affiliate fees)

---

## Getting API Keys

### 1. 0x API Key

**URL**: https://0x.org/docs/api  
**Process**:
1. Visit https://0x.org/docs/api
2. Sign up for API access
3. Get your API key
4. Add to `.env`: `ZEROX_API_KEY=your_key`

**Rate Limits**: 100 requests/minute (free tier)

---

### 2. 1inch API Key

**URL**: https://portal.1inch.io/  
**Process**:
1. Visit https://portal.1inch.io/
2. Register for an account
3. Get your API key
4. Add to `.env`: `ONEINCH_API_KEY=your_key`

**Rate Limits**: 1 request/second (public API)

---

### 3. Paraswap API Key

**URL**: https://developers.paraswap.network/  
**Process**:
1. Visit https://developers.paraswap.network/
2. Register for API access
3. Get your API key
4. Add to `.env`: `PARASWAP_API_KEY=your_key`

**Rate Limits**: Varies by plan

---

### 4. OpenOcean API Key

**URL**: https://apis.openocean.finance/  
**Process**:
1. Visit https://apis.openocean.finance/
2. Register for API access
3. Get your API key
4. Add to `.env`: `OPENOCEAN_API_KEY=your_key`

**Rate Limits**: 2 RPS (20 requests per 10 seconds) - free tier

---

### 5. Odos API Key

**URL**: https://docs.odos.xyz/  
**Process**:
1. Visit https://docs.odos.xyz/
2. Register for API access
3. Get your API key
4. Add to `.env`: `ODOS_API_KEY=your_key`

**Partner Code** (Optional, for affiliate fees):
1. Visit https://referral.odos.xyz/
2. Register for partner code
3. Add to `.env`: `ODOS_PARTNER_CODE=your_code`

**Rate Limits**: Varies by plan

---

### 6. LI.FI API Key

**URL**: https://docs.li.fi/  
**Process**:
1. Visit https://docs.li.fi/
2. Register for API access
3. Get your API key
4. Add to `.env`: `LIFI_API_KEY=your_key`

**Rate Limits**: Varies by plan

---

## Configuration

### Update `.env` File

Edit `services/swaps-api/.env`:

```env
# Provider API Keys (optional - will use mock mode if not set)
ZEROX_API_KEY=your_0x_api_key
LIFI_API_KEY=your_lifi_api_key
ONEINCH_API_KEY=your_1inch_api_key
PARASWAP_API_KEY=your_paraswap_api_key
OPENOCEAN_API_KEY=your_openocean_api_key
ODOS_API_KEY=your_odos_api_key
ODOS_PARTNER_CODE=your_odos_partner_code  # Optional
```

### Restart API

After adding API keys, restart the API:

```bash
# Stop current API
pkill -f "tsx watch.*swaps-api"

# Start API with new keys
pnpm --filter @fortuna/swaps-api dev
```

---

## Testing with Real API Keys

### 1. Test Quote Endpoint

```bash
curl -X POST http://localhost:3001/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 137,
    "toChainId": 137,
    "fromToken": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "toToken": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "amountIn": "1000000000"
  }'
```

**Expected**:
- Routes from all providers with real API keys
- Real market prices (not mock)
- Best route ranked first
- All routes include 10 BPS fee

### 2. Check Provider Health

```bash
curl http://localhost:3001/v1/health/providers
```

**Expected**:
- All providers showing health status
- Response times recorded
- Success/failure counts

### 3. Check Metrics

```bash
curl http://localhost:3001/v1/metrics
```

**Expected**:
- Quote success rates
- Average response times
- Routes per quote

### 4. Compare Route Quality

With real API keys, you should see:
- **Different prices** from different providers
- **Best route** correctly ranked first
- **Real market prices** (not mock estimates)

---

## Verification Checklist

- [ ] API keys added to `.env`
- [ ] API restarted
- [ ] Quote endpoint returns routes
- [ ] Provider health shows all providers
- [ ] Metrics are being recorded
- [ ] Best route selection working
- [ ] Fee collection configured

---

## Troubleshooting

### Issue: Adapter Still in Mock Mode

**Solution**: 
- Check `.env` file has correct variable names
- Restart API after adding keys
- Check logs for warnings about mock mode

### Issue: Rate Limit Errors

**Solution**:
- Check rate limit configuration
- Reduce request frequency
- Consider upgrading API plan

### Issue: No Routes Returned

**Solution**:
- Check API key is valid
- Check chain/token addresses are correct
- Check provider health endpoint
- Review API logs for errors

---

## Production Recommendations

1. **Start with Free Tiers**: Test with free tier API keys first
2. **Monitor Usage**: Track API usage and rate limits
3. **Upgrade as Needed**: Upgrade API plans based on usage
4. **Set Up Monitoring**: Monitor provider health and metrics
5. **Configure Alerts**: Set up alerts for provider failures

---

## Cost Considerations

### Free Tiers Available

- **0x**: 100 req/min (free)
- **1inch**: 1 req/sec (free)
- **OpenOcean**: 2 RPS (free)
- **Paraswap**: Varies (check plan)
- **Odos**: Varies (check plan)
- **LI.FI**: Varies (check plan)

### Paid Plans

Consider paid plans if:
- You exceed free tier limits
- You need higher rate limits
- You need priority support
- You need additional features

---

## Summary

**Current Status**: ✅ All adapters working in mock mode

**With API Keys**: 
- ✅ Real market prices
- ✅ Better route discovery
- ✅ Production-ready
- ✅ Fee collection enabled

**Next Steps**:
1. Get API keys (start with free tiers)
2. Add to `.env` file
3. Restart API
4. Test with real quotes
5. Monitor performance

---

**Note**: Mock mode is perfectly fine for development and testing. Real API keys are recommended for production to get actual market prices and enable fee collection.

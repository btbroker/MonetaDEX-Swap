# RPC Provider Information 🔗

**Current Provider**: **LlamaRPC** (llamarpc.com)

---

## 📊 Current Configuration

All **11 chains** are currently using **LlamaRPC** public endpoints:

| Chain | RPC URL |
|-------|---------|
| Ethereum | `https://eth.llamarpc.com` |
| Optimism | `https://optimism.llamarpc.com` |
| BSC | `https://bsc.llamarpc.com` |
| Polygon | `https://polygon.llamarpc.com` |
| Base | `https://base.llamarpc.com` |
| Arbitrum | `https://arbitrum.llamarpc.com` |
| Avalanche | `https://avalanche.llamarpc.com` |
| Scroll | `https://scroll.llamarpc.com` |
| Mantle | `https://mantle.llamarpc.com` |
| Blast | `https://blast.llamarpc.com` |
| Mode | `https://mode.llamarpc.com` |

---

## ℹ️ About LlamaRPC

**LlamaRPC** is a public RPC service that provides:
- ✅ Free tier available
- ✅ Multiple chain support
- ✅ Reliable uptime
- ✅ Good for development

**Website**: https://llamarpc.com

---

## 🔄 Alternative RPC Providers

For production, you may want to consider:

### 1. **Alchemy** ⭐ (Recommended for Production)
- **Pros**: High reliability, good rate limits, analytics
- **Cons**: Paid plans for high volume
- **URL**: https://www.alchemy.com/
- **Chains**: All major chains

### 2. **Infura**
- **Pros**: Established, reliable, good documentation
- **Cons**: Rate limits on free tier
- **URL**: https://www.infura.io/
- **Chains**: All major chains

### 3. **QuickNode**
- **Pros**: Fast, reliable, good support
- **Cons**: Paid service
- **URL**: https://www.quicknode.com/
- **Chains**: All major chains

### 4. **Ankr**
- **Pros**: Free tier, good coverage
- **Cons**: Rate limits
- **URL**: https://www.ankr.com/
- **Chains**: All major chains

### 5. **Chainstack**
- **Pros**: Good performance, multiple regions
- **Cons**: Paid plans
- **URL**: https://chainstack.com/
- **Chains**: All major chains

### 6. **Public RPCs** (Free but limited)
- **LlamaRPC** (current) - Free, good for dev
- **PublicNode** - Free, rate limited
- **1RPC** - Free, community-run

---

## 🚀 How to Change RPC Provider

### Option 1: Update Config File

Edit `packages/config/src/index.ts`:

```typescript
export const CHAINS: ChainConfig[] = [
  {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY", // Alchemy example
  },
  // ... update other chains
];
```

### Option 2: Environment Variables (Recommended)

Add to `services/swaps-api/.env`:

```env
# RPC URLs (optional - overrides config defaults)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
# ... etc
```

Then update config to read from env vars.

---

## 📊 RPC Provider Comparison

| Provider | Free Tier | Rate Limits | Reliability | Best For |
|----------|-----------|-------------|-------------|----------|
| **LlamaRPC** (Current) | ✅ Yes | Medium | Good | Development |
| **Alchemy** | ⚠️ Limited | High | Excellent | Production |
| **Infura** | ⚠️ Limited | Medium | Excellent | Production |
| **QuickNode** | ❌ No | Very High | Excellent | Production |
| **Ankr** | ✅ Yes | Medium | Good | Development/Production |
| **Chainstack** | ❌ No | High | Excellent | Production |

---

## 🎯 Recommendations

### For Development (Current)
- ✅ **LlamaRPC** - Good choice, free, works well
- ✅ **Ankr** - Alternative free option
- ✅ **Public RPCs** - For testing

### For Production
- ⭐ **Alchemy** - Best overall (reliability + features)
- ⭐ **Infura** - Established, reliable
- ⭐ **QuickNode** - Fast, good support
- ⭐ **Multiple Providers** - Use fallback RPCs for redundancy

### Best Practice: Multiple RPCs
Use **primary + fallback** RPCs for each chain:
- Primary: Paid provider (Alchemy/Infura)
- Fallback: Free provider (LlamaRPC/Ankr)

---

## 🔧 Current Usage

**Where RPCs Are Used**:
1. **Backend** (`packages/config/src/index.ts`) - For contract calls
2. **Frontend** (`apps/swaps-web/src/providers/wagmi-provider.tsx`) - For wallet connections
   - Currently uses default wagmi RPCs (not LlamaRPC)
   - Can be configured

---

## ✅ Current Status

- ✅ **11 chains** configured with LlamaRPC
- ✅ **All chains operational**
- ✅ **Good for development**
- ⚠️ **Consider upgrading for production**

---

## 🚀 Next Steps (Optional)

1. **Keep LlamaRPC** for development (it's working fine)
2. **Add Alchemy/Infura** for production
3. **Implement fallback RPCs** for redundancy
4. **Monitor RPC health** and switch if needed

---

**Last Updated**: 2026-01-27  
**Current Provider**: LlamaRPC (llamarpc.com)  
**Status**: ✅ Working well for development

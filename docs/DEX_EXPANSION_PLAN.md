# DEX Expansion Plan - 35+ DEXs 🚀

**Goal**: Add direct DEX integrations to have 35+ DEXs available  
**Current**: 11 aggregators (covering 200+ DEXs indirectly)  
**Target**: 35+ direct DEX integrations

---

## 📊 Current Status

### Aggregators (11) - Already Integrated ✅
1. 0x
2. 1inch
3. Paraswap
4. OpenOcean
5. Odos
6. KyberSwap
7. Bebop
8. DODO
9. SushiSwap
10. OKX
11. LI.FI

**Coverage**: These aggregators already cover 200+ DEXs, but we want **direct** integrations for:
- Better control
- Lower fees (no aggregator markup)
- More routing options
- Better price discovery

---

## 🎯 Target DEXs to Add (35+)

### Tier 1: Major DEXs (Priority) ⭐⭐⭐

#### Ethereum & EVM Chains
1. **Uniswap V3** - Largest DEX, $2B+ daily volume
2. **Uniswap V2** - Classic AMM, still very active
3. **Curve** - Stablecoin/pegged asset swaps, low slippage
4. **Balancer V2** - Weighted pools, custom AMM
5. **PancakeSwap** - Top BSC DEX, $800M+ daily volume
6. **TraderJoe** - Multi-chain, strong on Avalanche
7. **GMX** - Perpetuals + spot, Arbitrum native
8. **Velodrome** - Optimism native, ve(3,3) model
9. **Aerodrome** - Base native, Velodrome fork
10. **Camelot** - Arbitrum native DEX

#### Solana
11. **Orca** - Solana's top DEX, $1.5B+ daily volume
12. **Raydium** - Solana AMM, high liquidity
13. **Jupiter** - Solana aggregator (also direct DEX)
14. **Phoenix** - Solana order book DEX
15. **Meteora** - Solana dynamic pools

#### Other Chains
16. **THORChain** - Cross-chain native swaps
17. **dYdX** - Derivatives + spot (own chain)
18. **Maverick** - Concentrated liquidity, multiple chains
19. **SyncSwap** - zkSync native
20. **Velocore** - zkSync Era native

### Tier 2: Additional High-Value DEXs ⭐⭐

21. **Bancor** - Single-sided liquidity
22. **KyberSwap Classic** - Direct DEX (not aggregator)
23. **QuickSwap** - Polygon native
24. **SpookySwap** - Fantom native
25. **SpiritSwap** - Fantom native
26. **BeamSwap** - Moonbeam native
27. **Solarbeam** - Moonriver native
28. **Zenlink** - Polkadot parachains
29. **StellaSwap** - Moonbeam native
30. **Honeyswap** - Gnosis Chain

### Tier 3: Emerging & Specialized DEXs ⭐

31. **Concentrator** - Curve fork
32. **Platypus** - Avalanche stablecoin DEX
33. **Grape Protocol** - Solana
34. **Lifinity** - Solana proactive market maker
35. **Meteora DLMM** - Solana dynamic liquidity
36. **Meteora Pools** - Solana
37. **Meteora Concentrated** - Solana
38. **Meteora Standard** - Solana
39. **Meteora Stable** - Solana
40. **Meteora Weighted** - Solana

---

## 🏗️ Implementation Strategy

### Phase 1: Major EVM DEXs (Week 1-2)
**Goal**: Add top 10 EVM DEXs

1. Uniswap V3
2. Uniswap V2
3. Curve
4. Balancer V2
5. PancakeSwap
6. TraderJoe
7. Velodrome
8. Aerodrome
9. Camelot
10. Maverick

**Why**: These cover 80%+ of EVM liquidity

---

### Phase 2: Solana DEXs (Week 3)
**Goal**: Add top 5 Solana DEXs

1. Orca
2. Raydium
3. Jupiter (direct)
4. Phoenix
5. Meteora

**Why**: Solana has $2B+ daily volume, growing fast

---

### Phase 3: Specialized & Cross-Chain (Week 4)
**Goal**: Add specialized DEXs

1. THORChain (cross-chain native)
2. dYdX (derivatives)
3. GMX (perpetuals + spot)
4. SyncSwap (zkSync)
5. Velocore (zkSync Era)

**Why**: Unique capabilities, cross-chain support

---

### Phase 4: Additional Chains (Week 5+)
**Goal**: Cover all major chains

- Fantom: SpookySwap, SpiritSwap
- Moonbeam: BeamSwap, StellaSwap
- Gnosis: Honeyswap
- Avalanche: Platypus
- More Solana: Lifinity, Grape Protocol

---

## 🔧 Technical Approach

### Direct DEX Integration Pattern

Each DEX will have its own adapter following the `BaseAdapter` pattern:

```typescript
export class UniswapV3Adapter extends BaseAdapter {
  name = "uniswap-v3";
  
  async getQuote(request: QuoteRequest): Promise<Route[]> {
    // Direct contract calls or API if available
  }
  
  async getTx(routeId: string, request: TxRequest): Promise<TxResponse> {
    // Build transaction for direct DEX interaction
  }
}
```

### Integration Methods

1. **Smart Contract Integration** (Preferred)
   - Direct contract calls via viem
   - Use DEX's router contracts
   - More control, lower fees

2. **API Integration** (If Available)
   - Use DEX's official API
   - Faster, but may have rate limits
   - Good for quotes, contracts for execution

3. **SDK Integration** (If Available)
   - Use official SDKs
   - Easier integration
   - May have limitations

---

## 📋 Implementation Checklist

### Phase 1: EVM DEXs (10 DEXs)

- [ ] Uniswap V3
  - Router: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
  - Quoter V2: `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
  - Docs: https://docs.uniswap.org/

- [ ] Uniswap V2
  - Router: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
  - Docs: https://docs.uniswap.org/

- [ ] Curve
  - Router: Multiple (chain-specific)
  - Docs: https://docs.curve.fi/

- [ ] Balancer V2
  - Vault: `0xBA12222222228d8Ba445958a75a0704d566BF2C8`
  - Docs: https://docs.balancer.fi/

- [ ] PancakeSwap
  - Router: Chain-specific
  - Docs: https://docs.pancakeswap.finance/

- [ ] TraderJoe
  - Router: Chain-specific
  - Docs: https://docs.traderjoexyz.com/

- [ ] Velodrome
  - Router: Optimism-specific
  - Docs: https://docs.velodrome.finance/

- [ ] Aerodrome
  - Router: Base-specific
  - Docs: https://docs.aerodrome.finance/

- [ ] Camelot
  - Router: Arbitrum-specific
  - Docs: https://docs.camelot.exchange/

- [ ] Maverick
  - Router: Multiple chains
  - Docs: https://docs.maverick.finance/

---

## 🎯 Success Metrics

### Coverage Goals
- **Phase 1**: 10 EVM DEXs
- **Phase 2**: +5 Solana DEXs = 15 total
- **Phase 3**: +5 Specialized = 20 total
- **Phase 4**: +15 More = **35+ total** ✅

### Quality Goals
- ✅ All DEXs return quotes
- ✅ Transaction building works
- ✅ Fee collection enabled
- ✅ Health monitoring
- ✅ Rate limiting

---

## 🚀 Quick Start: First 5 DEXs

Let's start with the **most important** DEXs:

1. **Uniswap V3** - Largest volume
2. **Curve** - Best for stablecoins
3. **PancakeSwap** - Top BSC DEX
4. **Balancer V2** - Unique pools
5. **TraderJoe** - Multi-chain strong

**These 5 alone will add massive liquidity!**

---

## 📚 Resources

### Documentation Links
- Uniswap: https://docs.uniswap.org/
- Curve: https://docs.curve.fi/
- Balancer: https://docs.balancer.fi/
- PancakeSwap: https://docs.pancakeswap.finance/
- TraderJoe: https://docs.traderjoexyz.com/
- Orca: https://docs.orca.so/
- Raydium: https://docs.raydium.io/

### Contract Addresses
- Will be added per DEX in implementation

---

## ✅ Next Steps

1. **Start with Uniswap V3** (most important)
2. **Add Curve** (stablecoin specialist)
3. **Add PancakeSwap** (BSC leader)
4. **Continue with others** systematically
5. **Test each integration** thoroughly

---

**Last Updated**: 2026-01-27  
**Target**: 35+ DEXs  
**Status**: Ready to implement! 🚀

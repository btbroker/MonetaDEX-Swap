# Fee Collection Implementation - MonetaDEX

## ✅ Implementation Complete

Fee collection has been implemented with **10 BPS (0.1%)** platform fee on all swaps.

## Fee Configuration

### Platform Fee
- **Rate**: 10 BPS (0.1%)
- **Applied to**: All swaps and bridges
- **Collection Method**: 
  - **0x Routes**: Via affiliate fees (automatic)
  - **LI.FI Routes**: Deducted from output amount (manual)

### Fee Recipient Addresses

| Chain | Chain ID | Fee Recipient Address |
|-------|----------|----------------------|
| Ethereum | 1 | `0x0bEf728d6260718AC31b8218d526944F8CA2DB90` |
| Optimism | 10 | `0x0bEf728d6260718AC31b8218d526944F8CA2DB90` |
| BSC | 56 | `0x0bEf728d6260718AC31b8218d526944F8CA2DB90` |
| Polygon | 137 | `0x0bEf728d6260718AC31b8218d526944F8CA2DB90` |
| Base | 8453 | `0x075c40913a3445264bC328C53863b703702b4590` |
| Arbitrum | 42161 | `0x0bEf728d6260718AC31b8218d526944F8CA2DB90` |
| Avalanche | 43114 | `0x0bEf728d6260718AC31b8218d526944F8CA2DB90` |
| Scroll | 534352 | `0x075c40913a3445264bC328C53863b703702b4590` |
| Mantle | 5000 | `0x075c40913a3445264bC328C53863b703702b4590` |
| Blast | 81457 | `0x075c40913a3445264bC328C53863b703702b4590` |
| Mode | 34443 | `0x075c40913a3445264bC328C53863b703702b4590` |

## How It Works

### 0x Swaps (Recommended Method)

**Implementation**: Uses 0x's built-in affiliate fee system

1. When requesting quotes from 0x API, we include:
   - `affiliateAddress`: Your fee recipient address
   - `feeRecipient`: Your fee recipient address  
   - `buyTokenPercentageFee`: 0.1% (10 BPS)

2. 0x automatically:
   - Routes 0.1% of the swap value to your address
   - Deducts the fee from the output amount
   - Handles all fee collection automatically

3. **Benefits**:
   - ✅ No smart contract needed
   - ✅ Automatic fee collection
   - ✅ Works with all 0x-supported DEXs
   - ✅ Transparent and reliable

### LI.FI Bridges

**Implementation**: Platform fee deducted from output

1. Calculate platform fee (0.1% of output)
2. Deduct from `amountOut` shown to users
3. Fee is tracked but requires separate collection mechanism

**Note**: For LI.FI bridges, fees are calculated and shown but require a fee collector contract or transaction modification for actual collection. This is a limitation of LI.FI's API.

## Environment Variables

Add these to `services/swaps-api/.env`:

```env
# Platform fee: 15 BPS (0.15%) on all chains — competitive vs Jumper/aggregators, profitable on BRLA
PLATFORM_FEE_BPS=15

# Fee Recipient Addresses (optional - defaults are hardcoded)
FEE_RECIPIENT_1=0x0bEf728d6260718AC31b8218d526944F8CA2DB90
FEE_RECIPIENT_10=0x0bEf728d6260718AC31b8218d526944F8CA2DB90
FEE_RECIPIENT_56=0x0bEf728d6260718AC31b8218d526944F8CA2DB90
FEE_RECIPIENT_137=0x0bEf728d6260718AC31b8218d526944F8CA2DB90
FEE_RECIPIENT_8453=0x075c40913a3445264bC328C53863b703702b4590
FEE_RECIPIENT_42161=0x0bEf728d6260718AC31b8218d526944F8CA2DB90
FEE_RECIPIENT_43114=0x0bEf728d6260718AC31b8218d526944F8CA2DB90
FEE_RECIPIENT_534352=0x075c40913a3445264bC328C53863b703702b4590
FEE_RECIPIENT_5000=0x075c40913a3445264bC328C53863b703702b4590
FEE_RECIPIENT_81457=0x075c40913a3445264bC328C53863b703702b4590
FEE_RECIPIENT_34443=0x075c40913a3445264bC328C53863b703702b4590
```

## New Chains Added

The following chains have been added to support fee collection:

- ✅ Base (8453)
- ✅ Avalanche (43114)
- ✅ Scroll (534352)
- ✅ Mantle (5000)
- ✅ Blast (81457)
- ✅ Mode (34443)

## Fee Calculation Examples

### Example 1: $10,000 Swap
- **Input**: $10,000
- **Platform Fee (0.1%)**: $10
- **User Receives**: $9,990 (after DEX fees and platform fee)
- **You Collect**: $10

### Example 2: $1,000 Swap
- **Input**: $1,000
- **Platform Fee (0.1%)**: $1
- **User Receives**: $999 (after DEX fees and platform fee)
- **You Collect**: $1

## Competitive Analysis

### MonetaDEX Fee: 0.1% (10 BPS)
- ✅ Lower than Uniswap (0.3% for most pools)
- ✅ Competitive with Jumper.exchange
- ✅ One of the lowest fees in the industry
- ✅ Transparent and predictable

## Verification

### For 0x Swaps:
1. Check your fee recipient wallets on each chain
2. Fees should appear automatically after each swap
3. Use block explorers to verify transactions

### For LI.FI Bridges:
1. Fees are calculated and shown in quotes
2. Actual collection requires additional implementation (fee collector contract)
3. Consider implementing a fee collector contract for LI.FI routes

## Next Steps

1. **Test Fee Collection**:
   - Execute a test swap on a supported chain
   - Verify fee appears in recipient wallet
   - Check transaction details on block explorer

2. **Monitor Fee Collection**:
   - Set up wallet monitoring
   - Track fee accumulation per chain
   - Consider adding fee metrics to `/v1/metrics` endpoint

3. **LI.FI Fee Collection** (Future):
   - Deploy fee collector contract on each chain
   - Route LI.FI transactions through fee collector
   - Or implement transaction modification to deduct fees

## Files Modified

- ✅ `services/swaps-api/src/utils/fee-config.ts` - Fee configuration utility
- ✅ `services/swaps-api/src/adapters/zeroX.ts` - 0x affiliate fee integration
- ✅ `services/swaps-api/src/adapters/lifi.ts` - LI.FI fee calculation
- ✅ `packages/config/src/index.ts` - Added new chains
- ✅ `services/swaps-api/.env.example` - Fee configuration examples

---

**Status**: ✅ Fee collection implemented and ready for testing!

**Fee Rate**: 10 BPS (0.1%) - Competitive with best DEX aggregators

**Collection Method**: Automatic for 0x routes, calculated for LI.FI routes

# Fee Collection Setup Guide

## Current Status

⚠️ **Fees are NOT currently being collected**

The system calculates and displays fees, but they are not being sent to a MonetaDEX wallet address.

## Fee Collection Options

### Option 1: 0x Affiliate Fees (Recommended for 0x Routes)

0x API supports affiliate fees through the `affiliateAddress` parameter. This is the cleanest approach for 0x routes.

**How it works:**
- Add `affiliateAddress` parameter to 0x API calls
- 0x automatically routes a percentage of the swap fee to your address
- No smart contract changes needed
- Works with all 0x-supported DEXs

**Implementation:**
- Add `FEE_RECIPIENT_<CHAIN_ID>` environment variables
- Pass `affiliateAddress` to 0x API calls
- Configure fee percentage (typically 0.1-0.5% of swap value)

### Option 2: Transaction Routing Through Fee Collector

Route transactions through a fee collector contract that takes a cut before forwarding.

**How it works:**
- Deploy a fee collector contract on each chain
- Route all transactions through this contract
- Contract takes fee and forwards remainder to user
- More control but requires contract deployment

### Option 3: Platform Fee on Output

Deduct a platform fee from the output amount before sending to user.

**How it works:**
- Calculate platform fee as percentage of output
- Modify transaction to send fee to your wallet
- Send remainder to user
- Requires transaction modification

## Recommended Implementation

For MonetaDEX, I recommend **Option 1 (0x Affiliate Fees)** because:
- ✅ No smart contract deployment needed
- ✅ Works immediately
- ✅ Clean and transparent
- ✅ Supported by 0x API

For LI.FI bridges, we'll need to use **Option 3** (platform fee) since LI.FI doesn't have affiliate fees.

## Setup Steps

1. **Provide Fee Recipient Addresses**

   You'll need one wallet address per chain:
   - Polygon (137): `0x...`
   - Ethereum (1): `0x...`
   - Arbitrum (42161): `0x...`
   - Optimism (10): `0x...`
   - BSC (56): `0x...`

2. **Configure Fee Percentage**

   Decide on your platform fee:
   - Typical: 0.1% - 0.5% of swap value
   - Can be different per chain
   - Can be different for swaps vs bridges

3. **Add Environment Variables**

   ```env
   # Fee Recipient Addresses (one per chain)
   FEE_RECIPIENT_1=0x...          # Ethereum
   FEE_RECIPIENT_137=0x...        # Polygon
   FEE_RECIPIENT_42161=0x...      # Arbitrum
   FEE_RECIPIENT_10=0x...         # Optimism
   FEE_RECIPIENT_56=0x...         # BSC

   # Fee Configuration
   PLATFORM_FEE_BPS=15            # 0.15% = 15 BPS (MonetaDEX standard: competitive vs Jumper, profitable on BRLA)
   BRIDGE_FEE_BPS=20              # 0.2% for bridges
   ```

4. **Implementation**

   Once you provide the addresses, I'll:
   - Add fee recipient configuration
   - Update 0x adapter to use affiliate fees
   - Update LI.FI adapter to deduct platform fees
   - Add fee tracking and reporting
   - Update transaction generation to include fees

## Fee Collection Verification

After implementation, you can verify fees are being collected by:
1. Checking your fee recipient wallets
2. Using the metrics endpoint (`/v1/metrics`) to see fee totals
3. Adding fee collection logs to track each transaction

## Next Steps

**Please provide:**
1. Fee recipient wallet addresses for each chain
2. Desired fee percentage (in basis points, e.g., 10 = 0.1%)
3. Any specific requirements for fee collection

Once you provide this information, I'll implement the fee collection mechanism immediately.

---

**Note:** Make sure the fee recipient addresses are:
- ✅ Valid Ethereum addresses (0x...)
- ✅ On the correct chain
- ✅ Wallets you control (not smart contracts unless specifically designed for fee collection)
- ✅ Secured with proper key management

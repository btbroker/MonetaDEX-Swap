# KyberSwap Partner Fee Onboarding – MonetaDEX

**Source:** KyberSwap Partnerships & Integrations Team (email response)  
**Purpose:** Use this info to complete KyberSwap integration and enable partner fees (15 BPS) in production.

---

## Copy-paste for KyberSwap (wallet + chains)

**Fee receiver wallet(s):**
- Primary (Ethereum, Optimism, BSC, Polygon, Arbitrum, Avalanche): `0x0bEf728d6260718AC31b8218d526944F8CA2DB90`
- Secondary (Base, Scroll, Mantle, Blast, Mode): `0x075c40913a3445264bC328C53863b703702b4590`

**Number of chains:** 11

**Chains we need:** Ethereum, Polygon, Base, Arbitrum, BSC, Optimism, Avalanche, Scroll, Mantle, Blast, Mode.

---

## Draft reply to KyberSwap (copy-paste)

**Subject:** Re: KyberSwap Aggregator – MonetaDEX partner fee onboarding

---

Hello KyberSwap Partnerships & Integrations Team,

Thank you for the clarifications and the step-by-step guidance. We’d like to proceed with partner fee onboarding and share the details below.

**1. Fee receiver wallet address(es)**

We use two fee-receiver addresses across our supported chains:

- **Primary** (Ethereum, Optimism, BSC, Polygon, Arbitrum, Avalanche):  
  `0x0bEf728d6260718AC31b8218d526944F8CA2DB90`

- **Secondary** (Base, Scroll, Mantle, Blast, Mode):  
  `0x075c40913a3445264bC328C53863b703702b4590`

Both are active on-chain wallets capable of receiving ERC-20 tokens. We’re happy to complete your wallet validation process for these addresses.

**2. Expected chains and tokens**

- **Chains (11):** Ethereum, Polygon, Base, Arbitrum, BSC, Optimism, Avalanche, Scroll, Mantle, Blast, Mode.  
- **Tokens:** We route mainly BRLA, USDC, USDT, WETH and other major pairs on these chains.

**3. Estimated volume**

We expect approximately **$10,000,000 USD per day** in swap volume (~$300M USD per month).

**4. Integration / execution details**

We integrate the KyberSwap Aggregator API v1: GET `/{chain}/api/v1/routes` for quotes and POST `/{chain}/api/v1/route/build` for calldata. We send `x-client-id: MonetaDEX`, and for partner fees we use `chargeFeeBy=currency_out`, `isInBps=true`, and `feeAmount=15` (15 BPS). Execution is user EOA as sender/recipient; we do not use a custom contract as the main executor.

We’re ready to proceed with wallet validation and any further steps you require. Please let us know the next actions from your side.

Best regards,  
MonetaDEX Team

---

## Summary

- **Quotes & swaps:** No API key or client ID required. The Aggregator API is permissionless for price discovery and execution.
- **Partner fees (`feeReceiver` / `feeAmount`):** For production use, KyberSwap requires a short onboarding and wallet validation so fees are attributed and routed correctly.

---

## API Key / Client ID

| Use case | Requirement |
|----------|-------------|
| Standard quote and swap routing | **No API key or client ID required.** Permissionless. |
| Partner fees in production | **Validation required** so fee attribution, routing, and compliance are correct. |

We already send `x-client-id: MonetaDEX` and `chargeFeeBy` / `feeReceiver` / `feeAmount` in the adapter; once the fee receiver is approved, the same params can be used in production.

---

## Revenue Share / Partner Fee Approval

To enable partner fees in production, partners must complete:

1. **Registration** of the platform as a fee source  
2. **Verification** of the designated `feeReceiver` wallet address  
3. **Review** of integration architecture and use case  

After approval, fee parameters can be used in production without disruption.

---

## Wallet Validation (Required for Partner Fees)

The `feeReceiver` address must be:

- An **active, on-chain wallet** (EOA or contract wallet)
- **Able to receive ERC-20 tokens** (properly deployed)
- **Submitted to KyberSwap** for validation to avoid misrouted or failed fee transfers  

KyberSwap will guide step-by-step through wallet validation once the address is shared.

---

## Volume, Whitelisting, Registration

- **Volume:** No fixed minimum; projected volume helps them optimize routing and support.
- **Whitelisting:** Some fee configurations may require address whitelisting.
- **Registration:** Partner/source registration is required for long-term fee attribution and analytics.

---

## Next Steps – What MonetaDEX Should Send to KyberSwap

To proceed, send them:

| Item | What to share |
|------|----------------|
| **1. Fee receiver** | Intended `feeReceiver` wallet address (per chain or main treasury). |
| **2. Chains & tokens** | Expected chains and tokens for routing (e.g. Polygon, Base, USDC, BRLA, WETH). |
| **3. Volume** | Estimated monthly volume (rough ranges are fine). |
| **4. Execution details** | Any custom routing or contract-based execution (e.g. smart contract as sender/recipient). |

After that, KyberSwap will:

- Validate the wallet  
- Confirm correct Aggregator API configuration  
- Provide guidance on fee parameters and best practices  
- Share any extra technical recommendations  

---

## MonetaDEX Data to Reuse When Replying

You can copy from the repo and config:

- **Fee receiver:** From `services/swaps-api/.env` and `FEE_RECIPIENTS` in `services/swaps-api/src/utils/fee-config.ts` (e.g. per-chain `FEE_RECIPIENT_137`, etc.). Defaults are in the codebase.  
- **Chains:** See `docs/SUPPORTED_CHAINS.md` or `packages/config` (e.g. Ethereum, Polygon, Base, Arbitrum, BSC, Optimism, Avalanche, Scroll, Mantle, Blast, Mode).  
- **Tokens:** Focus on BRLA, USDC, USDT, WETH and other main pairs you route.  
- **Fee params:** 15 BPS (0.15%), `chargeFeeBy=currency_out`, `isInBps=true`, revenue-share supported via comma-separated `feeReceiver` and `feeAmount`.  

---

## References

- Adapter: `services/swaps-api/src/adapters/kyberSwap.ts`  
- Fee config: `services/swaps-api/src/utils/fee-config.ts`  
- KyberSwap EVM docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps  

---

*Last updated from KyberSwap Partnerships email. Use this doc when replying to them and when enabling production partner fees.*

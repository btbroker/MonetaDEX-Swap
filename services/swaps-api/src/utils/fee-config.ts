/**
 * Fee Configuration Utility
 * Manages fee recipient addresses and fee rates per chain
 */

/** MonetaDEX standard: 15 BPS (0.15%) across all chains — competitive vs Jumper/aggregators, profitable on BRLA. */
const PLATFORM_FEE_BPS = 15; // 0.15% = 15 basis points

/**
 * Get fee recipient address for a chain
 */
export function getFeeRecipient(chainId: number): string | undefined {
  const envKey = `FEE_RECIPIENT_${chainId}`;
  return process.env[envKey];
}

/**
 * Get platform fee in basis points
 */
export function getPlatformFeeBps(): number {
  return Number(process.env.PLATFORM_FEE_BPS) || PLATFORM_FEE_BPS;
}

/**
 * Get platform fee as decimal (e.g., 0.001 for 10 BPS)
 */
export function getPlatformFeeDecimal(): number {
  return getPlatformFeeBps() / 10000;
}

/**
 * Calculate platform fee amount
 */
export function calculatePlatformFee(amount: number): number {
  return amount * getPlatformFeeDecimal();
}

/**
 * All supported chains with fee recipients
 */
export const FEE_RECIPIENTS: Record<number, string> = {
  1: "0x0bEf728d6260718AC31b8218d526944F8CA2DB90", // Ethereum
  10: "0x0bEf728d6260718AC31b8218d526944F8CA2DB90", // Optimism
  56: "0x0bEf728d6260718AC31b8218d526944F8CA2DB90", // BSC
  137: "0x0bEf728d6260718AC31b8218d526944F8CA2DB90", // Polygon
  8453: "0x075c40913a3445264bC328C53863b703702b4590", // Base
  42161: "0x0bEf728d6260718AC31b8218d526944F8CA2DB90", // Arbitrum
  43114: "0x0bEf728d6260718AC31b8218d526944F8CA2DB90", // Avalanche
  534352: "0x075c40913a3445264bC328C53863b703702b4590", // Scroll
  5000: "0x075c40913a3445264bC328C53863b703702b4590", // Mantle
  81457: "0x075c40913a3445264bC328C53863b703702b4590", // Blast
  34443: "0x075c40913a3445264bC328C53863b703702b4590", // Mode
};

/**
 * Get fee recipient with fallback to default
 */
export function getFeeRecipientWithFallback(chainId: number): string | undefined {
  // First check environment variable
  const envRecipient = getFeeRecipient(chainId);
  if (envRecipient) {
    return envRecipient;
  }

  // Fallback to hardcoded defaults
  return FEE_RECIPIENTS[chainId];
}

/**
 * KyberSwap revenue share: comma-separated receivers and bps per receiver.
 * Used for GET /api/v1/routes: feeReceiver=addr1,addr2 & feeAmount=bps1,bps2 (same order).
 * If FEE_RECIPIENTS_CSV / FEE_BPS_SPLIT are not set, returns single receiver and total bps.
 */
export function getFeeReceiversAndBpsForKyber(chainId: number): {
  receivers: string[];
  bps: number[];
} {
  const totalBps = getPlatformFeeBps();
  const csvReceivers = process.env[`FEE_RECIPIENTS_CSV_${chainId}`] ?? process.env.FEE_RECIPIENTS_CSV;
  const csvBps = process.env.FEE_BPS_SPLIT;

  if (csvReceivers && csvBps) {
    const receivers = csvReceivers.split(",").map((s) => s.trim()).filter(Boolean);
    const bps = csvBps.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
    if (receivers.length === bps.length && bps.reduce((a, b) => a + b, 0) === totalBps) {
      return { receivers, bps };
    }
  }

  const single = getFeeRecipientWithFallback(chainId);
  if (single) {
    return { receivers: [single], bps: [totalBps] };
  }
  return { receivers: [], bps: [] };
}

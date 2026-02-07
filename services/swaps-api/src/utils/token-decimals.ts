import { getTokensForChain } from "@fortuna/config";

/**
 * Get token decimals for a given chain and token address.
 * Used to normalize amounts between human-readable and wei (base units)
 * for aggregator APIs (e.g. 0x expects/returns wei).
 */
export function getTokenDecimals(chainId: number, tokenAddress: string): number {
  const tokens = getTokensForChain(chainId);
  const normalized = tokenAddress.toLowerCase();
  const token = tokens.find((t) => t.address.toLowerCase() === normalized);
  return token?.decimals ?? 18;
}

/** Convert human-readable amount to wei (base units) as integer string. */
export function toWei(amountHuman: string, decimals: number): string {
  const s = amountHuman.trim();
  const [whole = "0", frac = ""] = s.split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  const combined = whole + fracPadded;
  return combined.replace(/^0+/, "") || "0";
}

/** Convert wei (base units) to human-readable amount string. */
export function fromWei(amountWei: string, decimals: number): string {
  const raw = amountWei.replace(/^0+/, "") || "0";
  if (raw === "0") return "0";
  const padded = raw.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, -decimals) || "0";
  const fracPart = padded.slice(-decimals).replace(/0+$/, "");
  if (!fracPart) return intPart;
  return `${intPart}.${fracPart}`;
}

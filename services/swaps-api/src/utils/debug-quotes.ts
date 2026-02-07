/**
 * Helpers for DEBUG_QUOTES logging. Never log API keys, signatures, or auth headers.
 */

export const DEBUG_QUOTES = process.env.DEBUG_QUOTES === "1";

const REDACT_PARAM_NAMES = /key|signature|auth|bearer|token/i;
const MAX_SAFE_MESSAGE_LEN = 200;
const REDACT_PATTERN = /(?:api[_-]?key|signature|auth|bearer|token)\s*[:=]\s*[\w.-]+/gi;

/** Redact query param values whose name suggests secrets. */
export function safeQueryParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = REDACT_PARAM_NAMES.test(key) ? "[redacted]" : value;
  });
  return out;
}

/** Sanitize a short reason from provider response (no secrets, truncated). */
export function sanitizeResponseMessage(msg: unknown): string {
  if (msg == null) return "";
  const s = typeof msg === "string" ? msg : JSON.stringify(msg);
  const truncated = s.length > MAX_SAFE_MESSAGE_LEN ? s.slice(0, MAX_SAFE_MESSAGE_LEN) + "…" : s;
  return truncated.replace(REDACT_PATTERN, "[redacted]");
}

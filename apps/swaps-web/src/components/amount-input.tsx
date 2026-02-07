"use client";

import { useId } from "react";

interface AmountInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  token: { symbol: string; decimals?: number } | null;
  disabled?: boolean;
  onMax?: () => void;
  inputSuffix?: string;
}

/**
 * Allow only valid decimal input: digits and at most one decimal point.
 * Cap fractional part to maxDecimals (string slice only; no rounding).
 * Preserves trailing dot so user can type "0." then "001" for 0.001.
 */
function sanitizeAmount(input: string, maxDecimals?: number): string {
  if (input === "") return "";
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d*)\.?(\d*)$/);
  if (!match) return "";

  const [, whole = "", fracInitial = ""] = match;
  const frac =
    typeof maxDecimals === "number" && maxDecimals >= 0 && fracInitial.length > maxDecimals
      ? fracInitial.slice(0, maxDecimals)
      : fracInitial;

  const hasDot = trimmed.includes(".");
  const endsWithDot = trimmed.endsWith(".");
  if (frac.length === 0 && !endsWithDot) return whole === "" ? "" : whole;
  return `${whole || (hasDot || frac ? "0" : "")}.${frac}`;
}

export function AmountInput({
  label,
  value,
  onChange,
  token,
  disabled,
  onMax,
  inputSuffix = "amount",
}: AmountInputProps) {
  const id = useId();
  const inputId = `amount-${inputSuffix}-${id.replace(/:/g, "")}`;
  const maxDecimals = token?.decimals ?? 18;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeAmount(e.target.value, maxDecimals);
    onChange(next);
  };

  return (
    <div>
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      ) : (
        <span className="sr-only" id={`${inputId}-label`}>
          Amount
        </span>
      )}
      <div className="relative">
        <input
          id={inputId}
          name={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0.0"
          aria-label={label || "Amount"}
          className="w-full px-3 py-3 sm:px-4 sm:py-4 border-0 bg-transparent text-2xl sm:text-3xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded disabled:opacity-50 placeholder:text-gray-400 min-h-[44px]"
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              disabled={disabled}
              className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-600 font-medium disabled:opacity-50 transition-colors"
            >
              MAX
            </button>
          )}
          {token && (
            <span className="text-sm font-semibold text-gray-600 px-2">{token.symbol}</span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">Amount will be quoted in real-time</p>
    </div>
  );
}

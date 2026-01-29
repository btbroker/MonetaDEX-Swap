"use client";

interface AmountInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  token: { symbol: string } | null;
  disabled?: boolean;
  onMax?: () => void;
}

export function AmountInput({
  label,
  value,
  onChange,
  token,
  disabled,
  onMax,
}: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow only numbers and decimal point
    if (input === "" || /^\d*\.?\d*$/.test(input)) {
      onChange(input);
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0.0"
          className="w-full px-4 py-4 border-0 bg-transparent text-3xl font-semibold text-gray-900 focus:outline-none disabled:opacity-50 placeholder:text-gray-400"
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
            <span className="text-sm font-semibold text-gray-600 px-2">
              {token.symbol}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

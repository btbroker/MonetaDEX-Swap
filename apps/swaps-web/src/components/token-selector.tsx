"use client";

import { useState } from "react";
import type { Token, ChainId } from "@fortuna/shared";
import { useTokens } from "../hooks/use-tokens";
import { useChains } from "../hooks/use-chains";

interface TokenSelectorProps {
  label: string;
  chainId: ChainId | undefined;
  token: Token | null;
  onChainChange: (chainId: ChainId) => void;
  onTokenChange: (token: Token) => void;
  disabled?: boolean;
}

export function TokenSelector({
  label,
  chainId,
  token,
  onChainChange,
  onTokenChange,
  disabled,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: chainsData } = useChains();
  const { data: tokensData, isLoading: tokensLoading } = useTokens(chainId);

  const chains = chainsData?.chains || [];
  const tokens = tokensData?.tokens || [];

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <select
          value={chainId || ""}
          onChange={(e) => onChainChange(Number(e.target.value) as ChainId)}
          disabled={disabled}
          className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 transition-all"
        >
          <option value="">Chain</option>
          {chains.map((chain) => (
            <option key={chain.chainId} value={chain.chainId}>
              {chain.name}
            </option>
          ))}
        </select>
        <div className="flex-1 relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || !chainId || tokens.length === 0}
            className="token-button w-full disabled:opacity-50"
          >
            {token ? (
              <>
                {token.logoURI ? (
                  <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {token.symbol[0]}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">{token.symbol}</div>
                  <div className="text-xs text-gray-500">{token.name}</div>
                </div>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                <span className="flex-1 text-left text-gray-500">Select token</span>
              </>
            )}
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isOpen && chainId && tokens.length > 0 && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsOpen(false)}
              ></div>
              <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-80 overflow-auto">
                {tokensLoading ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm">Loading tokens...</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {tokens.map((t) => (
                      <button
                        key={t.address}
                        type="button"
                        onClick={() => {
                          onTokenChange(t);
                          setIsOpen(false);
                        }}
                        className="token-button w-full"
                      >
                        {t.logoURI ? (
                          <img src={t.logoURI} alt={t.symbol} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                            {t.symbol[0]}
                          </div>
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-gray-900">{t.symbol}</div>
                          <div className="text-xs text-gray-500">{t.name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

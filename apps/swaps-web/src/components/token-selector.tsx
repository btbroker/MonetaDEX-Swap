"use client";

import { useState, useId, useMemo } from "react";
import type { Token, ChainId } from "@fortuna/shared";
import { useTokens } from "../hooks/use-tokens";
import { useChains } from "../hooks/use-chains";
import {
  getRecentAddresses,
  addRecentToken,
  getFavoriteAddresses,
  isFavorite,
  toggleFavorite,
} from "../lib/token-picker-storage";

interface TokenSelectorProps {
  label: string;
  chainId: ChainId | undefined;
  token: Token | null;
  onChainChange: (chainId: ChainId) => void;
  onTokenChange: (token: Token) => void;
  disabled?: boolean;
  idSuffix?: string;
}

function matchToken(query: string, t: Token): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    t.symbol.toLowerCase().includes(q) ||
    t.name.toLowerCase().includes(q) ||
    t.address.toLowerCase().includes(q)
  );
}

export function TokenSelector({
  label,
  chainId,
  token,
  onChainChange,
  onTokenChange,
  disabled,
  idSuffix = "token",
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [favVersion, setFavVersion] = useState(0);

  const uid = useId().replace(/:/g, "");
  const chainSelectId = `chain-${idSuffix}-${uid}`;
  const tokenButtonId = `token-${idSuffix}-${uid}`;
  const { data: chainsData, isError: chainsError, error: chainsErrorDetail } = useChains();
  const { data: tokensData, isLoading: tokensLoading, isError: tokensError } = useTokens(chainId);

  const chains = chainsData?.chains || [];
  const tokens = tokensData?.tokens || [];
  const apiUrl =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : "http://localhost:3001";

  const filteredTokens = useMemo(() => {
    return tokens.filter((t) => matchToken(searchQuery, t));
  }, [tokens, searchQuery]);

  const recentAddresses = chainId ? getRecentAddresses(chainId) : [];

  const { favorites, recent, rest } = useMemo(() => {
    const favAddrs = chainId ? getFavoriteAddresses(chainId) : new Set<string>();
    const fav: Token[] = [];
    const rec: Token[] = [];
    const other: Token[] = [];
    const seen = new Set<string>();
    const byAddr = new Map<string, Token>();
    for (const t of filteredTokens) byAddr.set(t.address.toLowerCase(), t);

    for (const addr of favAddrs) {
      const t = byAddr.get(addr.toLowerCase());
      if (t) {
        fav.push(t);
        seen.add(t.address.toLowerCase());
      }
    }
    for (const addr of recentAddresses) {
      const t = byAddr.get(addr.toLowerCase());
      if (t && !seen.has(t.address.toLowerCase())) {
        rec.push(t);
        seen.add(t.address.toLowerCase());
      }
    }
    for (const t of filteredTokens) {
      if (!seen.has(t.address.toLowerCase())) other.push(t);
    }
    return { favorites: fav, recent: rec, rest: other };
  }, [chainId, filteredTokens, recentAddresses, favVersion]);

  const handleSelectToken = (t: Token) => {
    if (chainId) addRecentToken(chainId, t.address);
    onTokenChange(t);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleToggleFavorite = (e: React.MouseEvent, t: Token) => {
    e.preventDefault();
    e.stopPropagation();
    if (!chainId) return;
    toggleFavorite(chainId, t.address);
    setFavVersion((v) => v + 1);
  };

  const renderTokenRow = (t: Token, showStar: boolean) => (
    <button
      key={t.address}
      type="button"
      onClick={() => handleSelectToken(t)}
      className="token-button w-full flex items-center gap-3"
    >
      {t.logoURI ? (
        <img src={t.logoURI} alt={t.symbol} className="w-8 h-8 rounded-full shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {t.symbol[0]}
        </div>
      )}
      <div className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-gray-900 truncate">{t.symbol}</div>
        <div className="text-xs text-gray-500 truncate">{t.name}</div>
      </div>
      {showStar && chainId && (
        <button
          type="button"
          onClick={(e) => handleToggleFavorite(e, t)}
          className="p-1.5 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
          aria-label={isFavorite(chainId, t.address) ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite(chainId, t.address) ? (
            <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
        </button>
      )}
    </button>
  );

  return (
    <div className="relative">
      {label ? (
        <label htmlFor={chainSelectId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      ) : (
        <span className="sr-only">Chain and token</span>
      )}
      {chainsError && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2" role="alert">
          Could not load chains. Make sure the API is running at{" "}
          <code className="text-xs bg-amber-100 px-1 rounded">{apiUrl}</code> and try again.
          {chainsErrorDetail instanceof Error && (
            <span className="block mt-1 text-xs text-amber-600">{chainsErrorDetail.message}</span>
          )}
        </p>
      )}
      <div className="flex gap-2">
        <select
          id={chainSelectId}
          name={chainSelectId}
          value={chainId || ""}
          onChange={(e) => onChainChange(Number(e.target.value) as ChainId)}
          disabled={disabled || chainsError}
          aria-label="Chain"
          aria-invalid={chainsError}
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
            id={tokenButtonId}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label={token ? `Token: ${token.symbol}` : "Select token"}
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
                <div className="w-6 h-6 rounded-full bg-gray-200" />
                <span className="flex-1 text-left text-gray-500">Select token</span>
              </>
            )}
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isOpen && chainId && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearchQuery(""); }} aria-hidden />
              <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-80">
                {tokensLoading ? (
                  <div className="px-4 py-8 text-center text-gray-500">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    <p className="mt-2 text-sm">Loading tokens...</p>
                  </div>
                ) : tokensError ? (
                  <div className="px-4 py-8 text-center text-amber-600 text-sm">
                    Could not load tokens. Check that the API is running and try again.
                  </div>
                ) : tokens.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">No tokens for this chain.</div>
                ) : (
                  <>
                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by symbol, name, or address"
                        aria-label="Search tokens"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-auto p-2 min-h-0">
                      {filteredTokens.length === 0 ? (
                        <p className="py-4 text-center text-gray-500 text-sm">No tokens match your search.</p>
                      ) : (
                        <>
                          {favorites.length > 0 && (
                            <div className="mb-2">
                              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Favorites</p>
                              <div className="space-y-0.5">
                                {favorites.map((t) => renderTokenRow(t, true))}
                              </div>
                            </div>
                          )}
                          {recent.length > 0 && (
                            <div className="mb-2">
                              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent</p>
                              <div className="space-y-0.5">
                                {recent.map((t) => renderTokenRow(t, true))}
                              </div>
                            </div>
                          )}
                          <div>
                            {(favorites.length > 0 || recent.length > 0) && (
                              <p className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">All tokens</p>
                            )}
                            <div className="space-y-0.5">
                              {rest.map((t) => renderTokenRow(t, true))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

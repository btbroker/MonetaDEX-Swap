"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain, useSendTransaction, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { formatUnits } from "viem";
import type { Token, ChainId, Route, QuoteRequest, QuoteResponse } from "@fortuna/shared";

/** Quote API can optionally return filteredRoutes when policy filters some routes. */
type QuoteResponseWithFiltered = QuoteResponse & {
  filteredRoutes?: Array<{ routeId: string; reason: string }>;
};
import { TokenSelector } from "../components/token-selector";
import { AmountInput } from "../components/amount-input";
import { Settings } from "../components/settings";
import { RouteCard } from "../components/route-card";
import { ConnectWallet, useOpenWalletDropdown } from "../components/connect-wallet";
import { TxStatus } from "../components/tx-status";
import { useQuote } from "../hooks/use-quote";
import { useChains } from "../hooks/use-chains";
import { getSettings, type UserSettings } from "../lib/storage";
import { apiClient, ApiError } from "../lib/api-client";
import { buildQuoteRequest, formatRouteAmountOut } from "../lib/amount-utils";

const DEFAULT_CHAIN_ID = 137; // Polygon – used when wallet not connected

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const openWalletDropdown = useOpenWalletDropdown();
  const { switchChain } = useSwitchChain();
  const { sendTransaction, data: txHash, isPending: isTxPending } = useSendTransaction();
  const { isLoading: isTxConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const { data: chainsData } = useChains();
  const chains = chainsData?.chains ?? [];

  const [fromChainId, setFromChainId] = useState<ChainId | undefined>(undefined);
  const [toChainId, setToChainId] = useState<ChainId | undefined>(undefined);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [showTxStatus, setShowTxStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const nativeZero = "0x0000000000000000000000000000000000000000" as const;
  const { data: fromBalance } = useBalance({
    address: address ?? undefined,
    token: fromToken && fromToken.address.toLowerCase() !== nativeZero.toLowerCase() ? (fromToken.address as `0x${string}`) : undefined,
  });

  // When wallet is connected, sync from/to chain to wallet chain
  useEffect(() => {
    if (chainId) {
      setFromChainId(chainId);
      setToChainId(chainId);
    }
  }, [chainId]);

  // When wallet not connected and chains have loaded, default to first chain (or Polygon) so chains/tokens appear
  useEffect(() => {
    if (chainId != null) return;
    if (fromChainId != null) return;
    if (chains.length === 0) return;
    const defaultId = chains.some((c) => c.chainId === DEFAULT_CHAIN_ID)
      ? DEFAULT_CHAIN_ID
      : chains[0].chainId;
    setFromChainId(defaultId);
    setToChainId(defaultId);
  }, [chainId, fromChainId, chains]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const quoteRequest: QuoteRequest | null = useMemo(() => {
    if (!fromChainId || !toChainId || !fromToken || !toToken || !amountIn) {
      return null;
    }
    return buildQuoteRequest({
      amountHuman: amountIn,
      fromTokenDecimals: fromToken.decimals ?? 18,
      fromChainId,
      toChainId,
      fromToken: fromToken.address,
      toToken: toToken.address,
      slippageTolerance: settings.slippageTolerance,
    });
  }, [fromChainId, toChainId, fromToken, toToken, amountIn, settings.slippageTolerance]);

  const { data: quoteData, isLoading: isQuoteLoading, isError: isQuoteError, refetch: refetchQuote } = useQuote(
    quoteRequest,
    !!quoteRequest
  );

  // Auto-select the first (best) route when quotes load so the correct rate is shown by default
  useEffect(() => {
    const routes = quoteData?.routes;
    if (!routes?.length) return;
    const best = routes[0];
    setSelectedRoute((prev) => {
      if (!prev) return best;
      const stillInList = routes.some((r) => r.routeId === prev.routeId);
      return stillInList ? prev : best;
    });
  }, [quoteData?.routes]);

  const canExecute =
    isConnected &&
    selectedRoute &&
    fromToken &&
    toToken &&
    amountIn &&
    chainId === fromChainId;

  const handleExecute = async () => {
    if (!selectedRoute || !fromToken || !toToken || !amountIn || !address) {
      return;
    }

    setError(null);

    try {
      // Get transaction data from API
      const txData = await apiClient.getTx({
        routeId: selectedRoute.routeId,
        fromChainId: selectedRoute.fromChainId,
        toChainId: selectedRoute.toChainId,
        fromToken: selectedRoute.fromToken,
        toToken: selectedRoute.toToken,
        amountIn: (selectedRoute as Route & { amountInWei?: string }).amountInWei ?? selectedRoute.amountIn,
        recipient: address,
        slippageTolerance: settings.slippageTolerance,
      });

      // Check if chain needs to be switched
      if (chainId !== txData.chainId) {
        switchChain({ chainId: txData.chainId });
        return;
      }

      // Send transaction
      // Note: In production, you'd decode the txData and use the proper ABI
      // For raw transactions, we use sendTransaction with the txData
      sendTransaction({
        to: txData.to as `0x${string}`,
        value: BigInt(txData.value),
        data: txData.txData as `0x${string}`,
        gas: BigInt(txData.gasLimit),
      });

      setShowTxStatus(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to execute transaction");
      }
    }
  };

  const handleMax = () => {
    if (!fromToken || !fromBalance?.value) return;
    const decimals = fromToken.decimals ?? 18;
    const raw = formatUnits(fromBalance.value, decimals);
    const trimmed = raw.replace(/\.?0+$/, "") || "0";
    setAmountIn(trimmed);
  };

  return (
    <main className="min-h-screen py-5 px-3 sm:py-8 sm:px-4 md:px-6">
      <div className="max-w-lg mx-auto">
        <div className="swap-card p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent truncate">
                MONETADEX
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Best rates across all DEXs</p>
            </div>
            <ConnectWallet />
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 text-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Swap Interface */}
          <div className="space-y-4 sm:space-y-5">
            {/* From Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium text-gray-600">From</label>
                {mounted && isConnected && fromToken && (
                  <span className="text-xs text-gray-500" title="Token balance">
                    Balance: {fromBalance != null
                      ? (() => {
                          const raw = formatUnits(fromBalance.value, fromToken.decimals ?? 18);
                          const trimmed = raw.replace(/\.?0+$/, "") || "0";
                          return trimmed.length > 14 ? `${trimmed.slice(0, 14)}…` : trimmed;
                        })()
                      : "—"}
                  </span>
                )}
              </div>
              <div className="swap-card p-3 sm:p-4 space-y-3">
                <TokenSelector
                  label=""
                  chainId={fromChainId}
                  token={fromToken}
                  onChainChange={setFromChainId}
                  onTokenChange={setFromToken}
                  idSuffix="from"
                />
                <AmountInput
                  label=""
                  value={amountIn}
                  onChange={setAmountIn}
                  token={fromToken}
                  onMax={mounted && isConnected ? handleMax : undefined}
                  inputSuffix="from"
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-1 sm:-my-2 relative z-10">
              <button
                type="button"
                aria-label="Swap direction"
                className="p-2.5 sm:p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors shadow border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={() => {
                  const temp = fromToken;
                  setFromToken(toToken);
                  setToToken(temp);
                  const tempChain = fromChainId;
                  setFromChainId(toChainId);
                  setToChainId(tempChain);
                }}
                disabled={!fromToken || !toToken}
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-600">To</label>
                {quoteData?.routes && quoteData.routes.length > 0 && selectedRoute && toToken && (
                  <span className="text-sm font-medium text-gray-700" title="You receive">
                    You receive:{" "}
                    {(() => {
                      const { display, isFromWei, noDisplay } = formatRouteAmountOut(selectedRoute);
                      if (noDisplay) {
                        if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
                          if (!(window as Window & { __loggedNoDisplayRoute?: Set<string> }).__loggedNoDisplayRoute) {
                            (window as Window & { __loggedNoDisplayRoute?: Set<string> }).__loggedNoDisplayRoute = new Set();
                          }
                          const logged = (window as Window & { __loggedNoDisplayRoute?: Set<string> }).__loggedNoDisplayRoute!;
                          if (!logged.has(selectedRoute.routeId)) {
                            logged.add(selectedRoute.routeId);
                            console.warn("[amount-utils] Route has no amountOutHuman and no amountOutWei; display is not safe. Use amountOutHuman or amountOutWei+toDecimals.", selectedRoute);
                          }
                        }
                        return "No quote";
                      }
                      const formatted = parseFloat(display).toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      });
                      return (
                        <>
                          {isFromWei ? formatted : `~${formatted}`}
                          {" "}
                          {toToken.symbol}
                        </>
                      );
                    })()}
                  </span>
                )}
              </div>
              <div className="swap-card p-3 sm:p-4">
                <TokenSelector
                  label=""
                  chainId={toChainId}
                  token={toToken}
                  onChainChange={setToChainId}
                  onTokenChange={setToToken}
                  idSuffix="to"
                />
              </div>
            </div>

            {/* Routes Section */}
            {quoteRequest && (
              <>
                <div className="flex items-center justify-between gap-2 pt-4 sm:pt-5 border-t border-gray-200">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800">Available Routes</h2>
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="btn-ghost flex items-center gap-1.5 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="hidden sm:inline">Settings</span>
                  </button>
                </div>

                {/* Quote panel: fixed min-height to avoid layout shift; skeleton when loading */}
                <div className="min-h-[200px] sm:min-h-[220px] mt-3 sm:mt-4">
                  {isQuoteLoading && (
                    <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading routes">
                      <div className="skeleton h-20 sm:h-24 w-full" />
                      <div className="skeleton h-20 sm:h-24 w-full" />
                      <div className="skeleton h-16 sm:h-20 w-full max-w-[85%]" />
                      <p className="text-sm text-gray-500 pt-2">Fetching best price...</p>
                    </div>
                  )}

                {!isQuoteLoading && isQuoteError && (
                  <div className="text-center py-8 sm:py-12" role="alert">
                    <p className="font-medium text-gray-800">API unavailable</p>
                    <p className="text-sm text-gray-500 mt-2">
                      We couldn&apos;t reach the server. Check your connection and try again.
                    </p>
                    <button
                      type="button"
                      onClick={() => refetchQuote()}
                      className="btn-secondary mt-4"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!isQuoteLoading && !isQuoteError && quoteData?.routes && quoteData.routes.length > 0 && (
                  <div className="space-y-3">
                    {quoteData.routes.map((route) => (
                      <RouteCard
                        key={route.routeId}
                        route={route}
                        isSelected={selectedRoute?.routeId === route.routeId}
                        onSelect={() => setSelectedRoute(route)}
                      />
                    ))}
                  </div>
                )}

                {!isQuoteLoading && !isQuoteError && quoteData?.routes && quoteData.routes.length === 0 && (
                  <div className="text-center py-8 sm:py-12 text-gray-500" role="status" aria-live="polite">
                    <p className="font-medium">No route available</p>
                    <p className="text-sm mt-2">
                      We couldn&apos;t find a swap for this pair or amount. Try a different amount or token.
                    </p>
                  </div>
                )}
                </div>

                {(() => {
                  const quote = quoteData as QuoteResponseWithFiltered | undefined;
                  const filtered = quote?.filteredRoutes;
                  return filtered && filtered.length > 0 ? (
                    <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-3">
                      {filtered.length} route(s) filtered by policy
                    </div>
                  ) : null;
                })()}

                {process.env.NEXT_PUBLIC_DEBUG_UI_QUOTES === "1" &&
                  quoteData?.routes &&
                  quoteData.routes.length > 0 && (
                    <div className="mt-4 p-3 border border-gray-200 rounded-lg bg-gray-50 text-xs" aria-label="Debug quotes panel">
                      <p className="font-semibold text-gray-700 mb-2">Debug: top 3 routes</p>
                      <ul className="space-y-2">
                        {quoteData.routes.slice(0, 3).map((route) => {
                          const { display: amountOutDisplay } = formatRouteAmountOut(route);
                          const amountInStr = route.amountInHuman ?? route.amountIn;
                          const inNum = parseFloat(amountInStr);
                          const outNum = parseFloat(amountOutDisplay);
                          const impliedRate =
                            inNum > 0 && Number.isFinite(outNum) ? (outNum / inNum).toFixed(6) : "—";
                          return (
                            <li
                              key={route.routeId}
                              className="border-b border-gray-200 last:border-0 pb-2 last:pb-0"
                            >
                              <span className="font-medium">{route.provider}</span>
                              {" · "}
                              amountOutHuman: {amountOutDisplay}
                              {" · "}
                              impliedRate: {impliedRate}
                              {route.warnings?.length ? (
                                <span className="text-amber-700"> · ⚠ {route.warnings.join("; ")}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
              </>
            )}

            {/* Execute Button (primary CTA) */}
            <button
              type="button"
              onClick={!isConnected ? openWalletDropdown : handleExecute}
              disabled={isConnected && (!canExecute || isTxPending || isTxConfirming)}
              className={`swap-button ${
                !isConnected || (canExecute && !isTxPending && !isTxConfirming)
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              }`}
            >
              {!mounted ? (
                "Connect Wallet"
              ) : isTxPending || isTxConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </span>
              ) : !isConnected ? (
                "Connect Wallet"
              ) : !canExecute ? (
                selectedRoute ? "Select a route above" : "Enter amount to get quotes"
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Execute Swap
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onSave={(newSettings) => setSettings(newSettings)}
        />
      )}

      {showTxStatus && txHash && (
        <TxStatus
          txHash={txHash}
          chainId={fromChainId || chainId}
          onClose={() => {
            setShowTxStatus(false);
            setSelectedRoute(null);
            setAmountIn("");
          }}
        />
      )}
    </main>
  );
}

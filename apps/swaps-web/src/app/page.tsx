"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import type { Token, ChainId, Route, QuoteRequest } from "@fortuna/shared";
import { TokenSelector } from "../components/token-selector";
import { AmountInput } from "../components/amount-input";
import { Settings } from "../components/settings";
import { RouteCard } from "../components/route-card";
import { ConnectWallet } from "../components/connect-wallet";
import { TxStatus } from "../components/tx-status";
import { useQuote } from "../hooks/use-quote";
import { getSettings, type UserSettings } from "../lib/storage";
import { apiClient, ApiError } from "../lib/api-client";

export default function Home() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransaction, data: txHash, isPending: isTxPending } = useSendTransaction();
  const { isLoading: isTxConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Initialize with undefined to avoid hydration mismatch
  // chainId will be set after mount
  const [fromChainId, setFromChainId] = useState<ChainId | undefined>(undefined);
  const [toChainId, setToChainId] = useState<ChainId | undefined>(undefined);
  
  // Sync with wallet chain after mount
  useEffect(() => {
    if (chainId) {
      setFromChainId(chainId);
      setToChainId(chainId);
    }
  }, [chainId]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [showTxStatus, setShowTxStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quoteRequest: QuoteRequest | null = useMemo(() => {
    if (!fromChainId || !toChainId || !fromToken || !toToken || !amountIn) {
      return null;
    }

    return {
      fromChainId,
      toChainId,
      fromToken: fromToken.address,
      toToken: toToken.address,
      amountIn,
      slippageTolerance: settings.slippageTolerance,
    };
  }, [fromChainId, toChainId, fromToken, toToken, amountIn, settings.slippageTolerance]);

  const { data: quoteData, isLoading: isQuoteLoading } = useQuote(
    quoteRequest,
    !!quoteRequest
  );

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
        amountIn: selectedRoute.amountIn,
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
    // In a real implementation, this would fetch the user's balance
    // For now, we'll just set a placeholder
    setAmountIn("1000");
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="swap-card p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                MONETADEX
              </h1>
              <p className="text-sm text-gray-500 mt-1">Best rates across all DEXs</p>
            </div>
            <ConnectWallet />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 text-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Swap Interface */}
          <div className="space-y-4">
            {/* From Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-600">From</label>
                {isConnected && fromToken && (
                  <span className="text-xs text-gray-500">Balance: --</span>
                )}
              </div>
              <div className="swap-card p-4 space-y-3">
                <TokenSelector
                  label=""
                  chainId={fromChainId}
                  token={fromToken}
                  onChainChange={setFromChainId}
                  onTokenChange={setFromToken}
                />
                <AmountInput
                  label=""
                  value={amountIn}
                  onChange={setAmountIn}
                  token={fromToken}
                  onMax={isConnected ? handleMax : undefined}
                />
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                type="button"
                className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-600">To</label>
                {quoteData?.routes && quoteData.routes.length > 0 && selectedRoute && (
                  <span className="text-xs text-gray-500">
                    ≈ {parseFloat(selectedRoute.amountOut).toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })} {toToken?.symbol}
                  </span>
                )}
              </div>
              <div className="swap-card p-4">
                <TokenSelector
                  label=""
                  chainId={toChainId}
                  token={toToken}
                  onChainChange={setToChainId}
                  onTokenChange={setToToken}
                />
              </div>
            </div>

            {/* Routes Section */}
            {quoteRequest && (
              <>
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-800">Available Routes</h2>
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Settings
                  </button>
                </div>

                {isQuoteLoading && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 mt-4">Finding best routes...</p>
                  </div>
                )}

                {quoteData?.routes && quoteData.routes.length > 0 && (
                  <div className="space-y-3 mt-4">
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

                {quoteData?.routes && quoteData.routes.length === 0 && !isQuoteLoading && (
                  <div className="text-center py-12 text-gray-500">
                    <p className="font-medium">No routes available</p>
                    <p className="text-sm mt-2">Try adjusting your swap parameters</p>
                  </div>
                )}

                {(quoteData as any)?.filteredRoutes && (quoteData as any).filteredRoutes.length > 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-3">
                    {(quoteData as any).filteredRoutes.length} route(s) filtered by policy
                  </div>
                )}
              </>
            )}

            {/* Execute Button */}
            <button
              type="button"
              onClick={handleExecute}
              disabled={!canExecute || isTxPending || isTxConfirming}
              className={`swap-button ${
                canExecute && !isTxPending && !isTxConfirming
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {isTxPending || isTxConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </span>
              ) : !isConnected ? (
                "Connect Wallet to Swap"
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

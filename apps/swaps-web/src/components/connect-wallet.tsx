"use client";

import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEIP6963Wallets } from "../hooks/use-eip6963-wallets";
import type { EIP6963ProviderDetail } from "../hooks/use-eip6963-wallets";


type WalletDropdownContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const WalletDropdownContext = createContext<WalletDropdownContextValue | null>(null);

export function useOpenWalletDropdown() {
  const ctx = useContext(WalletDropdownContext);
  return ctx?.open ?? (() => {});
}

function useWalletDropdown() {
  const ctx = useContext(WalletDropdownContext);
  if (!ctx) {
    return { isOpen: false, open: () => {}, close: () => {} };
  }
  return ctx;
}

export function WalletDropdownProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <WalletDropdownContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </WalletDropdownContext.Provider>
  );
}

function findConnectorForWallet<T extends { uid: string; name?: string }>(
  wallet: EIP6963ProviderDetail,
  connectors: readonly T[]
): T | null {
  const name = wallet.info.name.toLowerCase();
  const rdns = wallet.info.rdns?.toLowerCase() ?? "";
  for (const c of connectors) {
    const cName = (c.name ?? "").toLowerCase();
    const cId = (c.uid ?? "").toLowerCase();
    if (cName === name || cId.includes(rdns) || rdns.includes(cId)) return c;
    if (cName.includes(name) || name.includes(cName)) return c;
  }
  return null;
}

export function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isOpen, open, close } = useWalletDropdown();
  const { wallets, isRequesting } = useEIP6963Wallets(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  const handleSelectWallet = (wallet: EIP6963ProviderDetail) => {
    const connector = findConnectorForWallet(wallet, connectors);
    if (connector) {
      connect({ connector });
      close();
    } else {
      const fallback = connectors.find((c) => c.name === "Injected" || c.name?.toLowerCase().includes("injected"));
      if (fallback) {
        connect({ connector: fallback });
        close();
      }
    }
  };

  const hasEIP6963 = wallets.length > 0;
  const fallbackConnectors = !hasEIP6963 ? connectors : [];

  // Always render the same structure (div > button when not connected) to avoid hydration mismatch.
  // When !mounted we keep the button but disable it until client has hydrated.
  if (isConnected && address && mounted) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs font-medium text-green-700">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        </div>
        <button
          onClick={() => disconnect()}
          className="btn-secondary py-2"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={!mounted}
        onClick={() => mounted && (isOpen ? close() : open())}
        className="btn-primary disabled:opacity-70 disabled:pointer-events-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Connect Wallet
      </button>
      {mounted && isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 py-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-[70vh] overflow-y-auto">
          {hasEIP6963 ? (
            <>
              {wallets.map((wallet) => (
                <button
                  key={wallet.info.uuid}
                  type="button"
                  onClick={() => handleSelectWallet(wallet)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                >
                  {wallet.info.icon ? (
                    <img
                      src={wallet.info.icon}
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                  )}
                  <span>{wallet.info.name}</span>
                </button>
              ))}
              {connectors
                .filter((c) => c.name?.toLowerCase().includes("walletconnect"))
                .map((connector) => (
                  <button
                    key={connector.uid}
                    type="button"
                    onClick={() => {
                      connect({ connector });
                      close();
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-gray-100 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                    <span>{connector.name}</span>
                  </button>
                ))}
            </>
          ) : isRequesting ? (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">
              <div className="animate-pulse">Detecting wallets…</div>
            </div>
          ) : fallbackConnectors.length > 0 ? (
            fallbackConnectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => {
                  connect({ connector });
                  close();
                }}
                className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
              >
                {connector.name === "Injected" ? "Browser Wallet" : connector.name}
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-sm text-gray-600">
              <p className="font-medium text-gray-800 mb-1">No wallet detected</p>
              <p className="text-xs">Install MetaMask, Keplr, or another Web3 wallet extension and refresh.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

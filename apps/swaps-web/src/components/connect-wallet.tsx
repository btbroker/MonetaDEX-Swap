"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectWallet() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to match initial client render
  if (!mounted) {
    return (
      <div className="flex gap-2">
        <div className="px-5 py-2.5 bg-gray-200 rounded-xl text-sm font-semibold animate-pulse">
          <span className="invisible">Connect Wallet</span>
        </div>
      </div>
    );
  }

  if (isConnected && address) {
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
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 text-sm font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}

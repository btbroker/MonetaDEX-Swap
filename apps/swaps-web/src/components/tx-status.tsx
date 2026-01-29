"use client";

import { useTxStatus } from "../hooks/use-tx-status";
import type { ChainId } from "@fortuna/shared";

interface TxStatusProps {
  txHash: string;
  chainId: ChainId;
  onClose: () => void;
}

const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  56: "https://bscscan.com/tx/",
};

export function TxStatus({ txHash, chainId, onClose }: TxStatusProps) {
  const { data: status, isLoading } = useTxStatus(txHash, true);
  const explorerUrl = EXPLORER_URLS[chainId];

  const getStatusColor = () => {
    switch (status?.status) {
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-red-600";
      case "pending":
        return "text-yellow-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Transaction Status</h2>

        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-600 mb-1">Status</div>
              <div className={`font-semibold ${getStatusColor()}`}>
                {status?.status || "Unknown"}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600 mb-1">Transaction Hash</div>
              <div className="font-mono text-xs break-all">{txHash}</div>
            </div>

            {status?.confirmations !== undefined && (
              <div>
                <div className="text-sm text-gray-600 mb-1">Confirmations</div>
                <div>{status.confirmations}</div>
              </div>
            )}

            {explorerUrl && (
              <a
                href={`${explorerUrl}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline text-sm"
              >
                View on Explorer →
              </a>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}

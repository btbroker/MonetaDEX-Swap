"use client";

import type { Route } from "@fortuna/shared";

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
}

export function RouteCard({ route, isSelected, onSelect }: RouteCardProps) {
  const amountOut = parseFloat(route.amountOut);
  const priceImpact = route.priceImpactBps ? route.priceImpactBps / 100 : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full p-4 border-2 rounded-2xl text-left transition-all ${
        isSelected
          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg scale-[1.02]"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
          <span className="font-semibold text-gray-900">{route.provider}</span>
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
            route.type === 'swap' 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-purple-100 text-purple-700'
          }`}>
            {route.type.toUpperCase()}
          </span>
          {route.toolsUsed && route.toolsUsed.length > 0 && (
            <span className="text-xs text-gray-500">
              via {route.toolsUsed.slice(0, 2).join(', ')}
              {route.toolsUsed.length > 2 && ` +${route.toolsUsed.length - 2}`}
            </span>
          )}
        </div>
        {priceImpact !== null && (
          <span
            className={`text-xs px-2 py-1 rounded-lg font-medium ${
              priceImpact > 5 
                ? "bg-red-100 text-red-700" 
                : priceImpact > 1
                ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {priceImpact.toFixed(2)}% impact
          </span>
        )}
      </div>

      <div className="text-3xl font-bold mb-2 text-gray-900">
        {amountOut.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600">
          Fee: <span className="font-medium text-gray-900">
            {parseFloat(route.fees).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}
          </span>
        </div>
        <div className="text-gray-600">
          Gas: <span className="font-medium text-gray-900">
            {parseFloat(route.estimatedGas).toLocaleString()}
          </span>
        </div>
      </div>

      {route.warnings && route.warnings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
          {route.warnings.map((warning, idx) => (
            <div
              key={idx}
              className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-2"
            >
              <span>⚠️</span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

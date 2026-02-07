"use client";

import { useState } from "react";
import type { Route, RouteStep } from "@fortuna/shared";
import { formatRouteAmountOut, formatStepAmountOut } from "../lib/amount-utils";

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
  toTokenSymbol?: string;
  isBestRoute?: boolean;
}

function formatAmount(value: string, maxDecimals = 6): string {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

export function RouteCard({ route, isSelected, onSelect, toTokenSymbol, isBestRoute }: RouteCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { display: amountOutRaw, isFromWei, noDisplay } = formatRouteAmountOut(route);
  const amountOutStr =
    noDisplay
      ? (() => {
          if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
            if (!(window as Window & { __loggedNoDisplayRouteCard?: Set<string> }).__loggedNoDisplayRouteCard) {
              (window as Window & { __loggedNoDisplayRouteCard?: Set<string> }).__loggedNoDisplayRouteCard = new Set();
            }
            const logged = (window as Window & { __loggedNoDisplayRouteCard?: Set<string> }).__loggedNoDisplayRouteCard!;
            if (!logged.has(route.routeId)) {
              logged.add(route.routeId);
              console.warn("[amount-utils] Route has no amountOutHuman and no amountOutWei.", route);
            }
          }
          return "No quote";
        })()
      : formatAmount(amountOutRaw) + (isFromWei ? "" : " ~");
  const toDecimals = route.toDecimals ?? 18;
  const priceImpact = route.priceImpactBps != null ? route.priceImpactBps / 100 : null;
  const fee = formatAmount(route.fees);
  const gas = route.estimatedGas ? parseFloat(route.estimatedGas).toLocaleString() : "—";
  const hasSteps = route.steps?.length > 0;
  const hasTools = route.toolsUsed && route.toolsUsed.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full rounded-2xl border-2 text-left transition-all cursor-pointer ${
        isSelected
          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg scale-[1.02]"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="p-3 sm:p-4">
        {/* Provider + Best route badge */}
        <div className="flex items-center gap-2 flex-wrap mb-2 sm:mb-3">
          {isBestRoute && (
            <span className="text-xs font-semibold px-2 py-1 rounded-md bg-emerald-100 text-emerald-800">
              Best route
            </span>
          )}
          <span className="font-semibold text-gray-900">{route.provider}</span>
          <span
            className={`text-xs px-2 py-1 rounded-lg font-medium ${
              route.type === "swap" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
            }`}
          >
            {route.type}
          </span>
        </div>

        {/* You receive */}
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">You receive</p>
          <p className="text-2xl font-bold text-gray-900">
            {amountOutStr}
            {toTokenSymbol ? ` ${toTokenSymbol}` : ""}
          </p>
        </div>

        {/* Fee, price impact, gas */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            Est. fee: <span className="font-medium text-gray-900">{fee}</span>
          </span>
          {priceImpact != null && (
            <span>
              Price impact:{" "}
              <span
                className={`font-medium ${
                  priceImpact > 5 ? "text-red-600" : priceImpact > 1 ? "text-amber-600" : "text-gray-900"
                }`}
              >
                {priceImpact.toFixed(2)}%
              </span>
            </span>
          )}
          <span>
            Gas: <span className="font-medium text-gray-900">{gas}</span>
          </span>
        </div>

        {/* Expandable route details */}
        {(hasSteps || hasTools) && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsOpen((o) => !o);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              {detailsOpen ? "Hide route details" : "View route details"}
            </button>
            {detailsOpen && (
              <div className="mt-3 space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
                {hasSteps && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Steps</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-600">
                        {route.steps!.map((step: RouteStep, i: number) => (
                        <li key={i}>
                          {step.type} via {step.provider}: {formatAmount(step.amountInHuman ?? step.amountIn)} → {formatAmount(formatStepAmountOut(step, toDecimals))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasTools && (
                  <div>
                    <p className="font-medium text-gray-700 mb-1">Tools used</p>
                    <p className="text-gray-600">{route.toolsUsed!.join(" → ")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
      </div>
    </div>
  );
}

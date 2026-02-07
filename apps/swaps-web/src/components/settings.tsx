"use client";

import { useState, useId } from "react";
import { getSettings, saveSettings, type UserSettings } from "../lib/storage";

interface SettingsProps {
  onClose: () => void;
  onSave: (settings: UserSettings) => void;
}

export function Settings({ onClose, onSave }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const slippageId = `slippage-${useId().replace(/:/g, "")}`;
  const priceImpactId = `price-impact-${useId().replace(/:/g, "")}`;

  const handleSave = () => {
    saveSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Settings</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor={slippageId} className="block text-sm font-medium text-gray-700 mb-1">
              Slippage Tolerance (%)
            </label>
            <input
              id={slippageId}
              name="slippageTolerance"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settings.slippageTolerance}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  slippageTolerance: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={priceImpactId} className="block text-sm font-medium text-gray-700 mb-1">
              Max Price Impact (basis points)
            </label>
            <input
              id={priceImpactId}
              name="maxPriceImpactBps"
              type="number"
              min="0"
              max="10000"
              step="10"
              value={settings.maxPriceImpactBps}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxPriceImpactBps: parseInt(e.target.value) || 0,
                })
              }
              aria-describedby={`${priceImpactId}-hint`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p id={`${priceImpactId}-hint`} className="text-xs text-gray-500 mt-1" aria-hidden="true">
              {settings.maxPriceImpactBps / 100}% maximum price impact
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

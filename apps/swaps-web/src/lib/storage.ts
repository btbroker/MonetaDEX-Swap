const STORAGE_KEY = "fortuna-swaps-settings";

export interface UserSettings {
  slippageTolerance: number;
  maxPriceImpactBps: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  slippageTolerance: 0.5,
  maxPriceImpactBps: 500,
};

export function getSettings(): UserSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load settings from localStorage", error);
  }

  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings to localStorage", error);
  }
}

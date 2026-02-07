const RECENT_KEY = "fortuna-swaps-recent-tokens";
const FAVORITES_KEY = "fortuna-swaps-favorite-tokens";
const RECENT_MAX = 5;

type StoredRecent = Record<string, string[]>;

function getStoredRecent(): StoredRecent {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredRecent;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function setStoredRecent(data: StoredRecent): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save recent tokens", e);
  }
}

export function getRecentAddresses(chainId: number): string[] {
  const key = String(chainId);
  const list = getStoredRecent()[key];
  return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
}

export function addRecentToken(chainId: number, address: string): void {
  const data = getStoredRecent();
  const key = String(chainId);
  const list = (data[key] || []).filter((a) => a.toLowerCase() !== address.toLowerCase());
  data[key] = [address, ...list].slice(0, RECENT_MAX);
  setStoredRecent(data);
}

function getStoredFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStoredFavorites(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn("Failed to save favorite tokens", e);
  }
}

function favId(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

export function getFavoriteAddresses(chainId: number): Set<string> {
  const ids = getStoredFavorites();
  const prefix = `${chainId}:`;
  const set = new Set<string>();
  for (const id of ids) {
    if (id.startsWith(prefix)) set.add(id.slice(prefix.length));
  }
  return set;
}

export function isFavorite(chainId: number, address: string): boolean {
  return getStoredFavorites().includes(favId(chainId, address));
}

export function toggleFavorite(chainId: number, address: string): void {
  const ids = getStoredFavorites();
  const id = favId(chainId, address);
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  setStoredFavorites(next);
}

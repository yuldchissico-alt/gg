/**
 * LocalStorage Persistence Utility
 * Saves and retrieves data from localStorage with JSON serialization
 */

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to save to localStorage (key: ${key}):`, error);
  }
}

export function getFromStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.warn(`Failed to retrieve from localStorage (key: ${key}):`, error);
    return null;
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove from localStorage (key: ${key}):`, error);
  }
}

/**
 * Convert API route to storage key
 * e.g., "/api/funnels" -> "cache:funnels"
 */
export function getStorageKey(apiRoute: string): string {
  const path = apiRoute.replace(/^\/api\//, "").replace(/\//g, ":");
  return `cache:${path}`;
}

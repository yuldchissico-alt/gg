/**
 * Custom hook for mutations that automatically persist to localStorage
 * Makes sure data created/updated via mutations is saved for offline access
 */

import { UseMutationOptions } from "@tanstack/react-query";
import { saveToStorage, getStorageKey } from "./localStorage";

type PersistMutationOptions<TData, TError, TVariables> = UseMutationOptions<TData, TError, TVariables> & {
  cacheKey?: string; // e.g., "/api/funnels", "/api/contacts"
  persistToStorage?: boolean; // default: true
};

/**
 * Helper to save API POST/PUT responses to localStorage
 * Call this after mutations that modify data
 */
export function persistApiResponse<T>(apiRoute: string, data: T): void {
  const storageKey = getStorageKey(apiRoute);
  saveToStorage(storageKey, data);
}

/**
 * Helper to invalidate and refresh cache for a route
 * Also clears any localStorage for that route if requested
 */
export function useInvalidateAndClear(
  queryClient: any,
  cacheKey: string,
  options?: { clearStorage?: boolean }
) {
  return async () => {
    if (options?.clearStorage) {
      const storageKey = getStorageKey(cacheKey);
      localStorage.removeItem(storageKey);
    }
    await queryClient.invalidateQueries({ queryKey: [cacheKey] });
  };
}

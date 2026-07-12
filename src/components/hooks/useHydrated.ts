import { useSyncExternalStore } from "react";

function subscribeToHydrationStore() {
  return unsubscribeFromHydrationStore;
}

function unsubscribeFromHydrationStore() {
  return undefined;
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydrationSnapshot() {
  return false;
}

/**
 * Reports whether the calling React island has hydrated on the client.
 *
 * Returns `false` during SSR and on the very first client render (the paint that
 * must match the server HTML), then `true` once hydration completes. Use it to
 * gate behavior that is only safe after React has attached its event handlers —
 * for example, disabling controlled inputs until they are live so keystrokes
 * typed against the SSR paint cannot be silently dropped when the island wires up.
 *
 * Backed by `useSyncExternalStore` (never `useState` + `useEffect`) so it stays
 * React Compiler-clean and produces no hydration mismatch: the server snapshot is
 * `false` and the client snapshot is `true`.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToHydrationStore, getHydratedSnapshot, getServerHydrationSnapshot);
}

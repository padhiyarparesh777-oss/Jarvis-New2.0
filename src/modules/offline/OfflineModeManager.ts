export type ConnectivityMode = 'online' | 'offline';

/** navigator.onLine is a fast offline signal; API failures are handled separately. */
export function getConnectivityMode(): ConnectivityMode {
  return typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline';
}

export function isOfflineMode(): boolean {
  return getConnectivityMode() === 'offline';
}

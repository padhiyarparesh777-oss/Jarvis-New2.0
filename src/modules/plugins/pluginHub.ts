/**
 * JARVIS Plugin Hub registry.
 *
 * Android app plugins are discovered through the native JarvisDevice bridge.
 * API providers are intentionally backend-mediated: OAuth secrets and refresh
 * tokens must never be stored in the APK or browser localStorage.
 */
export type ApiPluginId = 'google' | 'spotify';

export interface ApiPluginDefinition {
  id: ApiPluginId;
  name: string;
  description: string;
  services: string[];
  connectUrlEnv: string;
  icon: string;
}

export const API_PLUGIN_CATALOG: ApiPluginDefinition[] = [
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Connect Gmail, Calendar, Drive, Maps and YouTube through one Google OAuth consent flow.',
    services: ['Gmail', 'Calendar', 'Drive', 'Maps', 'YouTube'],
    connectUrlEnv: 'VITE_PLUGIN_GOOGLE_CONNECT_URL',
    icon: 'google',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Connect Spotify for playback control and library actions.',
    services: ['Playback', 'Search', 'Playlists'],
    connectUrlEnv: 'VITE_PLUGIN_SPOTIFY_CONNECT_URL',
    icon: 'spotify',
  },
];

export function getApiPluginConnectUrl(id: ApiPluginId): string | null {
  const plugin = API_PLUGIN_CATALOG.find((item) => item.id === id);
  if (!plugin) return null;
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const configured = env[plugin.connectUrlEnv]?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** Open only a deployer-configured HTTPS OAuth entry point. */
export function beginApiPluginConnection(id: ApiPluginId): boolean {
  const url = getApiPluginConnectUrl(id);
  if (!url || typeof window === 'undefined') return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

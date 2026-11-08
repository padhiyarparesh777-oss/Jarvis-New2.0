import type { CapacitorConfig } from '@capacitor/cli';

const capgoAppId = process.env.CAPGO_APP_ID?.trim();

const config: CapacitorConfig = {
  appId: 'com.padhiyar.jarvis',
  appName: 'JARVIS',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      appId: capgoAppId || undefined,
      // Keep OTA safely disabled until the owner's Capgo app ID is configured in CI.
      autoUpdate: capgoAppId ? 'atBackground' : 'off',
      appReadyTimeout: 20000,
      responseTimeout: 30,
      autoDeleteFailed: true,
      autoDeletePrevious: false,
      periodCheckDelay: 0,
    },
  },
};

export default config;

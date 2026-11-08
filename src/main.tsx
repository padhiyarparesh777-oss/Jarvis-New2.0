import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import App from './App.tsx';
import './index.css';

// Must be called on every native launch, before network requests or heavy app startup.
// Capgo uses this acknowledgement to keep a newly downloaded bundle or roll it back.
if (Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady().catch((error) => {
    console.warn('[JARVIS OTA] App-ready acknowledgement failed', error);
  });
}

createRoot(document.getElementById('root')!).render(<App />);

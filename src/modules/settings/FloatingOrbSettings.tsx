import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { JarvisNativeDevice } from '../device/deviceControl';

export function FloatingOrbSettings() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const state = await JarvisNativeDevice.getFloatingOrbStatus();
      setEnabled(Boolean(state.running));
    } catch { setEnabled(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async () => {
    if (!Capacitor.isNativePlatform()) {
      setMessage('Floating orb is available in the Android APK only.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (enabled) {
        await JarvisNativeDevice.stopFloatingOrb();
        setEnabled(false);
        setMessage('Floating orb turned off.');
      } else {
        const result = await JarvisNativeDevice.startFloatingOrb();
        if (result.permissionRequired) {
          setMessage('Allow “Display over other apps” in Android Settings, then return and tap Enable again.');
        } else {
          setEnabled(Boolean(result.running));
          setMessage(result.running ? 'Floating orb is active. Drag it anywhere; tap it to open JARVIS.' : 'Android did not start the floating orb.');
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not change floating orb state.');
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[#0B0B0B] border border-sky-400/30 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-sky-300 font-semibold">Floating JARVIS Orb</div>
          <p className="text-xs text-white/60 mt-1">A movable shortcut that stays above other apps. Tap it to reopen JARVIS.</p>
          <p className="text-[11px] mt-1 text-sky-200">{enabled ? 'Orb is active' : 'Orb is off'}</p>
        </div>
        <button type="button" disabled={busy} onClick={toggle}
          className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${enabled ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-sky-300 text-slate-950'}`}>
          {busy ? 'Please wait…' : enabled ? 'Turn Off' : 'Enable Orb'}
        </button>
      </div>
      {message && <p className="text-xs text-white/70 leading-relaxed">{message}</p>}
    </div>
  );
}

import React, { useState } from 'react';
import {
  Activity, Bell, Bluetooth, ChevronRight, CircleHelp, Headphones,
  Music2, RefreshCw, ShieldCheck, Smartphone, Volume2, Wifi, Zap
} from 'lucide-react';
import type { DeviceActionRequest, DeviceActionResult, PermissionStatusMap } from '../types/jarvis';
import { JarvisNativeDevice, requestMicrophonePermission, requestNotificationPermission } from './device/deviceControl';

interface DeviceControlScreenProps {
  permissions: PermissionStatusMap;
  actionLogs: DeviceActionResult[];
  onRefresh: () => void;
  onAction: (request: DeviceActionRequest) => void;
  onPermissionAction?: (key: keyof PermissionStatusMap) => void;
}

const permissionRows: Array<{ key: keyof PermissionStatusMap; label: string; hint: string }> = [
  { key: 'microphone', label: 'Microphone', hint: 'Voice commands and speech input' },
  { key: 'notifications', label: 'Notifications', hint: 'Read and manage notification access' },
  { key: 'accessibilityService', label: 'Accessibility service', hint: 'Screen reading, taps and gestures' },
  { key: 'notificationListener', label: 'Notification listener', hint: 'Media session and notification access' },
  { key: 'backgroundService', label: 'Background assistant', hint: 'Foreground service status' },
];

function stateLabel(value: unknown): string {
  if (value === 'granted' || value === 'authorized' || value === 'enabled' || value === 'running' || value === 'active' || value === 'ready' || value === 'supported') return 'Ready';
  if (value === 'prompt') return 'Needs permission';
  if (value === 'unsupported') return 'Unsupported';
  return 'Not enabled';
}

export const DeviceControlScreen: React.FC<DeviceControlScreenProps> = ({
  permissions, actionLogs, onRefresh, onAction, onPermissionAction,
}) => {
  const [appName, setAppName] = useState('');
  const permissionReady = permissionRows.filter((item) => {
    const value = permissions[item.key];
    return ['granted', 'authorized', 'enabled', 'running', 'active', 'ready', 'supported'].includes(String(value));
  }).length;

  const run = (actionType: DeviceActionRequest['actionType'], extra: Partial<DeviceActionRequest> = {}) => {
    onAction({ actionType, ...extra });
  };

  const openPermission = async (key: keyof PermissionStatusMap) => {
    try {
      if (onPermissionAction) { onPermissionAction(key); return; }
      if (key === 'notificationListener') await JarvisNativeDevice.openNotificationListenerSettings();
      else if (key === 'accessibilityService') await JarvisNativeDevice.openAccessibilitySettings();
      else if (key === 'backgroundService') await JarvisNativeDevice.startBackgroundService();
      else if (key === 'microphone') await requestMicrophonePermission();
      else if (key === 'notifications') await requestNotificationPermission();
      onRefresh();
    } catch { onRefresh(); }
  };

  const uniqueLogs = actionLogs.reduce<DeviceActionResult[]>((items, log) => {
    const previous = items.find((item) => item.title === log.title && item.detail === log.detail && item.status === log.status);
    if (!previous) items.push(log);
    return items;
  }, []).slice(0, 6);

  const glass = 'rounded-2xl border border-white/10 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_12px_30px_rgba(0,0,0,.18)] backdrop-blur-2xl';
  const actionButton = 'flex min-h-[74px] flex-col items-start justify-between rounded-2xl border border-white/10 bg-white/[.045] p-3 text-left transition active:scale-[.98] hover:bg-white/[.08]';

  return (
    <section className="jarvis-feature-screen absolute inset-0 z-10 overflow-y-auto px-5 pb-40 pt-32 text-white">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-semibold tracking-[.22em] text-cyan-200/70">NATIVE DEVICE HUB</p><h2 className="mt-1 font-display text-2xl font-semibold">Device control</h2><p className="mt-1 text-xs text-slate-400">Your phone, connected to JARVIS.</p></div>
          <button type="button" onClick={onRefresh} aria-label="Refresh device status" className="rounded-xl border border-cyan-200/20 bg-cyan-200/10 p-3 text-cyan-100"><RefreshCw className="h-4 w-4"/></button>
        </div>

        <div className={glass + ' p-4'}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4 text-cyan-200"/> Device readiness</div><span className="text-xs text-cyan-100">{permissionReady}/{permissionRows.length} ready</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-400 transition-all" style={{width: (permissionReady / permissionRows.length * 100) + '%'}}/></div>
          <p className="mt-2 text-[10px] text-slate-500">Android may require you to enable special permissions in system settings.</p>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-200"/><h3 className="text-sm font-semibold">Quick controls</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => run('CHECK_DEVICE_STATUS')} className={actionButton}><Activity className="h-5 w-5 text-emerald-200"/><span className="text-xs font-medium">Device status</span></button>
            <button type="button" onClick={() => run('READ_NOTIFICATIONS')} className={actionButton}><Bell className="h-5 w-5 text-amber-200"/><span className="text-xs font-medium">Read notifications</span></button>
            <button type="button" onClick={() => run('CONTROL_MUSIC', { musicCommand: 'TOGGLE' })} className={actionButton}><Music2 className="h-5 w-5 text-violet-200"/><span className="text-xs font-medium">Play / pause music</span></button>
            <button type="button" onClick={() => run('CONTROL_MUSIC', { musicCommand: 'NEXT' })} className={actionButton}><Headphones className="h-5 w-5 text-cyan-200"/><span className="text-xs font-medium">Next track</span></button>
            <button type="button" onClick={() => run('CONTROL_MUSIC', { musicCommand: 'PREVIOUS' })} className={actionButton}><Volume2 className="h-5 w-5 text-cyan-200"/><span className="text-xs font-medium">Previous track</span></button>
            <button type="button" onClick={() => run('OPEN_SETTINGS')} className={actionButton}><ShieldCheck className="h-5 w-5 text-emerald-200"/><span className="text-xs font-medium">Android settings</span></button>
          </div>
        </div>

        <div className={glass + ' p-4'}>
          <div className="mb-3 flex items-center gap-2"><Smartphone className="h-4 w-4 text-cyan-200"/><h3 className="text-sm font-semibold">Launch an app</h3></div>
          <form onSubmit={(event) => { event.preventDefault(); if (appName.trim()) { run('OPEN_APP', { targetApp: appName.trim() }); setAppName(''); } }} className="flex gap-2">
            <input value={appName} onChange={(event) => setAppName(event.target.value)} placeholder="App name, e.g. YouTube" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-200/40"/>
            <button type="submit" disabled={!appName.trim()} className="rounded-xl bg-cyan-200 px-4 text-xs font-bold text-slate-950 disabled:opacity-40">Open</button>
          </form>
        </div>

        <div className={glass + ' p-4'}>
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-200"/><h3 className="text-sm font-semibold">Permissions & services</h3></div>
          <div className="space-y-1">
            {permissionRows.map((item) => {
              const value = permissions[item.key];
              const ready = ['granted', 'authorized', 'enabled', 'running', 'active', 'ready', 'supported'].includes(String(value));
              return <button type="button" key={item.key} onClick={() => openPermission(item.key)} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-white/[.045] active:scale-[.99]">
                <span className={'h-2 w-2 rounded-full ' + (ready ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,.7)]' : 'bg-amber-300')}/>
                <div className="min-w-0 flex-1"><p className="text-xs font-medium">{item.label}</p><p className="mt-0.5 text-[10px] text-slate-500">{item.hint}</p></div>
                <span className={'text-[10px] ' + (ready ? 'text-emerald-200' : 'text-amber-200')}>{ready ? 'Ready' : (item.key === 'notificationListener' || item.key === 'accessibilityService' ? 'Enable' : item.key === 'backgroundService' ? 'Start' : 'Allow')}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400"/>
              </button>;
            })}
          </div>
          <div className="mt-2 flex items-start gap-2 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-slate-500"><CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Special Android permissions cannot be silently enabled by an app. JARVIS will open the correct system settings when needed.</div>
        </div>

        <div className={glass + ' p-4'}>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Recent device activity</h3><span className="text-[10px] text-slate-500">{actionLogs.length} records · {uniqueLogs.length} types</span></div>
          {actionLogs.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">No device actions yet.</p> : <div className="space-y-2">{uniqueLogs.map((log) => <div key={log.id} className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium">{log.title}</p><span className="text-[9px] uppercase tracking-wider text-cyan-200">{log.status.replaceAll('_',' ')}</span></div><p className="mt-1 text-[10px] leading-relaxed text-slate-400">{log.detail}</p></div>)}</div>}
        </div>
      </div>
    </section>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Activity, Bug, CheckCircle2, CircleAlert, CloudUpload, Download, RefreshCw, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import {
  clearDiagnosticEvents,
  fetchRemoteDiagnostics,
  getDiagnosticEvents,
  getRemoteDiagnosticsConfig,
  installGlobalDiagnosticCapture,
  recordDiagnostic,
  sendRemoteDiagnostics,
  setRemoteDiagnosticsConfig,
  type DiagnosticEvent,
} from './diagnostics';

interface DeveloperModePanelProps {
  backendUrl: string;
}

type TestResult = { name: string; ok: boolean; detail: string };

export const DeveloperModePanel: React.FC<DeveloperModePanelProps> = ({ backendUrl }) => {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [remote, setRemote] = useState(getRemoteDiagnosticsConfig());
  const [running, setRunning] = useState(false);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [ota, setOta] = useState<Record<string, unknown> | null>(null);
  const [otaMessage, setOtaMessage] = useState('Updater status not checked yet.');
  const [remoteMessage, setRemoteMessage] = useState('');
  const [remoteEvents, setRemoteEvents] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    installGlobalDiagnosticCapture();
    setEvents(getDiagnosticEvents());
  }, []);

  const native = Capacitor.isNativePlatform();
  const baseUrl = backendUrl.trim().replace(/\/+$/, '');

  const refreshOta = async () => {
    setOtaMessage('Checking native updater…');
    try {
      if (!native) {
        setOta(null);
        setOtaMessage('OTA runtime checks are available inside the installed Android app.');
        return;
      }
      const [current, builtin, plugin, appId, enabled, channel] = await Promise.all([
        CapacitorUpdater.current(),
        CapacitorUpdater.getBuiltinVersion(),
        CapacitorUpdater.getPluginVersion(),
        CapacitorUpdater.getAppId(),
        CapacitorUpdater.isAutoUpdateEnabled(),
        CapacitorUpdater.getChannel(),
      ]);
      setOta({ current, builtin, plugin, appId, enabled, channel });
      setOtaMessage('Updater bridge responded successfully.');
    } catch (error) {
      setOtaMessage(error instanceof Error ? error.message : 'Updater check failed.');
      recordDiagnostic('error', 'ota.status', error);
      setEvents(getDiagnosticEvents());
    }
  };

  const runTests = async () => {
    setRunning(true);
    const results: TestResult[] = [];
    const check = async (name: string, task: () => Promise<string> | string) => {
      try { results.push({ name, ok: true, detail: await task() }); }
      catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        results.push({ name, ok: false, detail });
        recordDiagnostic('error', 'self-test.' + name, detail);
      }
    };
    await check('App runtime', () => 'React is running; platform=' + Capacitor.getPlatform());
    await check('Local storage', () => {
      const key = '__jarvis_test__';
      localStorage.setItem(key, 'ok');
      const value = localStorage.getItem(key);
      localStorage.removeItem(key);
      if (value !== 'ok') throw new Error('Local storage read/write failed');
      return 'Read/write passed';
    });
    await check('Backend health', async () => {
      if (!baseUrl) throw new Error('Backend URL is empty');
      const response = await fetch(baseUrl + '/api/ai/status', { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Backend HTTP ' + response.status);
      const data = await response.json() as { provider?: string };
      return 'HTTP ' + response.status + (data.provider ? ' · ' + data.provider : '');
    });
    await check('OTA updater bridge', async () => {
      if (!native) return 'Skipped in browser preview';
      const version = await CapacitorUpdater.getPluginVersion();
      return 'Capgo plugin ' + String(version);
    });
    await check('Diagnostic capture', () => {
      const count = getDiagnosticEvents().length;
      return count + ' local events available';
    });
    setTests(results);
    setEvents(getDiagnosticEvents());
    setRunning(false);
  };

  const saveRemote = (next: typeof remote) => {
    setRemote(next);
    setRemoteDiagnosticsConfig(next);
  };

  const loadRemoteDiagnostics = async () => {
    setRemoteMessage('Loading remote diagnostics…');
    try {
      const result = await fetchRemoteDiagnostics(baseUrl);
      setRemoteEvents(result);
      setRemoteMessage('Loaded ' + result.length + ' remote events.');
    } catch (error) {
      setRemoteMessage(error instanceof Error ? error.message : 'Unable to load remote reports.');
    }
  };

  const uploadDiagnostics = async () => {
    setRemoteMessage('Sending diagnostics securely…');
    try {
      const result = await sendRemoteDiagnostics(baseUrl);
      setRemoteMessage(result.status);
    } catch (error) {
      setRemoteMessage(error instanceof Error ? error.message : 'Remote report failed.');
    }
  };

  const glass = 'rounded-2xl border border-white/10 bg-white/[.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.06),0_12px_30px_rgba(0,0,0,.18)]';
  const statusRows = useMemo(() => [
    { label: 'Native Android runtime', ok: native, detail: native ? 'Native bridge active' : 'Browser / preview mode' },
    { label: 'Backend endpoint', ok: /^https:\/\//i.test(baseUrl), detail: baseUrl || 'Not configured' },
    { label: 'Remote diagnostics', ok: remote.enabled && Boolean(remote.token), detail: remote.enabled ? 'Opt-in enabled' : 'Disabled by default' },
  ], [native, baseUrl, remote.enabled, remote.token]);

  return (
    <div className="space-y-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-semibold tracking-[.22em] text-cyan-200/70">ENGINEERING CONSOLE</p><h3 className="mt-1 text-xl font-semibold">Developer Mode</h3><p className="mt-1 text-xs text-slate-400">Live update status, self-tests and privacy-first diagnostics.</p></div>
        <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-[10px] text-cyan-100">Local-first</span>
      </div>

      <section className={glass + ' space-y-3'}>
        <div className="flex items-center gap-2"><Download className="h-4 w-4 text-cyan-200"/><h4 className="text-sm font-semibold">Capgo Live Updates</h4></div>
        <p className="text-xs leading-relaxed text-slate-400">UI, JavaScript and CSS bundles can update without reinstalling. Native Android code and permission changes still require a new APK.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refreshOta} className="rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs text-cyan-100"><RefreshCw className="mr-1 inline h-3.5 w-3.5"/> Check updater</button>
        </div>
        <p className="text-xs text-slate-300">{otaMessage}</p>
        {ota && <pre className="max-h-40 overflow-auto rounded-xl bg-black/30 p-3 text-[10px] leading-relaxed text-cyan-100">{JSON.stringify(ota, null, 2)}</pre>}
        <p className="text-[10px] leading-relaxed text-amber-200/80">OTA publishing stays safely disabled until CAPGO_APP_ID and CAPGO_API_KEY are configured as GitHub Actions secrets and a Capgo app/channel is created.</p>
      </section>

      <section className={glass + ' space-y-3'}>
        <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-200"/><h4 className="text-sm font-semibold">Automatic self-tests</h4></div>
        <button type="button" disabled={running} onClick={runTests} className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-blue-400 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">{running ? 'Running tests…' : 'Run JARVIS self-test'}</button>
        {tests.map((test) => <div key={test.name} className="flex items-start gap-2 rounded-xl bg-black/20 p-2.5">
          {test.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"/> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>}
          <div className="min-w-0"><p className="text-xs font-medium">{test.name}</p><p className="mt-0.5 break-words text-[10px] text-slate-400">{test.detail}</p></div>
        </div>)}
      </section>

      <section className={glass + ' space-y-3'}>
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-200"/><h4 className="text-sm font-semibold">Secure remote diagnostics</h4></div>
        <p className="text-[11px] leading-relaxed text-slate-400">Sharing is off by default. Only sanitized error summaries and technical status are sent over HTTPS. Chat messages, contacts, screenshots, microphone audio and files are never included.</p>
        <label className="flex items-center justify-between gap-3 text-xs"><span>Allow remote diagnostic reports</span><input type="checkbox" checked={remote.enabled} onChange={(e) => saveRemote({ ...remote, enabled: e.target.checked })} className="h-4 w-4 accent-cyan-300"/></label>
        <input type="password" value={remote.token} onChange={(e) => saveRemote({ ...remote, token: e.target.value })} placeholder="Backend diagnostics access token" autoComplete="off" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white placeholder:text-slate-500"/>
        <button type="button" disabled={!remote.enabled || !remote.token.trim()} onClick={uploadDiagnostics} className="w-full rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-3 text-xs font-semibold text-cyan-100 disabled:opacity-40"><CloudUpload className="mr-1 inline h-4 w-4"/> Send error report</button>
        <button type="button" disabled={!remote.enabled || !remote.token.trim()} onClick={loadRemoteDiagnostics} className="w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-xs text-slate-200 disabled:opacity-40">View remote reports</button>
        {remoteEvents.slice(0,10).map((event, index) => <div key={String(event.receivedAt || index)} className="rounded-xl border border-white/[.07] bg-black/20 p-3"><p className="text-[10px] uppercase text-cyan-200">{String(event.level || 'event')} · {String(event.source || 'remote')}</p><p className="mt-1 break-words text-xs text-slate-300">{String(event.message || '')}</p><p className="mt-1 text-[9px] text-slate-500">{String(event.receivedAt || '')}</p></div>)}
        {remoteMessage && <p className="text-xs text-slate-300">{remoteMessage}</p>}
      </section>

      <section className={glass + ' space-y-3'}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bug className="h-4 w-4 text-cyan-200"/><h4 className="text-sm font-semibold">Local error log</h4></div><span className="text-[10px] text-slate-500">{events.length} events</span></div>
        {events.length === 0 ? <p className="text-xs text-slate-500">No captured errors yet. Run self-test to verify core services.</p> : <div className="max-h-64 space-y-2 overflow-y-auto">{events.slice(0,20).map((event) => <div key={event.id} className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wider text-cyan-200">{event.level} · {event.source}</span><span className="text-[9px] text-slate-500">{new Date(event.at).toLocaleString()}</span></div><p className="mt-1 break-words text-xs text-slate-300">{event.message}</p></div>)}</div>}
        <button type="button" onClick={() => { clearDiagnosticEvents(); setEvents([]); }} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-400">Clear local logs</button>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-relaxed text-slate-500"><Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0"/> This console can inspect plugin and backend responses, but it cannot remotely tap or view the phone screen. OTA changes are JavaScript-only.</div>
    </div>
  );
};

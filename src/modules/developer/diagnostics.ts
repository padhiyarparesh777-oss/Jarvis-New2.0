export type DiagnosticLevel = 'info' | 'warning' | 'error';

export interface DiagnosticEvent {
  id: string;
  at: string;
  level: DiagnosticLevel;
  source: string;
  message: string;
}

const STORAGE_KEY = 'jarvis.developer.diagnostics.v1';
const CONFIG_KEY = 'jarvis.developer.remoteDiagnostics.v1';
const MAX_EVENTS = 80;

function safeMessage(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? 'Unknown error');
  return raw
    .replace(/https?:\/\/[^\s)]+/gi, '[url]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .slice(0, 500);
}

function readEvents(): DiagnosticEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : [];
  } catch { return []; }
}

export function getDiagnosticEvents(): DiagnosticEvent[] {
  return readEvents();
}

export function recordDiagnostic(level: DiagnosticLevel, source: string, message: unknown): DiagnosticEvent {
  const event: DiagnosticEvent = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    at: new Date().toISOString(),
    level,
    source: safeMessage(source).slice(0, 60),
    message: safeMessage(message),
  };
  try {
    const next = [event, ...readEvents()].slice(0, MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* Diagnostics must never break the app when storage is unavailable. */ }
  return event;
}

export function clearDiagnosticEvents(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function getRemoteDiagnosticsConfig(): { enabled: boolean; token: string } {
  try {
    const value = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return { enabled: value.enabled === true, token: typeof value.token === 'string' ? value.token : '' };
  } catch { return { enabled: false, token: '' }; }
}

export function setRemoteDiagnosticsConfig(config: { enabled: boolean; token: string }): void {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* ignore */ }
}

let installed = false;
export function installGlobalDiagnosticCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    recordDiagnostic('error', 'window.error', event.error || event.message || 'Unhandled window error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    recordDiagnostic('error', 'unhandledrejection', event.reason);
  });
}

export async function sendRemoteDiagnostics(baseUrl: string): Promise<{ sent: number; status: string }> {
  const config = getRemoteDiagnosticsConfig();
  if (!config.enabled) throw new Error('Remote diagnostics sharing is disabled.');
  if (!config.token.trim()) throw new Error('Enter the diagnostics access token first.');
  if (!/^https:\/\//i.test(baseUrl)) throw new Error('Remote diagnostics require an HTTPS backend URL.');
  const events = readEvents().slice(0, 30);
  if (events.length === 0) return { sent: 0, status: 'No local events to send.' };
  const installationId = (() => {
    const key = 'jarvis.diagnostics.installation';
    let id = localStorage.getItem(key);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
      localStorage.setItem(key, id);
    }
    return id;
  })();
  const response = await fetch(baseUrl.replace(/\/+$/, '') + '/api/diagnostics/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token },
    body: JSON.stringify({
      installationId,
      platform: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'unknown',
      events,
    }),
  });
  if (!response.ok) throw new Error(response.status === 503 ? 'Remote diagnostics are not configured on the backend.' : 'Remote diagnostics rejected the request (HTTP ' + response.status + ').');
  const result = await response.json() as { accepted?: number };
  return { sent: Number(result.accepted || 0), status: 'Securely sent ' + Number(result.accepted || 0) + ' events.' };
}

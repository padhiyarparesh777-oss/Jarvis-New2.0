import type { AutomationRoutine, JarvisSettings } from '../../types/jarvis';

export type AutomationTrigger =
  | { type: 'manual' }
  | { type: 'daily_time'; time: string }
  | { type: 'charging' }
  | { type: 'battery_below'; percent: number }
  | { type: 'battery_above'; percent: number };

export type AutomationAction =
  | { type: 'notify'; title: string; message: string }
  | { type: 'start_timer'; seconds: number; label: string }
  | { type: 'open_app'; app: string }
  | { type: 'set_response_style'; style: JarvisSettings['aiBrain']['responseStyle'] };

export interface AutomationRoutineDefinition extends AutomationRoutine {
  trigger?: AutomationTrigger;
  actions?: AutomationAction[];
}

export interface AutomationDeviceState {
  batteryLevel: number;
  isCharging: boolean;
}

export interface AutomationActionHandlers {
  notify: (title: string, message: string) => Promise<void> | void;
  startTimer: (seconds: number, label: string) => void;
  openApp: (app: string) => Promise<void> | void;
  setResponseStyle: (style: JarvisSettings['aiBrain']['responseStyle']) => void;
}

const lastFired = new Map<string, string>();

export function shouldRunForEvent(
  routine: AutomationRoutineDefinition,
  event: 'manual' | 'poll',
  state?: AutomationDeviceState,
  now = new Date()
): boolean {
  if (!routine.enabled || !routine.trigger) return false;
  const trigger = routine.trigger;
  if (event === 'manual') return trigger.type === 'manual';
  if (!state) return false;

  const dateKey = now.toISOString().slice(0, 10);
  if (trigger.type === 'daily_time') {
    const minuteKey = `${dateKey}T${trigger.time}`;
    return now.getHours() === Number(trigger.time.slice(0, 2)) &&
      now.getMinutes() === Number(trigger.time.slice(3, 5)) &&
      lastFired.get(routine.id) !== minuteKey;
  }
  if (trigger.type === 'charging') return state.isCharging && !lastFired.get(routine.id)?.startsWith(dateKey);
  if (trigger.type === 'battery_below') return state.batteryLevel < trigger.percent && lastFired.get(routine.id) !== dateKey;
  if (trigger.type === 'battery_above') return state.batteryLevel > trigger.percent && lastFired.get(routine.id) !== dateKey;
  return false;
}

export async function executeAutomationActions(
  routine: AutomationRoutineDefinition,
  handlers: AutomationActionHandlers
): Promise<string[]> {
  const results: string[] = [];
  for (const action of routine.actions || []) {
    switch (action.type) {
      case 'notify':
        await handlers.notify(action.title, action.message);
        results.push('Notification sent');
        break;
      case 'start_timer':
        if (Number.isFinite(action.seconds) && action.seconds >= 5 && action.seconds <= 86400) {
          handlers.startTimer(action.seconds, action.label);
          results.push(`Timer started: ${action.label}`);
        } else {
          throw new Error('Timer duration must be between 5 seconds and 24 hours.');
        }
        break;
      case 'open_app':
        if (!action.app.trim()) throw new Error('App name is required.');
        await handlers.openApp(action.app);
        results.push(`Opened ${action.app}`);
        break;
      case 'set_response_style':
        handlers.setResponseStyle(action.style);
        results.push(`Response style changed to ${action.style}`);
        break;
    }
  }
  return results;
}

export function markAutomationFired(routineId: string, now = new Date()): void {
  lastFired.set(routineId, now.toISOString().slice(0, 10) + 'T' + now.toTimeString().slice(0, 5));
}

export function resetAutomationRuntimeState(): void {
  lastFired.clear();
}

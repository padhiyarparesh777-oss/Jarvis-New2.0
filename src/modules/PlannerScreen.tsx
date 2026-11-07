import React, { useState } from 'react';
import { CalendarDays, Check, Clock3, Plus, Play, Trash2, Zap, ListTodo, BellRing } from 'lucide-react';
import { ActiveTimerOrAlarm, AutomationLog, AutomationRoutine, PlannerTask } from '../types/jarvis';

interface PlannerScreenProps {
  tasks: PlannerTask[];
  routines: AutomationRoutine[];
  logs: AutomationLog[];
  timers: ActiveTimerOrAlarm[];
  onAddTask: (title: string, dueTime: string, category: PlannerTask['category']) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onRunRoutine: (routine: AutomationRoutine) => void;
}

const panel = 'rounded-2xl border border-white/80 bg-white/75 shadow-[0_8px_28px_rgba(45,61,110,0.08)] backdrop-blur-xl';

export const PlannerScreen: React.FC<PlannerScreenProps> = ({
  tasks, routines, logs, timers, onAddTask, onToggleTask, onDeleteTask, onRunRoutine,
}) => {
  const [title, setTitle] = useState('');
  const [dueTime, setDueTime] = useState('Today');
  const pending = tasks.filter((task) => !task.completed);
  const completed = tasks.filter((task) => task.completed);

  const addTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAddTask(title.trim(), dueTime, 'task');
    setTitle('');
  };

  return (
    <section className="fixed inset-x-0 top-[76px] bottom-[100px] z-35 mx-auto flex w-full max-w-3xl flex-col gap-3 overflow-y-auto px-4 pb-3" aria-label="Smart Planner">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6578F7]">JARVIS ORGANIZER</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Smart Planner</h2>
          <p className="mt-1 text-xs text-slate-500">Your tasks, reminders and routines in one place.</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6578F7]/10 text-[#5267EE]">
          <CalendarDays className="h-5 w-5" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className={panel + ' p-3'}><p className="text-[10px] text-slate-500">Pending</p><p className="mt-1 text-xl font-bold text-slate-900">{pending.length}</p></div>
        <div className={panel + ' p-3'}><p className="text-[10px] text-slate-500">Completed</p><p className="mt-1 text-xl font-bold text-emerald-600">{completed.length}</p></div>
        <div className={panel + ' p-3'}><p className="text-[10px] text-slate-500">Active timers</p><p className="mt-1 text-xl font-bold text-[#5267EE]">{timers.filter((timer) => !timer.triggered).length}</p></div>
      </div>

      <form onSubmit={addTask} className={panel + ' flex flex-col gap-2 p-3'}>
        <label className="text-xs font-semibold text-slate-700" htmlFor="planner-task">Add a task or reminder</label>
        <div className="flex gap-2">
          <input id="planner-task" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should I remind you?" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#6578F7]" />
          <button type="submit" disabled={!title.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6578F7] text-white disabled:opacity-40" aria-label="Add task"><Plus className="h-5 w-5" /></button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><Clock3 className="h-3.5 w-3.5" /><span>Due</span><select value={dueTime} onChange={(event) => setDueTime(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"><option>Today</option><option>Tomorrow</option><option>This week</option><option>Whenever</option></select></div>
      </form>

      <div className={panel + ' p-3'}>
        <div className="mb-3 flex items-center gap-2"><ListTodo className="h-4 w-4 text-[#5267EE]" /><h3 className="text-sm font-bold text-slate-800">Tasks & reminders</h3><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{tasks.length}</span></div>
        {tasks.length === 0 ? <p className="py-5 text-center text-xs text-slate-400">Nothing planned yet. Add your first task above.</p> : <div className="space-y-2">
          {[...pending, ...completed].map((task) => <div key={task.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 px-3 py-2.5">
            <button type="button" onClick={() => onToggleTask(task.id)} aria-label={task.completed ? 'Mark task pending' : 'Complete task'} className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ' + (task.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent')}><Check className="h-3.5 w-3.5" /></button>
            <div className="min-w-0 flex-1"><p className={'truncate text-xs font-semibold ' + (task.completed ? 'text-slate-400 line-through' : 'text-slate-800')}>{task.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{task.dueTime || 'No due date'} · {task.category}</p></div>
            <button type="button" onClick={() => onDeleteTask(task.id)} aria-label="Delete task" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>)}
        </div>}
      </div>

      <div className={panel + ' p-3'}>
        <div className="mb-3 flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-bold text-slate-800">Automation routines</h3></div>
        {routines.length === 0 ? <p className="text-xs text-slate-400">No routines configured.</p> : <div className="space-y-2">
          {routines.map((routine) => <div key={routine.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white/80 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Zap className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{routine.name}</p><p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">{routine.description}</p></div>
            <button type="button" onClick={() => onRunRoutine(routine)} disabled={!routine.enabled} className="flex items-center gap-1 rounded-lg bg-[#6578F7]/10 px-3 py-2 text-[10px] font-bold text-[#5267EE] disabled:opacity-40"><Play className="h-3 w-3" /> Run</button>
          </div>)}
        </div>}
      </div>

      {timers.some((timer) => !timer.triggered) && <div className={panel + ' p-3'}>
        <div className="mb-2 flex items-center gap-2"><BellRing className="h-4 w-4 text-[#5267EE]" /><h3 className="text-sm font-bold text-slate-800">Active timers</h3></div>
        {timers.filter((timer) => !timer.triggered).map((timer) => <div key={timer.id} className="flex justify-between border-t border-slate-100 py-2 text-xs"><span className="text-slate-700">{timer.label}</span><span className="font-mono font-semibold text-[#5267EE]">{Math.floor(timer.remainingSeconds / 60)}:{String(timer.remainingSeconds % 60).padStart(2, '0')}</span></div>)}
      </div>}

      {logs.length > 0 && <div className={panel + ' p-3'}><h3 className="mb-2 text-sm font-bold text-slate-800">Recent activity</h3>{logs.slice(0, 4).map((log) => <div key={log.id} className="border-t border-slate-100 py-2"><p className="text-xs font-semibold text-slate-700">{log.routineName}</p><p className="text-[10px] text-slate-500">{log.detail}</p></div>)}</div>}
    </section>
  );
};

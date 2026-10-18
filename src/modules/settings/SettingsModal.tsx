import React, { useState } from 'react';
import {
  X,
  Cpu,
  Volume2,
  Smartphone,
  Eye,
  MessageSquare,
  Database,
  CalendarCheck,
  Bell,
  Sparkles,
  Shield,
  Info,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
  Play,
  Copy,
  ExternalLink,
  Camera,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import {
  ActiveTimerOrAlarm,
  AnimationQuality,
  AutomationLog,
  AutomationRoutine,
  BackendStatus,
  ChatThread,
  DeviceActionRequest,
  DeviceActionResult,
  GeminiVoiceName,
  JarvisSettings,
  LanguageMode,
  MemoryFact,
  PermissionStatusMap,
  PersonalityMode,
  PlannerTask,
  ResponseStyle,
} from '../../types/jarvis';
import {
  NATIVE_KOTLIN_BLUEPRINT,
  requestCameraPermission,
  requestMicrophonePermission,
  requestNotificationPermission,
} from '../device/deviceControl';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: JarvisSettings;
  onUpdateSettings: (next: JarvisSettings) => void;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onClearAllThreads: () => void;
  memories: MemoryFact[];
  onAddMemory: (fact: string, category: MemoryFact['category']) => void;
  onToggleMemory: (id: string) => void;
  onDeleteMemory: (id: string) => void;
  plannerTasks: PlannerTask[];
  onAddPlannerTask: (title: string, dueTime: string, category: PlannerTask['category']) => void;
  onTogglePlannerTask: (id: string) => void;
  onDeletePlannerTask: (id: string) => void;
  routines: AutomationRoutine[];
  automationLogs: AutomationLog[];
  onRunRoutine: (routine: AutomationRoutine) => void;
  onToggleRoutine: (id: string) => void;
  permissions: PermissionStatusMap;
  onRefreshPermissions: () => void;
  actionLogs: DeviceActionResult[];
  activeTimers: ActiveTimerOrAlarm[];
  onTriggerDeviceAction: (req: DeviceActionRequest) => void;
  onAnalyzeScreen: (imageBase64: string, mimeType: string, prompt: string) => Promise<string>;
  backendStatus: BackendStatus | null;
  onRefreshBackend: () => void;
  onWipeAll: () => void;
  storageStats: { bytesUsed: number; itemCount: number };
  renderTelemetry: { fps: number; nodes: number; filaments: number };
}

type SettingsTab =
  | 'brain'
  | 'voice'
  | 'phone'
  | 'vision'
  | 'chat'
  | 'memory'
  | 'planner'
  | 'appearance'
  | 'notifications'
  | 'privacy'
  | 'about';

const TABS: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'brain', label: 'AI Brain', icon: Cpu },
  { id: 'voice', label: 'Voice & Speech', icon: Volume2 },
  { id: 'phone', label: 'Phone Control', icon: Smartphone },
  { id: 'vision', label: 'Screen Vision', icon: Eye },
  { id: 'chat', label: 'Chat & Files', icon: MessageSquare },
  { id: 'memory', label: 'Memory', icon: Database },
  { id: 'planner', label: 'Planner & Routines', icon: CalendarCheck },
  { id: 'appearance', label: 'Appearance & Orb', icon: Sparkles },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
  { id: 'about', label: 'About JARVIS AI', icon: Info },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onDeleteThread,
  onClearAllThreads,
  memories,
  onAddMemory,
  onToggleMemory,
  onDeleteMemory,
  plannerTasks,
  onAddPlannerTask,
  onTogglePlannerTask,
  onDeletePlannerTask,
  routines,
  automationLogs,
  onRunRoutine,
  onToggleRoutine,
  permissions,
  onRefreshPermissions,
  actionLogs,
  activeTimers,
  onTriggerDeviceAction,
  onAnalyzeScreen,
  backendStatus,
  onRefreshBackend,
  onWipeAll,
  storageStats,
  renderTelemetry,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('brain');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryFact['category']>('preference');

  // Planner inputs
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<PlannerTask['category']>('task');

  // Phone Control test inputs
  const [testAppName, setTestAppName] = useState('YouTube');
  const [testAlarmTime, setTestAlarmTime] = useState('07:00');
  const [testTimerSec, setTestTimerSec] = useState('60');
  const [testContactPhone, setTestContactPhone] = useState('+919876543210');
  const [testMessageBody, setTestMessageBody] = useState('Checking in via JARVIS AI.');

  // Screen Vision state
  const [screenPreviewUrl, setScreenPreviewUrl] = useState<string | null>(null);
  const [screenBase64, setScreenBase64] = useState<string>('');
  const [screenMimeType, setScreenMimeType] = useState<string>('image/png');
  const [screenPrompt, setScreenPrompt] = useState<string>('');
  const [screenAnalysisResult, setScreenAnalysisResult] = useState<string>('');
  const [isAnalyzingScreen, setIsAnalyzingScreen] = useState<boolean>(false);

  // Thread rename state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string>('');

  const [showKotlinCode, setShowKotlinCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  if (!isOpen) return null;

  const updateBrain = (patch: Partial<JarvisSettings['aiBrain']>) => {
    onUpdateSettings({
      ...settings,
      aiBrain: { ...settings.aiBrain, ...patch },
    });
  };

  const updateVoice = (patch: Partial<JarvisSettings['voiceSpeech']>) => {
    onUpdateSettings({
      ...settings,
      voiceSpeech: { ...settings.voiceSpeech, ...patch },
    });
  };

  const updatePhone = (patch: Partial<JarvisSettings['phoneControl']>) => {
    onUpdateSettings({
      ...settings,
      phoneControl: { ...settings.phoneControl, ...patch },
    });
  };

  const updateVision = (patch: Partial<JarvisSettings['screenVision']>) => {
    onUpdateSettings({
      ...settings,
      screenVision: { ...settings.screenVision, ...patch },
    });
  };

  const updateChat = (patch: Partial<JarvisSettings['chatInterface']>) => {
    onUpdateSettings({
      ...settings,
      chatInterface: { ...settings.chatInterface, ...patch },
    });
  };

  const updateMemory = (patch: Partial<JarvisSettings['memory']>) => {
    onUpdateSettings({
      ...settings,
      memory: { ...settings.memory, ...patch },
    });
  };

  const updateAppearance = (patch: Partial<JarvisSettings['appearance']>) => {
    onUpdateSettings({
      ...settings,
      appearance: { ...settings.appearance, ...patch },
    });
  };

  const updateNotifications = (patch: Partial<JarvisSettings['notifications']>) => {
    onUpdateSettings({
      ...settings,
      notifications: { ...settings.notifications, ...patch },
    });
  };

  const updatePrivacy = (patch: Partial<JarvisSettings['privacy']>) => {
    onUpdateSettings({
      ...settings,
      privacy: { ...settings.privacy, ...patch },
    });
  };

  const handleCaptureLiveScreen = async () => {
    setScreenAnalysisResult('');
    try {
      if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          const b64 = dataUrl.split(',')[1] || '';
          setScreenPreviewUrl(dataUrl);
          setScreenBase64(b64);
          setScreenMimeType('image/png');

          if (settings.screenVision.autoAnalyzeOnCapture && b64) {
            setIsAnalyzingScreen(true);
            try {
              const res = await onAnalyzeScreen(b64, 'image/png', screenPrompt);
              setScreenAnalysisResult(res);
            } catch (err) {
              setScreenAnalysisResult(
                err instanceof Error ? err.message : 'Screen analysis failed.'
              );
            } finally {
              setIsAnalyzingScreen(false);
            }
          }
        }
        stream.getTracks().forEach((t) => t.stop());
      } else {
        setScreenAnalysisResult(
          'Live display capture requires Android MediaProjection or a desktop browser. Use "Upload Screenshot" below to analyze any screen image.'
        );
      }
    } catch {
      setScreenAnalysisResult('Screen capture was cancelled or denied by the user.');
    }
  };

  const handleUploadScreenshotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const mime = file.type || 'image/png';
      setScreenPreviewUrl(dataUrl);
      setScreenBase64(b64);
      setScreenMimeType(mime);
      setScreenAnalysisResult('');

      if (settings.screenVision.autoAnalyzeOnCapture && b64) {
        setIsAnalyzingScreen(true);
        try {
          const res = await onAnalyzeScreen(b64, mime, screenPrompt);
          setScreenAnalysisResult(res);
        } catch (err) {
          setScreenAnalysisResult(
            err instanceof Error ? err.message : 'Screen analysis failed.'
          );
        } finally {
          setIsAnalyzingScreen(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRunScreenAnalysis = async () => {
    if (!screenBase64) return;
    setIsAnalyzingScreen(true);
    try {
      const res = await onAnalyzeScreen(screenBase64, screenMimeType, screenPrompt);
      setScreenAnalysisResult(res);
    } catch (err) {
      setScreenAnalysisResult(err instanceof Error ? err.message : 'Screen analysis failed.');
    } finally {
      setIsAnalyzingScreen(false);
    }
  };

  const handleCopyKotlin = () => {
    navigator.clipboard?.writeText(NATIVE_KOTLIN_BLUEPRINT);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="JARVIS AI Settings"
    >
      <div className="relative w-full max-w-2xl h-full bg-[#050505] border-l border-[#FFC928]/25 flex flex-col text-white overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FFC928]/15 bg-[#080808]">
          <div>
            <h2 className="font-display text-sm tracking-[0.22em] text-[#FFC928] uppercase">
              System Configuration
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              JARVIS AI · Architecture, Permissions & Neural Core Controls
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white/70 hover:text-[#FFC928] hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Horizontal Scrollable Category Navigation */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[#FFC928]/15 bg-[#070707] overflow-x-auto shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#FFC928] text-black font-semibold'
                    : 'text-white/65 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. AI BRAIN */}
          {activeTab === 'brain' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                    AI Core Status
                  </div>
                  <div className="text-sm font-semibold mt-0.5 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        backendStatus?.configured ? 'bg-[#FFC928]' : 'bg-red-500'
                      }`}
                    />
                    <span>
                      {settings.aiBrain.provider === 'free-unlimited'
                        ? 'Free Unlimited AI Engine Active'
                        : settings.aiBrain.provider === 'auto-hybrid'
                        ? 'Auto-Hybrid (Gemini + Free Unlimited Fallback)'
                        : 'Google Gemini API Connected'}
                    </span>
                  </div>
                  <div className="text-xs text-white/55 mt-1">
                    {backendStatus?.message || 'Checking server-side AI bridge...'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRefreshBackend}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-[#FFC928]/35 text-xs text-[#FFC928] hover:bg-[#FFC928]/10 inline-flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Verify</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-3">
                <label className="block text-xs text-[#C5A059]">
                  AI Provider Engine (Zero Rate-Limit Protection)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      {
                        id: 'auto-hybrid',
                        title: 'Auto-Hybrid (Gemini + Free Unlimited Fallback) — Recommended',
                        desc: 'Uses Google Gemini first; if API quota/rate limit is hit, automatically switches to the Free Unlimited AI engine with zero interruption.',
                      },
                      {
                        id: 'free-unlimited',
                        title: '100% Free Unlimited AI Mode (No Quota / No API Key Needed)',
                        desc: 'Directly uses the free cloud AI engine + local Android intent parser. Never hits Gemini API rate limits.',
                      },
                      {
                        id: 'gemini',
                        title: 'Google Gemini Strict Mode',
                        desc: 'Uses only your configured GEMINI_API_KEY without fallback.',
                      },
                    ] as {
                      id: JarvisSettings['aiBrain']['provider'];
                      title: string;
                      desc: string;
                    }[]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateBrain({ provider: mode.id })}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        settings.aiBrain.provider === mode.id
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-white'
                          : 'bg-black border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#FFC928]">{mode.title}</div>
                      <div className="text-[11px] text-white/60 mt-0.5">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <label className="block text-xs text-[#C5A059]">Primary AI Model</label>
                  <select
                    value={settings.aiBrain.model}
                    onChange={(e) =>
                      updateBrain({
                        model: e.target.value as JarvisSettings['aiBrain']['model'],
                      })
                    }
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="gemini-3.8-flash">
                      gemini-3.8-flash (High-Intelligence Multimodal)
                    </option>
                    <option value="gemini-3.1-flash-lite">
                      gemini-3.1-flash-lite (Ultra-Fast Low Latency)
                    </option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <label className="block text-xs text-[#C5A059]">Automatic Fallback Model</label>
                  <select
                    value={settings.aiBrain.fallbackModel}
                    onChange={(e) =>
                      updateBrain({
                        fallbackModel: e.target.value as JarvisSettings['aiBrain']['fallbackModel'],
                      })
                    }
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <label className="block text-xs text-[#C5A059]">Assistant Personality</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'executive', label: 'Executive' },
                      { id: 'tactical', label: 'Tactical' },
                      { id: 'companion', label: 'Companion' },
                      { id: 'scholar', label: 'Scholar' },
                    ] as { id: PersonalityMode; label: string }[]
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => updateBrain({ personality: p.id })}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        settings.aiBrain.personality === p.id
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                          : 'bg-black border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <label className="block text-xs text-[#C5A059]">Response Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'concise', label: 'Concise' },
                      { id: 'natural', label: 'Natural' },
                      { id: 'analytical', label: 'Analytical' },
                    ] as { id: ResponseStyle; label: string }[]
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateBrain({ responseStyle: s.id })}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        settings.aiBrain.responseStyle === s.id
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                          : 'bg-black border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#C5A059]">Reasoning Depth (Thinking)</span>
                    <span className="text-[#FFC928] font-mono-tabular">
                      {settings.aiBrain.thinkingLevel}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => updateBrain({ thinkingLevel: lvl })}
                        className={`py-2 rounded-lg text-xs border ${
                          settings.aiBrain.thinkingLevel === lvl
                            ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                            : 'bg-black border-white/10 text-white/60'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#C5A059]">Creativity (Temperature)</span>
                    <span className="text-[#FFC928] font-mono-tabular">
                      {settings.aiBrain.temperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.2"
                    step="0.1"
                    value={settings.aiBrain.temperature}
                    onChange={(e) => updateBrain({ temperature: parseFloat(e.target.value) })}
                    className="w-full accent-[#FFC928]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Live Google Search Grounding
                    </div>
                    <div className="text-[11px] text-white/50">
                      Ground answers in real-time web information with verified source links
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.aiBrain.webSearchGrounding}
                    onChange={(e) => updateBrain({ webSearchGrounding: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Real-Time Token Streaming</div>
                    <div className="text-[11px] text-white/50">
                      Stream AI responses progressively as they are generated
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.aiBrain.streamingEnabled}
                    onChange={(e) => updateBrain({ streamingEnabled: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 2. VOICE & SPEECH */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <label className="block text-xs text-[#C5A059]">
                  Multilingual Speech & Conversation Language
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'auto', label: 'Auto-Detect (EN / HI / Hinglish / GU)' },
                      { id: 'en', label: 'English (India / US)' },
                      { id: 'hi', label: 'Hindi (हिन्दी)' },
                      { id: 'hinglish', label: 'Hinglish (Conversational Blend)' },
                      { id: 'gu', label: 'Gujarati (ગુજરાતી)' },
                    ] as { id: LanguageMode; label: string }[]
                  ).map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => updateVoice({ language: lang.id })}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border text-left transition-colors ${
                        settings.voiceSpeech.language === lang.id
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                          : 'bg-black border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <label className="block text-xs text-[#C5A059]">Voice Synthesis Engine</label>
                  <select
                    value={settings.voiceSpeech.voiceEngine}
                    onChange={(e) =>
                      updateVoice({
                        voiceEngine: e.target.value as JarvisSettings['voiceSpeech']['voiceEngine'],
                      })
                    }
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="gemini-tts">
                      Free Male Neural Voice Engine (Zero Quota Limits)
                    </option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <label className="block text-xs text-[#C5A059]">Male Neural Voice</label>
                  <select
                    value={settings.voiceSpeech.geminiVoice}
                    onChange={(e) =>
                      updateVoice({ geminiVoice: e.target.value as GeminiVoiceName })
                    }
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="Charon">
                      Charon — Indian / Hinglish & Hindi Male Neural (Prabhat / Madhur)
                    </option>
                    <option value="Fenrir">
                      Fenrir — Deep British JARVIS Male Neural (Ryan / Brian)
                    </option>
                    <option value="Puck">
                      Puck — Deep American Male Neural (Christopher)
                    </option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#C5A059]">Speech Playback Rate</span>
                  <span className="text-[#FFC928] font-mono-tabular">
                    {settings.voiceSpeech.speechSpeed.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={settings.voiceSpeech.speechSpeed}
                  onChange={(e) => updateVoice({ speechSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-[#FFC928]"
                />
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <label className="block text-xs text-[#C5A059]">Orb Touch Interaction Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateVoice({ touchToSpeakMode: 'tap-toggle' })}
                    className={`py-2.5 px-3 rounded-lg text-xs border ${
                      settings.voiceSpeech.touchToSpeakMode === 'tap-toggle'
                        ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                        : 'bg-black border-white/10 text-white/70'
                    }`}
                  >
                    Tap Orb to Start / Stop
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVoice({ touchToSpeakMode: 'hold-to-talk' })}
                    className={`py-2.5 px-3 rounded-lg text-xs border ${
                      settings.voiceSpeech.touchToSpeakMode === 'hold-to-talk'
                        ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                        : 'bg-black border-white/10 text-white/70'
                    }`}
                  >
                    Hold Orb to Talk
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Spoken Voice Output</div>
                    <div className="text-[11px] text-white/50">
                      Speak JARVIS AI responses aloud and sync the 3D golden orb to word amplitude
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.voiceSpeech.voiceOutputEnabled}
                    onChange={(e) => updateVoice({ voiceOutputEnabled: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Continuous Follow-Up Listening
                    </div>
                    <div className="text-[11px] text-white/50">
                      Automatically listen for follow-up questions after JARVIS finishes speaking
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.voiceSpeech.autoListenFollowUp}
                    onChange={(e) => updateVoice({ autoListenFollowUp: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 3. PHONE CONTROL & PERMISSIONS */}
          {activeTab === 'phone' && (
            <div className="space-y-6">
              {/* Live Runtime Permission Matrix */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#C5A059]">
                    Live Android / Web Permission Matrix
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshPermissions}
                    className="text-xs text-[#FFC928] hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg bg-black border border-white/10 flex items-center justify-between">
                    <span>Microphone (Voice)</span>
                    {permissions.microphone === 'granted' ? (
                      <span className="text-[#FFC928] font-medium">Granted</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await requestMicrophonePermission();
                          onRefreshPermissions();
                        }}
                        className="px-2.5 py-1 rounded bg-[#FFC928] text-black font-semibold"
                      >
                        Grant
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-black border border-white/10 flex items-center justify-between">
                    <span>Camera (Vision)</span>
                    {permissions.camera === 'granted' ? (
                      <span className="text-[#FFC928] font-medium">Granted</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await requestCameraPermission();
                          onRefreshPermissions();
                        }}
                        className="px-2.5 py-1 rounded bg-[#FFC928] text-black font-semibold"
                      >
                        Grant
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-black border border-white/10 flex items-center justify-between">
                    <span>Notifications (Reminders)</span>
                    {permissions.notifications === 'granted' ? (
                      <span className="text-[#FFC928] font-medium">Granted</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          await requestNotificationPermission();
                          onRefreshPermissions();
                        }}
                        className="px-2.5 py-1 rounded bg-[#FFC928] text-black font-semibold"
                      >
                        Grant
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-black border border-white/10 flex items-center justify-between">
                    <span>Android Intent Bridge</span>
                    <span className="text-[#C5A059] font-mono-tabular">
                      {permissions.androidIntents}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Enable Phone Control Layer</div>
                    <div className="text-[11px] text-white/50">
                      Allow JARVIS to prepare Android Intents for apps, alarms, timers, calls, and messages
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.phoneControl.enabled}
                    onChange={(e) => updatePhone({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Require Explicit Confirmation for Sensitive Actions
                    </div>
                    <div className="text-[11px] text-white/50">
                      Always ask before placing calls, sending SMS/WhatsApp, or launching external packages
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.phoneControl.confirmSensitiveActions}
                    onChange={(e) => updatePhone({ confirmSensitiveActions: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Authorize Accessibility Gesture Bridge
                    </div>
                    <div className="text-[11px] text-white/50">
                      User-authorized scroll/navigation gesture dispatch (no background harvesting)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.phoneControl.accessibilityBridgeEnabled}
                    onChange={(e) => updatePhone({ accessibilityBridgeEnabled: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>

              {/* Interactive Action Dispatchers */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-4">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Test Android Intent & Action Dispatchers
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={testAppName}
                      onChange={(e) => setTestAppName(e.target.value)}
                      className="flex-1 min-w-0 bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      placeholder="App name"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDeviceAction({
                          actionType: 'OPEN_APP',
                          targetApp: testAppName,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black text-xs font-semibold shrink-0"
                    >
                      Open
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="time"
                      value={testAlarmTime}
                      onChange={(e) => setTestAlarmTime(e.target.value)}
                      className="flex-1 min-w-0 bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const [h, m] = testAlarmTime.split(':').map(Number);
                        onTriggerDeviceAction({
                          actionType: 'SET_ALARM',
                          alarmHour: h || 7,
                          alarmMinute: m || 0,
                          label: 'JARVIS Alarm',
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black text-xs font-semibold shrink-0"
                    >
                      Alarm
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      value={testTimerSec}
                      onChange={(e) => setTestTimerSec(e.target.value)}
                      className="flex-1 min-w-0 bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      placeholder="Sec"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDeviceAction({
                          actionType: 'SET_TIMER',
                          timerSeconds: Number(testTimerSec) || 60,
                          label: 'Quick Timer',
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black text-xs font-semibold shrink-0"
                    >
                      Timer
                    </button>
                  </div>
                </div>

                {/* Communication Intent Dispatchers: Call, SMS, WhatsApp */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="text-[11px] text-white/60">
                    Communication Intents (Requires user confirmation before execution)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={testContactPhone}
                      onChange={(e) => setTestContactPhone(e.target.value)}
                      placeholder="Phone number (e.g. +919876543210)"
                      className="bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={testMessageBody}
                      onChange={(e) => setTestMessageBody(e.target.value)}
                      placeholder="Message body"
                      className="bg-black border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDeviceAction({
                          actionType: 'DIAL_NUMBER',
                          phoneNumberOrContact: testContactPhone,
                          requiresConfirmation: true,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#FFC928]/40 text-[#FFC928] text-xs hover:bg-[#FFC928]/10"
                    >
                      Prepare Call Dialer
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDeviceAction({
                          actionType: 'SEND_SMS',
                          phoneNumberOrContact: testContactPhone,
                          label: testMessageBody,
                          requiresConfirmation: true,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#FFC928]/40 text-[#FFC928] text-xs hover:bg-[#FFC928]/10"
                    >
                      Draft SMS Intent
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDeviceAction({
                          actionType: 'SEND_WHATSAPP',
                          phoneNumberOrContact: testContactPhone,
                          label: testMessageBody,
                          requiresConfirmation: true,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-[#FFC928]/40 text-[#FFC928] text-xs hover:bg-[#FFC928]/10"
                    >
                      Draft WhatsApp Intent
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onTriggerDeviceAction({
                          actionType: 'CHECK_DEVICE_STATUS',
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-white/20 text-white/80 text-xs hover:bg-white/5"
                    >
                      Read Device Telemetry
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Timers & Alarms */}
              {activeTimers.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                    Active Timers & Alarms
                  </div>
                  {activeTimers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0"
                    >
                      <span>{t.label}</span>
                      <span className="font-mono-tabular text-[#FFC928]">
                        {t.triggered ? 'Completed' : `${t.remainingSeconds}s remaining`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Audit Log */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Device Action Audit Log ({actionLogs.length})
                </div>
                {actionLogs.length === 0 ? (
                  <p className="text-xs text-white/40">No device actions executed yet.</p>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {actionLogs.slice(0, 12).map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-lg bg-black border border-white/10 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <div className="font-medium text-[#FFC928]">{log.title}</div>
                          <div className="text-white/60 text-[11px]">{log.detail}</div>
                        </div>
                        {log.androidIntentUri && (
                          <a
                            href={log.androidIntentUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-[#FFC928]/15 text-[#FFC928] text-[11px] inline-flex items-center gap-1 shrink-0"
                          >
                            <span>Launch</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Native Kotlin Reference Module */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Native Android Kotlin Bridge Blueprint
                    </div>
                    <div className="text-[11px] text-white/50">
                      Production Intent & AccessibilityService implementation for Android APK packaging
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowKotlinCode(!showKotlinCode)}
                    className="px-3 py-1.5 rounded-lg border border-[#FFC928]/35 text-xs text-[#FFC928]"
                  >
                    {showKotlinCode ? 'Hide Code' : 'Inspect Kotlin'}
                  </button>
                </div>
                {showKotlinCode && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={handleCopyKotlin}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded bg-[#FFC928] text-black text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                    <pre className="p-3 rounded-lg bg-black border border-white/10 text-[11px] text-white/80 font-mono overflow-x-auto max-h-64">
                      {NATIVE_KOTLIN_BLUEPRINT}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. SCREEN VISION & UNDERSTANDING */}
          {activeTab === 'vision' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  User-Authorized Screen Capture & Multimodal Vision
                </div>
                <p className="text-xs text-white/65 leading-relaxed">
                  Capture your active screen or upload a mobile screenshot so JARVIS AI can inspect
                  visible UI elements, summarize content, and suggest next actions.
                </p>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCaptureLiveScreen}
                    className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Capture Live Screen</span>
                  </button>

                  <label className="px-4 py-2.5 min-h-[42px] rounded-xl border border-[#FFC928]/40 text-[#FFC928] font-medium text-xs inline-flex items-center gap-2 cursor-pointer hover:bg-[#FFC928]/10">
                    <Camera className="w-4 h-4" />
                    <span>Upload Screenshot</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadScreenshotFile}
                    />
                  </label>
                </div>
              </div>

              {screenPreviewUrl && (
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#C5A059]">Captured Screen Preview</span>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenPreviewUrl(null);
                        setScreenBase64('');
                        setScreenAnalysisResult('');
                      }}
                      className="text-xs text-white/50 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <img
                    src={screenPreviewUrl}
                    alt="Captured screen"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-56 object-contain rounded-lg border border-white/10 bg-black"
                  />

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={screenPrompt}
                      onChange={(e) => setScreenPrompt(e.target.value)}
                      placeholder="Ask about this screen (or leave blank for full UI breakdown)..."
                      className="flex-1 bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={isAnalyzingScreen}
                      onClick={handleRunScreenAnalysis}
                      className="px-4 py-2 rounded-lg bg-[#FFC928] text-black font-semibold text-xs disabled:opacity-50"
                    >
                      {isAnalyzingScreen ? 'Analyzing...' : 'Analyze'}
                    </button>
                  </div>
                </div>
              )}

              {screenAnalysisResult && (
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#FFC928]">
                    JARVIS Screen Analysis & Next Actions
                  </div>
                  <p className="text-xs text-white/90 whitespace-pre-wrap leading-relaxed">
                    {screenAnalysisResult}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Auto-Analyze Immediately on Capture
                    </div>
                    <div className="text-[11px] text-white/50">
                      Automatically run Gemini vision analysis as soon as a screenshot is captured
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.screenVision.autoAnalyzeOnCapture}
                    onChange={(e) => updateVision({ autoAnalyzeOnCapture: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 5. CHAT & FILES */}
          {activeTab === 'chat' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#C5A059]">
                    Conversation Threads ({threads.length})
                  </span>
                  <button
                    type="button"
                    onClick={onNewThread}
                    className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Chat</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {threads.map((t) => (
                    <div
                      key={t.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                        t.id === activeThreadId
                          ? 'bg-[#FFC928]/10 border-[#FFC928]/40 text-white'
                          : 'bg-black border-white/10 text-white/75'
                      }`}
                    >
                      {editingThreadId === t.id ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingThreadTitle}
                            onChange={(e) => setEditingThreadTitle(e.target.value)}
                            className="flex-1 bg-[#0B0B0B] border border-[#FFC928]/40 rounded px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editingThreadTitle.trim()) {
                                onRenameThread(t.id, editingThreadTitle.trim());
                              }
                              setEditingThreadId(null);
                            }}
                            className="px-2 py-1 rounded bg-[#FFC928] text-black font-semibold"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectThread(t.id)}
                          className="flex-1 text-left truncate"
                        >
                          <div className="font-medium truncate">{t.title}</div>
                          <div className="text-[10px] text-white/45">
                            {t.messages.length} messages · Updated{' '}
                            {new Date(t.updatedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </button>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingThreadId(t.id);
                            setEditingThreadTitle(t.title);
                          }}
                          aria-label="Rename thread"
                          className="p-1.5 text-white/50 hover:text-[#FFC928]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {threads.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteThread(t.id)}
                            aria-label="Delete thread"
                            className="p-1.5 text-white/50 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onClearAllThreads}
                  className="text-xs text-red-400 hover:underline inline-flex items-center gap-1 pt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Conversation History</span>
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Press Enter to Send</div>
                    <div className="text-[11px] text-white/50">
                      Submit messages in the bottom chat composer when pressing Enter
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.chatInterface.enterToSend}
                    onChange={(e) => updateChat({ enterToSend: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#C5A059]">Max Attachment Upload Limit</span>
                    <span className="text-[#FFC928] font-mono-tabular">
                      {settings.chatInterface.maxUploadSizeMb} MB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    step="5"
                    value={settings.chatInterface.maxUploadSizeMb}
                    onChange={(e) => updateChat({ maxUploadSizeMb: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#FFC928]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 6. MEMORY & PERSONALIZATION */}
          {activeTab === 'memory' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Enable Relevant Memory Retrieval
                    </div>
                    <div className="text-[11px] text-white/50">
                      Inject only matching user preferences and facts into the active AI prompt
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.memory.enabled}
                    onChange={(e) => updateMemory({ enabled: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">
                      Auto-Save Approved User Preferences
                    </div>
                    <div className="text-[11px] text-white/50">
                      Allow JARVIS to store facts when you ask it to remember something
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.memory.autoExtractFacts}
                    onChange={(e) => updateMemory({ autoExtractFacts: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>

              {/* Add Memory Form */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Add Personal Memory Fact
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newMemoryCategory}
                    onChange={(e) =>
                      setNewMemoryCategory(e.target.value as MemoryFact['category'])
                    }
                    className="bg-black border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="preference">Preference</option>
                    <option value="contact">Contact</option>
                    <option value="routine">Routine</option>
                    <option value="language">Language</option>
                  </select>
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="e.g., My work hours are 9 AM to 6 PM..."
                    className="flex-1 bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newMemoryText.trim()) {
                        onAddMemory(newMemoryText.trim(), newMemoryCategory);
                        setNewMemoryText('');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              {/* Stored Memories List with Enable/Disable & Delete */}
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Stored Memories ({memories.length})
                </div>
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#0B0B0B] border border-white/10 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={m.enabled !== false}
                        onChange={() => onToggleMemory(m.id)}
                        aria-label={`Toggle memory: ${m.fact}`}
                        className="w-4 h-4 accent-[#FFC928] shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="inline-block px-2 py-0.5 rounded bg-[#FFC928]/15 text-[#FFC928] text-[10px] uppercase mr-2">
                          {m.category}
                        </span>
                        <span
                          className={
                            m.enabled === false ? 'text-white/40 line-through' : 'text-white/90'
                          }
                        >
                          {m.fact}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteMemory(m.id)}
                      aria-label="Delete memory"
                      className="p-1.5 text-white/45 hover:text-red-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. SMART PLANNER & AUTOMATION ROUTINES */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              {/* Add Task / Reminder */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Smart Planner · Tasks, Reminders & Daily Schedule
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={newTaskCategory}
                    onChange={(e) =>
                      setNewTaskCategory(e.target.value as PlannerTask['category'])
                    }
                    className="bg-black border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <option value="task">Task</option>
                    <option value="reminder">Reminder</option>
                    <option value="schedule">Schedule</option>
                  </select>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task or reminder title..."
                    className="sm:col-span-2 bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    placeholder="Time (e.g. 18:00)"
                    className="bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (newTaskTitle.trim()) {
                      onAddPlannerTask(
                        newTaskTitle.trim(),
                        newTaskDue.trim() || 'Today',
                        newTaskCategory
                      );
                      setNewTaskTitle('');
                      setNewTaskDue('');
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Planner</span>
                </button>

                <div className="space-y-2 pt-2">
                  {plannerTasks.length === 0 ? (
                    <p className="text-xs text-white/40">No planner items scheduled.</p>
                  ) : (
                    plannerTasks.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-black border border-white/10 flex items-center justify-between gap-2 text-xs"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => onTogglePlannerTask(item.id)}
                            className="w-4 h-4 accent-[#FFC928]"
                          />
                          <span
                            className={
                              item.completed ? 'line-through text-white/40' : 'text-white/90'
                            }
                          >
                            {item.title}
                          </span>
                          {item.dueTime && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#FFC928]/15 text-[#FFC928] font-mono-tabular">
                              {item.dueTime}
                            </span>
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => onDeletePlannerTask(item.id)}
                          className="p-1 text-white/40 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Multi-Step Automation Routines */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Automation Routines ("Work Mode" & Custom Workflows)
                </div>
                <div className="space-y-3">
                  {routines.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-black border border-[#FFC928]/25 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-[#FFC928]">{r.name}</div>
                          <div className="text-[11px] text-white/55">{r.description}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={r.enabled}
                            onChange={() => onToggleRoutine(r.id)}
                            aria-label={`Enable ${r.name}`}
                            className="w-4 h-4 accent-[#FFC928]"
                          />
                          <button
                            type="button"
                            disabled={!r.enabled}
                            onClick={() => onRunRoutine(r)}
                            className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Run</span>
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-white/60 pl-3 border-l border-[#FFC928]/30 space-y-0.5">
                        {r.steps.map((st, idx) => (
                          <div key={idx}>• {st}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Automation Execution Logs */}
              {automationLogs.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                    Automation Execution Logs
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                    {automationLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 rounded bg-black border border-white/10 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[#FFC928] font-medium">{log.routineName}: </span>
                          <span className="text-white/75">{log.detail}</span>
                        </div>
                        <span className="text-[10px] text-white/40 font-mono-tabular">
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 8. APPEARANCE & ORB ANIMATION */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[#C5A059] uppercase tracking-wider">
                    3D Golden AI Orb Telemetry
                  </div>
                  <div className="text-white/75 mt-1 font-mono-tabular">
                    {renderTelemetry.fps} FPS · {renderTelemetry.nodes} Neural Nodes ·{' '}
                    {renderTelemetry.filaments} Synaptic Filaments
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#C5A059]">Golden Glow Intensity</span>
                  <span className="text-[#FFC928] font-mono-tabular">
                    {Math.round(settings.appearance.goldIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.5"
                  step="0.05"
                  value={settings.appearance.goldIntensity}
                  onChange={(e) =>
                    updateAppearance({ goldIntensity: parseFloat(e.target.value) })
                  }
                  className="w-full accent-[#FFC928]"
                />
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <label className="block text-xs text-[#C5A059]">3D Neural Complexity Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ultra', 'balanced', 'battery'] as AnimationQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => updateAppearance({ animationQuality: q })}
                      className={`py-2.5 rounded-lg text-xs font-medium uppercase border ${
                        settings.appearance.animationQuality === q
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-[#FFC928]'
                          : 'bg-black border-white/10 text-white/65'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Golden Energy Rings</div>
                    <div className="text-[11px] text-white/50">
                      Render orbital holographic golden energy rings around the neural core
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.showOrbRings}
                    onChange={(e) => updateAppearance({ showOrbRings: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Animated Network Lines</div>
                    <div className="text-[11px] text-white/50">
                      Render interconnected neural filaments and branching synapses
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.showNetworkFilaments}
                    onChange={(e) =>
                      updateAppearance({ showNetworkFilaments: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Holographic Particles</div>
                    <div className="text-[11px] text-white/50">
                      Render atmospheric golden dust and traveling synaptic pulses
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.showHolographicParticles}
                    onChange={(e) =>
                      updateAppearance({ showHolographicParticles: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Live Voice Captions</div>
                    <div className="text-[11px] text-white/50">
                      Display subtle ephemeral subtitles above the bottom composer
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.showSubtleCaptions}
                    onChange={(e) =>
                      updateAppearance({ showSubtleCaptions: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Reduced Motion Mode</div>
                    <div className="text-[11px] text-white/50">
                      Minimize camera drift and rapid particle motion
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.reducedMotion}
                    onChange={(e) => updateAppearance({ reducedMotion: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* 9. NOTIFICATIONS & QUIET HOURS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Proactive Reminders</div>
                    <div className="text-[11px] text-white/50">
                      Trigger notifications for scheduled Smart Planner tasks and timers
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.remindersEnabled}
                    onChange={(e) =>
                      updateNotifications({ remindersEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Quiet Hours Enforcement</div>
                    <div className="text-[11px] text-white/50">
                      Suppress non-urgent automation alerts during designated rest hours
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.quietHoursEnabled}
                    onChange={(e) =>
                      updateNotifications({ quietHoursEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                {settings.notifications.quietHoursEnabled && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#0B0B0B] border border-white/10">
                    <div>
                      <label className="block text-xs text-[#C5A059] mb-1">
                        Quiet Hours Start
                      </label>
                      <input
                        type="time"
                        value={settings.notifications.quietHoursStart}
                        onChange={(e) =>
                          updateNotifications({ quietHoursStart: e.target.value })
                        }
                        className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#C5A059] mb-1">
                        Quiet Hours End
                      </label>
                      <input
                        type="time"
                        value={settings.notifications.quietHoursEnd}
                        onChange={(e) =>
                          updateNotifications({ quietHoursEnd: e.target.value })
                        }
                        className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 10. PRIVACY & SECURITY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-2 text-xs">
                <div className="text-[#C5A059] uppercase tracking-wider">
                  Local Data & Security Footprint
                </div>
                <div className="text-white/80 font-mono-tabular">
                  {(storageStats.bytesUsed / 1024).toFixed(2)} KB used across{' '}
                  {storageStats.itemCount} local stores
                </div>
                <p className="text-white/55 text-[11px] leading-relaxed">
                  API keys remain strictly server-side. Microphone, camera, and screen vision
                  operate only when explicitly triggered by you.
                </p>
              </div>

              <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                <div>
                  <div className="text-xs font-medium text-white">Ephemeral Session Mode</div>
                  <div className="text-[11px] text-white/50">
                    Do not persist new conversation messages to local storage
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.privacy.ephemeralSession}
                  onChange={(e) => updatePrivacy({ ephemeralSession: e.target.checked })}
                  className="w-4 h-4 accent-[#FFC928]"
                />
              </label>

              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Reset & Wipe All Local Data</span>
                </div>
                <p className="text-xs text-white/60">
                  Permanently erase all conversation threads, saved user memories, planner tasks,
                  and custom settings from this device.
                </p>
                {!confirmWipe ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold"
                  >
                    Wipe All Data...
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onWipeAll();
                        setConfirmWipe(false);
                      }}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    >
                      Confirm Permanent Wipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(false)}
                      className="px-3 py-2 rounded-lg border border-white/15 text-xs text-white/70"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 11. ABOUT JARVIS AI */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-3">
                <div className="font-display text-base tracking-[0.2em] text-white">
                  JARVIS <span className="text-[#FFC928]">AI</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Personal Android & Web AI Assistant featuring an audio-reactive 3D golden neural
                  orb, multimodal attachment analysis (Photos, Camera, Files, PDFs), multilingual
                  voice intelligence (English, Hindi, Hinglish, Gujarati), live web search
                  grounding, smart planner automation, and permission-governed Android Intent
                  orchestration.
                </p>
                <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] text-white/55">
                  <div>Primary Model: {settings.aiBrain.model}</div>
                  <div>Voice Engine: {settings.voiceSpeech.voiceEngine}</div>
                  <div>3D Engine: Three.js WebGL Shader Core</div>
                  <div>Platform: Android / Web Hybrid</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

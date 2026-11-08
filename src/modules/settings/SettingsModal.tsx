import React, { useState, useEffect } from 'react';
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
  Server,
  Download,
  Phone,
  Layers,
  Radio,
  Lock,
  Zap,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  ActiveTimerOrAlarm,
  AddressPreference,
  AnimationQuality,
  AppIntegrationItem,
  AutomationLog,
  AutomationRoutine,
  BackendStatus,
  ChatThread,
  ContactInfo,
  DeviceActionRequest,
  DeviceActionResult,
  EmotionMode,
  GeminiVoiceName,
  InstalledAppInfo,
  JarvisSettings,
  LanguageMode,
  LatencyMetrics,
  MemoryFact,
  PermissionStatusMap,
  PersonalityMode,
  PlannerTask,
  ResponseStyle,
  VoiceEngineMode,
} from '../../types/jarvis';
import {
  JarvisNativeDevice,
  NativeNotificationItem,
  NativeUiNode,
  requestCameraPermission,
  requestContactsPermission,
  requestMicrophonePermission,
  requestNotificationPermission,
  requestPhonePermission,
} from '../device/deviceControl';
import { voiceEngine } from '../voice/VoiceEngine';
import { aiService } from '../ai/aiService';
import { FloatingOrbSettings } from './FloatingOrbSettings';
import { DeveloperModePanel } from '../developer/DeveloperModePanel';
import { getBackendBaseUrl } from '../ai/aiService';

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
  latencyMetrics?: LatencyMetrics;
}

export type SettingsTab =
  | 'brain'
  | 'voice'
  | 'phone'
  | 'accessibility'
  | 'background'
  | 'comms'
  | 'apps'
  | 'memory'
  | 'backend'
  | 'security'
  | 'diagnostics'
  | 'appearance';

const TABS: { id: SettingsTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'brain', label: '1. AI Brain', icon: Cpu },
  { id: 'voice', label: '2. Voice & Speech', icon: Volume2 },
  { id: 'phone', label: '3. Phone Control', icon: Smartphone },
  { id: 'accessibility', label: '4. Accessibility', icon: Eye },
  { id: 'background', label: '5. Background Assistant', icon: Radio },
  { id: 'comms', label: '6. Calls & Messages', icon: MessageSquare },
  { id: 'apps', label: '7. App Integrations', icon: Layers },
  { id: 'memory', label: '8. Memory & Personality', icon: Database },
  { id: 'backend', label: '9. Cloud & Local Backend', icon: Server },
  { id: 'security', label: '10. Security & Permissions', icon: Shield },
  { id: 'diagnostics', label: '11. Diagnostics', icon: AlertTriangle },
  { id: 'appearance', label: 'Appearance & Orb', icon: Sparkles },
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
  latencyMetrics,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('brain');

  // Memory inputs
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryFact['category']>('preference');

  // Thread rename state
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState<string>('');

  // Wipe confirmation
  const [confirmWipe, setConfirmWipe] = useState(false);

  // Voice Test state
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [voiceTestFeedback, setVoiceTestFeedback] = useState<string>('');

  // Contacts search test state
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<ContactInfo[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);

  // Accessibility screen test
  const [accessibleNodes, setAccessibleNodes] = useState<NativeUiNode[]>([]);
  const [isReadingScreen, setIsReadingScreen] = useState(false);
  const [screenFeedback, setScreenFeedback] = useState('');

  // Notification reading test
  const [recentNotifications, setRecentNotifications] = useState<NativeNotificationItem[]>([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  // App scanner state
  const [scannedApps, setScannedApps] = useState<Array<{ packageName: string; appName: string; isSystemApp: boolean }>>([]);
  const [isScanningApps, setIsScanningApps] = useState(false);
  const [newAliasText, setNewAliasText] = useState('');
  const [selectedAppForAlias, setSelectedAppForAlias] = useState('');

  // Diagnostics info from voice backend
  const [ttsDiagnostics, setTtsDiagnostics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'voice') {
      aiService.getVoiceDiagnostics(settings).then((data) => setTtsDiagnostics(data));
    }
  }, [isOpen, activeTab, settings]);

  if (!isOpen) return null;

  const updateBrain = (patch: Partial<JarvisSettings['aiBrain']>) => {
    onUpdateSettings({
      ...settings,
      aiBrain: { ...settings.aiBrain, ...patch },
    });
  };

  const updatePersonality = (patch: Partial<JarvisSettings['personality']>) => {
    onUpdateSettings({
      ...settings,
      personality: { ...settings.personality, ...patch },
    });
  };

  const updateVoice = (patch: Partial<JarvisSettings['voiceSpeech']>) => {
    onUpdateSettings({
      ...settings,
      voiceSpeech: { ...settings.voiceSpeech, ...patch },
    });
  };

  const updateElevenLabs = (patch: Partial<JarvisSettings['voiceSpeech']['elevenLabs']>) => {
    onUpdateSettings({
      ...settings,
      voiceSpeech: {
        ...settings.voiceSpeech,
        elevenLabs: { ...settings.voiceSpeech.elevenLabs, ...patch },
      },
    });
  };

  const updatePhone = (patch: Partial<JarvisSettings['phoneControl']>) => {
    onUpdateSettings({
      ...settings,
      phoneControl: { ...settings.phoneControl, ...patch },
    });
  };

  const updateAccessibility = (patch: Partial<JarvisSettings['accessibility']>) => {
    onUpdateSettings({
      ...settings,
      accessibility: { ...settings.accessibility, ...patch },
    });
  };

  const updateBackground = (patch: Partial<JarvisSettings['backgroundAssistant']>) => {
    onUpdateSettings({
      ...settings,
      backgroundAssistant: { ...settings.backgroundAssistant, ...patch },
    });
  };

  const updateAppIntegrations = (patch: Partial<JarvisSettings['appIntegrations']>) => {
    onUpdateSettings({
      ...settings,
      appIntegrations: { ...settings.appIntegrations, ...patch },
    });
  };

  const updateCloudLocal = (patch: Partial<JarvisSettings['cloudLocal']>) => {
    onUpdateSettings({
      ...settings,
      cloudLocal: { ...settings.cloudLocal, ...patch },
    });
  };

  const updateAppearance = (patch: Partial<JarvisSettings['appearance']>) => {
    onUpdateSettings({
      ...settings,
      appearance: { ...settings.appearance, ...patch },
    });
  };

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    setVoiceTestFeedback('Synthesizing multilingual test phrase...');
    const testText =
      settings.voiceSpeech.language === 'gu'
        ? 'નમસ્તે સર. હું જાર્વિસ છું, તમારી વ્યક્તિગત સહાયક સેવા કાર્યરત છે.'
        : settings.voiceSpeech.language === 'hi'
        ? 'नमस्ते सर. मैं जार्विस हूँ, आपकी सेवा में हमेशा तैयार.'
        : settings.voiceSpeech.language === 'hinglish'
        ? 'Good day Sir. Main JARVIS hoon, all systems ready.'
        : 'Good day, Sir. I am JARVIS, fully operational and at your command.';

    try {
      await voiceEngine.speakFullText(
        testText,
        settings,
        {
          onStart: () => setVoiceTestFeedback('Playing speech output...'),
          onEnd: () => {
            setIsTestingVoice(false);
            setVoiceTestFeedback('Voice playback completed successfully.');
          },
          onError: (err) => {
            setIsTestingVoice(false);
            setVoiceTestFeedback(`Playback failed: ${err.message}`);
          },
        },
        settings.personality.emotionMode
      );
    } catch (e) {
      setIsTestingVoice(false);
      setVoiceTestFeedback(e instanceof Error ? e.message : 'Voice test failed');
    }
  };

  const handleScanInstalledApps = async () => {
    setIsScanningApps(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await JarvisNativeDevice.getInstalledApps();
        if (res.apps) {
          setScannedApps(res.apps);
          // Merge newly discovered apps into settings
          const currentApps = [...settings.appIntegrations.apps];
          for (const discovered of res.apps) {
            if (!currentApps.some((a) => a.packageName === discovered.packageName)) {
              currentApps.push({
                packageName: discovered.packageName,
                appName: discovered.appName,
                aliases: [discovered.appName.toLowerCase()],
                enabled: true,
                isSystemApp: discovered.isSystemApp,
              });
            }
          }
          updateAppIntegrations({ apps: currentApps });
        }
      } else {
        setScannedApps(
          settings.appIntegrations.apps.map((a) => ({
            packageName: a.packageName,
            appName: a.appName,
            isSystemApp: false,
          }))
        );
      }
    } catch {
      // Ignore
    } finally {
      setIsScanningApps(false);
    }
  };

  const handleSearchContacts = async () => {
    setIsSearchingContacts(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await JarvisNativeDevice.searchContacts({ query: contactSearchQuery });
        setContactSearchResults(res.contacts || []);
      } else {
        setContactSearchResults([
          { id: '1', displayName: 'Simulated Contact (Web)', phoneNumber: '+919876543210' },
        ]);
      }
    } catch {
      setContactSearchResults([]);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  const handleTestReadScreen = async () => {
    setIsReadingScreen(true);
    setScreenFeedback('Inspecting visible UI controls...');
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await JarvisNativeDevice.readScreenText();
        setAccessibleNodes(res.nodes || []);
        setScreenFeedback(`Captured ${res.nodeCount || 0} visible controls in ${res.foregroundPackage || 'app'}`);
      } else {
        setScreenFeedback('Simulated Accessibility: Running on web runtime. Native Android required for live screen node inspection.');
      }
    } catch (e) {
      setScreenFeedback(e instanceof Error ? e.message : 'Could not read screen');
    } finally {
      setIsReadingScreen(false);
    }
  };

  const handleFetchRecentNotifications = async () => {
    setIsLoadingNotifs(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await JarvisNativeDevice.getRecentNotifications();
        setRecentNotifications(res.notifications || []);
      } else {
        setRecentNotifications([
          { packageName: 'com.whatsapp', title: 'Work Group', text: 'Meeting starts at 10 AM', postTime: Date.now() - 60000 },
        ]);
      }
    } catch {
      setRecentNotifications([]);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

  return (
    <div
      className="jarvis-settings-overlay fixed inset-0 z-50 flex items-center justify-end bg-slate-900/15 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label="JARVIS AI Settings"
    >
      <div className="jarvis-settings-panel relative w-full max-w-2xl h-full bg-white/90 border-l border-white/80 flex flex-col text-slate-800 shadow-2xl backdrop-blur-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80">
          <div>
            <h2 className="font-display text-sm tracking-[0.22em] text-[#5267EE] uppercase">
              System Configuration
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              JARVIS AI · Personal Android Assistant Architecture & Controls
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#5267EE] hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-200 bg-slate-50/80 overflow-x-auto shrink-0">
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
                    ? 'bg-[#6578F7] text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================================= */}
          {/* 1. AI BRAIN */}
          {/* ========================================================================= */}
          {activeTab === 'brain' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                    AI Brain Architecture
                  </div>
                  <div className="text-sm font-semibold mt-0.5 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        backendStatus?.configured ? 'bg-[#FFC928]' : 'bg-red-500'
                      }`}
                    />
                    <span>
                      {settings.aiBrain.provider === 'free-unlimited'
                        ? 'Free Unlimited AI Engine'
                        : settings.aiBrain.provider === 'fcc'
                        ? 'FCC Cloud AI Gateway'
                        : settings.aiBrain.provider === 'auto-hybrid'
                        ? 'Auto-Hybrid (Google Gemini + Free Backup)'
                        : 'Google Gemini Strict API Mode'}
                    </span>
                  </div>
                  <div className="text-xs text-white/55 mt-1">
                    {backendStatus?.message || 'Connecting to central intelligence core...'}
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
                <label className="block text-xs text-[#C5A059]">Intelligence Provider Mode</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      id: 'auto-hybrid',
                      title: 'Auto-Hybrid (Google Gemini + Free Backup) — Recommended',
                      desc: 'Streaming Gemini tokens with automatic fallback if rate limits occur.',
                    },
                    {
                      id: 'gemini',
                      title: 'Google Gemini Dedicated Mode',
                      desc: 'Direct execution on gemini-3.8-flash and gemini-3.1-flash-lite.',
                    },
                    {
                      id: 'fcc',
                      title: 'FCC Cloud AI Gateway',
                      desc: 'Route conversations through your separately hosted FCC gateway with provider/model fallback.',
                    },
                    {
                      id: 'free-unlimited',
                      title: 'Free Unlimited AI Mode (Zero Rate Limits)',
                      desc: 'OpenAI-compatible serverless neural core for unthrottled conversation.',
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateBrain({ provider: mode.id as JarvisSettings['aiBrain']['provider'] })}
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
                  <label className="block text-xs text-[#C5A059]">{settings.aiBrain.provider === 'fcc' ? 'FCC model is configured on the cloud service' : 'Primary Gemini Model'}</label>
                  <select
                    value={settings.aiBrain.model}
                    onChange={(e) => updateBrain({ model: e.target.value as JarvisSettings['aiBrain']['model'] })}
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (High Intelligence)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra-Low Latency)</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <label className="block text-xs text-[#C5A059]">Fallback Model</label>
                  <select
                    value={settings.aiBrain.fallbackModel}
                    onChange={(e) => updateBrain({ fallbackModel: e.target.value as JarvisSettings['aiBrain']['fallbackModel'] })}
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                  >
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                    <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#C5A059]">Reasoning Depth</span>
                    <span className="text-[#FFC928]">{settings.aiBrain.thinkingLevel}</span>
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
                    <span className="text-[#C5A059]">Creativity / Temperature</span>
                    <span className="text-[#FFC928]">{settings.aiBrain.temperature.toFixed(1)}</span>
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
                    <div className="text-xs font-medium text-white">Live Web Search Grounding</div>
                    <div className="text-[11px] text-white/50">Ground AI answers in live factual sources</div>
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
                    <div className="text-[11px] text-white/50">Stream Gemini tokens progressively as generated</div>
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

          {/* ========================================================================= */}
          {/* 2. VOICE & SPEECH */}
          {/* ========================================================================= */}
          {activeTab === 'voice' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-3">
                <label className="block text-xs text-[#C5A059]">Primary TTS Speech Engine</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'elevenlabs', title: 'ElevenLabs', desc: 'Consistent male voice across languages' },
                    { id: 'edge-neural', title: 'Edge Neural Male', desc: 'Zero quota high-fidelity neural voices' },
                    { id: 'gemini-tts', title: 'Gemini TTS', desc: 'Charon / Fenrir / Puck prebuilt voices' },
                  ].map((engine) => (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => updateVoice({ voiceEngine: engine.id as VoiceEngineMode })}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        settings.voiceSpeech.voiceEngine === engine.id
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-white'
                          : 'bg-black border-white/10 text-white/70'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#FFC928]">{engine.title}</div>
                      <div className="text-[10px] text-white/50 mt-0.5">{engine.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ElevenLabs Configuration Card */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#FFC928]" />
                    <span>ElevenLabs Configuration</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <span className="text-white/70">Enable ElevenLabs</span>
                    <input
                      type="checkbox"
                      checked={settings.voiceSpeech.elevenLabs.enabled}
                      onChange={(e) => updateElevenLabs({ enabled: e.target.checked })}
                      className="w-4 h-4 accent-[#FFC928]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#C5A059] mb-1">Consistent Male Voice ID</label>
                    <input
                      type="text"
                      value={settings.voiceSpeech.elevenLabs.voiceId}
                      onChange={(e) => updateElevenLabs({ voiceId: e.target.value.trim() })}
                      placeholder="e.g. pNInz6obpgDQGcFmaJgB"
                      className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {[
                        { name: 'Adam (Primary)', id: 'pNInz6obpgDQGcFmaJgB' },
                        { name: 'George (British)', id: 'JBFqnCBsd6RMkjVDRZzb' },
                        { name: 'Antoni', id: 'ErXwobaYiN019PkySvjV' },
                        { name: 'Josh', id: 'TxGEqnHWrfWFTfGW9XjX' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => updateElevenLabs({ voiceId: preset.id })}
                          className="px-2 py-0.5 text-[10px] rounded bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#C5A059] mb-1">ElevenLabs Multilingual Model</label>
                    <select
                      value={settings.voiceSpeech.elevenLabs.modelId}
                      onChange={(e) => updateElevenLabs({ modelId: e.target.value })}
                      className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="eleven_multilingual_v2">Eleven Multilingual v2 (High-Fidelity Hindi / English / Gujarati)</option>
                      <option value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Low Latency ~150ms)</option>
                      <option value="eleven_flash_v2_5">Eleven Flash v2.5 (Ultra Low Latency ~75ms)</option>
                      <option value="eleven_v3">Eleven v3 (Expressive Experimental)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#C5A059]">Stability</span>
                      <span className="text-[#FFC928]">{settings.voiceSpeech.elevenLabs.stability.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={settings.voiceSpeech.elevenLabs.stability}
                      onChange={(e) => updateElevenLabs({ stability: parseFloat(e.target.value) })}
                      className="w-full accent-[#FFC928]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#C5A059]">Similarity Boost</span>
                      <span className="text-[#FFC928]">{settings.voiceSpeech.elevenLabs.similarityBoost.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={settings.voiceSpeech.elevenLabs.similarityBoost}
                      onChange={(e) => updateElevenLabs({ similarityBoost: parseFloat(e.target.value) })}
                      className="w-full accent-[#FFC928]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#C5A059]">Style / Emotion</span>
                      <span className="text-[#FFC928]">{settings.voiceSpeech.elevenLabs.style.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={settings.voiceSpeech.elevenLabs.style}
                      onChange={(e) => updateElevenLabs({ style: parseFloat(e.target.value) })}
                      className="w-full accent-[#FFC928]"
                    />
                  </div>
                </div>

                {/* Test Voice Button */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <button
                    type="button"
                    disabled={isTestingVoice}
                    onClick={handleTestVoice}
                    className="px-4 py-2 rounded-lg bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center gap-2 hover:bg-[#e6b424] transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>{isTestingVoice ? 'Playing...' : 'Test Voice Synthesis'}</span>
                  </button>
                  <span className="text-xs text-white/50">{voiceTestFeedback}</span>
                </div>
              </div>

              {/* Language Selection & Speech Speed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <label className="block text-xs text-[#C5A059]">Spoken Output Language</label>
                  <select
                    value={settings.voiceSpeech.language}
                    onChange={(e) => updateVoice({ language: e.target.value as LanguageMode })}
                    className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white"
                  >
                    <option value="auto">Auto-Detect & Multilingual Code-Switching</option>
                    <option value="en">English (Articulate British/Indian)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="hinglish">Hinglish (Natural Blend)</option>
                    <option value="gu">Gujarati (ગુજરાતી)</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#C5A059]">Speech Speed</span>
                    <span className="text-[#FFC928]">{settings.voiceSpeech.speechSpeed.toFixed(2)}x</span>
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
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Voice Speech Output</div>
                    <div className="text-[11px] text-white/50">Speak responses aloud and react in the 3D golden orb</div>
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
                    <div className="text-xs font-medium text-white">Continuous Follow-Up Listening</div>
                    <div className="text-[11px] text-white/50">Automatically resume listening after speech ends</div>
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

          {/* ========================================================================= */}
          {/* 3. PHONE CONTROL */}
          {/* ========================================================================= */}
          {activeTab === 'phone' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Enable Phone Control Engine</div>
                    <div className="text-[11px] text-white/50">Allow JARVIS to execute device actions, alarms, apps, and navigation</div>
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
                    <div className="text-xs font-medium text-white">Confirm Sensitive Actions</div>
                    <div className="text-[11px] text-white/50">Require explicit confirmation for phone calls, SMS, WhatsApp, and device lock</div>
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
                    <div className="text-xs font-medium text-white">Prefer Native Android Intents</div>
                    <div className="text-[11px] text-white/50">Directly dispatch system intents instead of simulated web fallbacks</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.phoneControl.preferNativeIntents}
                    onChange={(e) => updatePhone({ preferNativeIntents: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>

              {/* Action Policy Overview */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/25 space-y-2">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold">
                  Action Security Policy
                </div>
                <div className="text-xs text-white/70 space-y-1">
                  <div><span className="text-[#FFC928] font-semibold">Normal Actions:</span> Open apps, calculate, check device status, scroll, read screen (executes directly upon permitted voice command).</div>
                  <div><span className="text-[#FFC928] font-semibold">Sensitive Actions:</span> Placing calls, sending SMS, deleting data, lock device (requires explicit modal confirmation).</div>
                  <div><span className="text-[#FFC928] font-semibold">Restricted:</span> Never captures passwords, never automates banking transactions or payment confirmations.</div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. ACCESSIBILITY */}
          {/* ========================================================================= */}
          {activeTab === 'accessibility' && (
            <div className="space-y-6">
              <FloatingOrbSettings />
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">Accessibility Service Status</div>
                  <div className="text-sm font-semibold mt-0.5 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        permissions.accessibilityService === 'authorized' ? 'bg-[#FFC928]' : 'bg-red-500'
                      }`}
                    />
                    <span>
                      {permissions.accessibilityService === 'authorized'
                        ? 'JARVIS Accessibility Service Active'
                        : 'Service Not Enabled in Android Settings'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (Capacitor.isNativePlatform()) {
                      await JarvisNativeDevice.openAccessibilitySettings();
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Android Settings</span>
                </button>
              </div>

              {/* Setup Wizard */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold">
                  Accessibility Setup Wizard
                </div>
                <div className="space-y-2 text-xs text-white/80">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FFC928]/20 text-[#FFC928] flex items-center justify-center font-bold text-[11px] shrink-0">1</span>
                    <span>Tap <strong>Open Android Settings</strong> above to navigate to Accessibility.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FFC928]/20 text-[#FFC928] flex items-center justify-center font-bold text-[11px] shrink-0">2</span>
                    <span>Locate <strong>JARVIS AI Screen &amp; Action Controller</strong> under Downloaded Apps.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FFC928]/20 text-[#FFC928] flex items-center justify-center font-bold text-[11px] shrink-0">3</span>
                    <span>Toggle the switch <strong>ON</strong> and grant the Android permission prompt.</span>
                  </div>
                </div>
              </div>

              {/* Live Test Controls */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                  Live Accessibility Bridge Verification
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isReadingScreen}
                    onClick={handleTestReadScreen}
                    className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black font-semibold text-xs"
                  >
                    {isReadingScreen ? 'Reading...' : 'Inspect Visible Screen Controls'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (Capacitor.isNativePlatform()) {
                        JarvisNativeDevice.performGlobalAction({ action: 'BACK' });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-white/20 text-xs text-white hover:bg-white/5"
                  >
                    Test Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (Capacitor.isNativePlatform()) {
                        JarvisNativeDevice.performGlobalAction({ action: 'HOME' });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-white/20 text-xs text-white hover:bg-white/5"
                  >
                    Test Home
                  </button>
                </div>
                {screenFeedback && <div className="text-xs text-[#FFC928] pt-1">{screenFeedback}</div>}

                {accessibleNodes.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pt-2 border-t border-white/10">
                    {accessibleNodes.slice(0, 15).map((node, i) => (
                      <div key={i} className="text-[11px] bg-black p-1.5 rounded border border-white/10 flex justify-between">
                        <span className="text-white truncate">{node.text || node.viewId || node.className}</span>
                        <span className="text-[#FFC928] shrink-0">{node.clickable ? 'clickable' : node.editable ? 'editable' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. BACKGROUND ASSISTANT */}
          {/* ========================================================================= */}
          {activeTab === 'background' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">Background Service State</div>
                  <div className="text-sm font-semibold mt-0.5 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        permissions.backgroundService === 'running' ? 'bg-emerald-500' : 'bg-white/40'
                      }`}
                    />
                    <span>
                      {permissions.backgroundService === 'running'
                        ? 'Persistent Foreground Service Active'
                        : 'Background Service Stopped'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (Capacitor.isNativePlatform()) {
                      if (permissions.backgroundService === 'running') {
                        await JarvisNativeDevice.stopBackgroundService();
                      } else {
                        await JarvisNativeDevice.startBackgroundService();
                      }
                      onRefreshPermissions();
                    }
                  }}
                  className={`px-3 py-2 rounded-lg font-semibold text-xs ${
                    permissions.backgroundService === 'running'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-[#FFC928] text-black'
                  }`}
                >
                  {permissions.backgroundService === 'running' ? 'Stop Service' : 'Start Service'}
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Start Automatically on Phone Boot</div>
                    <div className="text-[11px] text-white/50">Initialize background assistant tasks when the device finishes booting</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.backgroundAssistant.bootStart}
                    onChange={(e) => updateBackground({ bootStart: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Persistent Notification Banner</div>
                    <div className="text-[11px] text-white/50">Keep ongoing Android status notification so OS does not terminate assistant</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.backgroundAssistant.persistentNotification}
                    onChange={(e) => updateBackground({ persistentNotification: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>
              </div>

              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">Battery &amp; Process Optimization</div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Android battery management can pause background services when the phone is idle. Request battery optimization exemption to maintain assistant responsiveness.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (Capacitor.isNativePlatform()) {
                      await JarvisNativeDevice.requestIgnoreBatteryOptimizations();
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#FFC928]/40 text-[#FFC928] text-xs hover:bg-[#FFC928]/10"
                >
                  Request Battery Optimization Exemption
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. CALLS & MESSAGES */}
          {/* ========================================================================= */}
          {activeTab === 'comms' && (
            <div className="space-y-6">
              {/* Phone Calls */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#FFC928]" />
                  <span>Phone Calls &amp; Contacts</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    placeholder="Search contact name..."
                    className="flex-1 bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={isSearchingContacts}
                    onClick={handleSearchContacts}
                    className="px-3 py-2 rounded-lg bg-[#FFC928] text-black text-xs font-semibold"
                  >
                    {isSearchingContacts ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {contactSearchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                    {contactSearchResults.map((c) => (
                      <div key={c.id} className="p-2 rounded bg-black border border-white/10 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium text-white">{c.displayName}</div>
                          <div className="text-[11px] text-white/50">{c.phoneNumber || 'No number'}</div>
                        </div>
                        {c.phoneNumber && (
                          <button
                            type="button"
                            onClick={() => onTriggerDeviceAction({ actionType: 'DIAL_NUMBER', phoneNumberOrContact: c.phoneNumber })}
                            className="px-2.5 py-1 rounded bg-[#FFC928] text-black text-[11px] font-semibold"
                          >
                            Dial
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SMS & WhatsApp */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#FFC928]" />
                  <span>SMS &amp; WhatsApp Integration</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onTriggerDeviceAction({
                        actionType: 'SEND_SMS',
                        phoneNumberOrContact: '+919876543210',
                        label: 'Checking in with JARVIS Assistant.',
                        requiresConfirmation: true,
                      })
                    }
                    className="px-3 py-2 rounded-lg border border-[#FFC928]/40 text-[#FFC928] text-xs hover:bg-[#FFC928]/10"
                  >
                    Test Draft SMS Intent
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onTriggerDeviceAction({
                        actionType: 'SEND_WHATSAPP',
                        phoneNumberOrContact: '+919876543210',
                        label: 'Hello from JARVIS AI.',
                        requiresConfirmation: true,
                      })
                    }
                    className="px-3 py-2 rounded-lg border border-[#FFC928]/40 text-[#FFC928] text-xs hover:bg-[#FFC928]/10"
                  >
                    Test WhatsApp Composer Intent
                  </button>
                </div>
              </div>

              {/* Notification Reader */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">Notification Summarizer</div>
                  <button
                    type="button"
                    disabled={isLoadingNotifs}
                    onClick={handleFetchRecentNotifications}
                    className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black text-xs font-semibold"
                  >
                    {isLoadingNotifs ? 'Loading...' : 'Fetch Recent Notifications'}
                  </button>
                </div>
                {recentNotifications.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {recentNotifications.map((n, i) => (
                      <div key={i} className="p-2 rounded bg-black border border-white/10 text-xs">
                        <div className="font-semibold text-white">{n.title} <span className="text-[10px] text-white/40">({n.packageName})</span></div>
                        <div className="text-white/70 text-[11px] mt-0.5">{n.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/50">No notifications captured yet. Ensure Notification Access is authorized.</div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. APP INTEGRATIONS */}
          {/* ========================================================================= */}
          {activeTab === 'apps' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">Installed Apps Discovery</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    Discover launchable packages and configure voice aliases (e.g. &quot;YT&quot; for YouTube).
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isScanningApps}
                  onClick={handleScanInstalledApps}
                  className="px-3 py-2 rounded-lg bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningApps ? 'animate-spin' : ''}`} />
                  <span>{isScanningApps ? 'Scanning...' : 'Scan Installed Apps'}</span>
                </button>
              </div>

              {/* App Integrations List */}
              <div className="space-y-2">
                {settings.appIntegrations.apps.map((app) => (
                  <div
                    key={app.packageName}
                    className="p-3 rounded-xl bg-[#0B0B0B] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate flex items-center gap-2">
                        <span>{app.appName}</span>
                        {app.isSystemApp && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/60">System</span>
                        )}
                      </div>
                      <div className="text-[10px] text-white/40 font-mono truncate">{app.packageName}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {app.aliases.map((alias, ai) => (
                          <span key={ai} className="text-[10px] px-2 py-0.5 rounded-full bg-[#FFC928]/10 text-[#FFC928] border border-[#FFC928]/20">
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onTriggerDeviceAction({
                            actionType: 'OPEN_APP',
                            targetApp: app.appName,
                          })
                        }
                        className="px-2.5 py-1 rounded bg-[#FFC928] text-black text-xs font-semibold"
                      >
                        Launch
                      </button>
                      <input
                        type="checkbox"
                        checked={app.enabled}
                        onChange={(e) => {
                          const updated = settings.appIntegrations.apps.map((a) =>
                            a.packageName === app.packageName ? { ...a, enabled: e.target.checked } : a
                          );
                          updateAppIntegrations({ apps: updated });
                        }}
                        className="w-4 h-4 accent-[#FFC928]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. MEMORY & PERSONALITY */}
          {/* ========================================================================= */}
          {activeTab === 'memory' && (
            <div className="space-y-6">
              {/* Sir / Boss Preference */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-3">
                <label className="block text-xs text-[#C5A059]">User Address Title Preference</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'adaptive', title: 'Adaptive (Recommended)', desc: '"Sir" during briefings; "Boss" during actions' },
                    { id: 'sir', title: 'Always "Sir"', desc: 'Polished, formal executive demeanor' },
                    { id: 'boss', title: 'Always "Boss"', desc: 'Friendly, modern personal assistant demeanor' },
                  ].map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => updatePersonality({ addressPreference: addr.id as AddressPreference })}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        settings.personality.addressPreference === addr.id
                          ? 'bg-[#FFC928]/15 border-[#FFC928] text-white'
                          : 'bg-black border-white/10 text-white/70'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#FFC928]">{addr.title}</div>
                      <div className="text-[10px] text-white/50 mt-0.5">{addr.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Emotion Delivery Mode */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <label className="block text-xs text-[#C5A059]">Emotion Delivery Mode</label>
                <select
                  value={settings.personality.emotionMode}
                  onChange={(e) => updatePersonality({ emotionMode: e.target.value as EmotionMode })}
                  className="w-full bg-black border border-white/15 rounded-lg px-3 py-2.5 text-xs text-white"
                >
                  <option value="adaptive">Adaptive Emotional Intelligence</option>
                  <option value="calm">Calm &amp; Steady</option>
                  <option value="happy">Warm &amp; Happy</option>
                  <option value="serious">Mission-Critical Serious</option>
                  <option value="concerned">Protective &amp; Concerned</option>
                  <option value="excited">Energetic &amp; Sharp</option>
                  <option value="reassuring">Grounded &amp; Reassuring</option>
                </select>
              </div>

              {/* Persistent Facts Manager */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-[#C5A059]">
                    Persistent User Memories ({memories.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(memories, null, 2));
                      const dl = document.createElement('a');
                      dl.setAttribute('href', dataStr);
                      dl.setAttribute('download', `jarvis-memory-${Date.now()}.json`);
                      dl.click();
                    }}
                    className="px-2.5 py-1 rounded border border-white/20 text-xs text-white/70 inline-flex items-center gap-1 hover:text-[#FFC928]"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Add a new fact to remember..."
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
                    className="px-3 py-2 rounded-lg bg-[#FFC928] text-black text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-lg bg-black border border-white/10 flex items-center justify-between text-xs"
                    >
                      <span className="text-white/85 flex-1 pr-2">{m.fact}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleMemory(m.id)}
                          className={`text-[10px] px-2 py-0.5 rounded border ${
                            m.enabled ? 'border-emerald-500/40 text-emerald-400' : 'border-white/20 text-white/40'
                          }`}
                        >
                          {m.enabled ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMemory(m.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 9. CLOUD & LOCAL BACKEND */}
          {/* ========================================================================= */}
          {activeTab === 'backend' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-4">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#FFC928]" />
                  <span>Cloud + Local Architecture</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#C5A059] mb-1">Primary Cloud Endpoint (Render)</label>
                    <input
                      type="text"
                      value={settings.cloudLocal.primaryUrl}
                      onChange={(e) => updateCloudLocal({ primaryUrl: e.target.value.trim() })}
                      className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#C5A059] mb-1">Local Backup Endpoint (Termux Localhost)</label>
                    <input
                      type="text"
                      value={settings.cloudLocal.backupUrl}
                      onChange={(e) => updateCloudLocal({ backupUrl: e.target.value.trim() })}
                      className="w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="text-xs text-white/70">
                    Active Connection: <span className="text-[#FFC928] font-mono">{backendStatus?.resolvedUrl || 'Auto-Resolved'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onRefreshBackend}
                    className="px-3 py-1.5 rounded-lg bg-[#FFC928] text-black font-semibold text-xs inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ping &amp; Health Check</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 10. SECURITY & PERMISSIONS */}
          {/* ========================================================================= */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#C5A059]">Transparent Permission Manager</div>
                <div className="space-y-2 text-xs">
                  {[
                    { name: 'Microphone', status: permissions.microphone, action: () => requestMicrophonePermission() },
                    { name: 'Camera', status: permissions.camera, action: () => requestCameraPermission() },
                    { name: 'Notifications', status: permissions.notifications, action: () => requestNotificationPermission() },
                    { name: 'Contacts', status: permissions.contacts || 'prompt', action: () => requestContactsPermission() },
                    { name: 'Phone Calls', status: permissions.phone || 'prompt', action: () => requestPhonePermission() },
                  ].map((perm) => (
                    <div key={perm.name} className="p-2.5 rounded bg-black border border-white/10 flex items-center justify-between">
                      <span className="text-white">{perm.name}</span>
                      {perm.status === 'granted' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Granted
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await perm.action();
                            onRefreshPermissions();
                          }}
                          className="px-2.5 py-1 rounded bg-[#FFC928] text-black font-semibold text-[11px]"
                        >
                          Request
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Permissions */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold">Special Android Roles &amp; Permissions</div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-black border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Default Assistant Role · <span className={permissions.defaultAssistant === 'active' ? 'text-emerald-400' : 'text-amber-300'}>{permissions.defaultAssistant === 'active' ? 'Active' : 'Not selected'}</span></div>
                      <div className="text-[10px] text-white/50">Allow JARVIS to respond to supported Android assistant gestures.</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (Capacitor.isNativePlatform()) {
                          await JarvisNativeDevice.requestDefaultAssistant();
                          onRefreshPermissions();
                        }
                      }}
                      className="px-2.5 py-1 rounded border border-[#FFC928]/40 text-[#FFC928] text-[11px]"
                    >
                      Configure
                    </button>
                  </div>

                  <div className="p-2.5 rounded bg-black border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Notification Access · <span className={permissions.notificationListener === 'enabled' ? 'text-emerald-400' : 'text-amber-300'}>{permissions.notificationListener === 'enabled' ? 'Enabled' : 'Not enabled'}</span></div>
                      <div className="text-[10px] text-white/50">Read supported notifications for summaries. Sensitive finance and authenticator apps are excluded.</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (Capacitor.isNativePlatform()) {
                          await JarvisNativeDevice.openNotificationListenerSettings();
                          onRefreshPermissions();
                        }
                      }}
                      className="px-2.5 py-1 rounded border border-[#FFC928]/40 text-[#FFC928] text-[11px]"
                    >
                      Configure
                    </button>
                  </div>

                  <div className="p-2.5 rounded bg-black border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Device Administrator</div>
                      <div className="text-[10px] text-white/50">Permits JARVIS to lock phone screen upon user voice command</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (Capacitor.isNativePlatform()) {
                          JarvisNativeDevice.requestDeviceAdmin();
                        }
                      }}
                      className="px-2.5 py-1 rounded border border-[#FFC928]/40 text-[#FFC928] text-[11px]"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 11. DIAGNOSTICS */}
          {/* ========================================================================= */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6">
              <DeveloperModePanel backendUrl={getBackendBaseUrl(settings)} />

              {/* Interaction Latency Metrics */}
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-[#FFC928]/30 space-y-3">
                <div className="text-xs uppercase tracking-wider text-[#FFC928] font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FFC928]" />
                  <span>Interaction Latency Diagnostics</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-center">
                  <div className="p-2.5 rounded bg-black border border-white/10">
                    <div className="text-white/50 text-[10px]">STT Processing</div>
                    <div className="text-sm font-semibold text-[#FFC928] mt-1 font-mono">
                      {latencyMetrics?.sttLatencyMs || 0} ms
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-black border border-white/10">
                    <div className="text-white/50 text-[10px]">AI First-Token</div>
                    <div className="text-sm font-semibold text-[#FFC928] mt-1 font-mono">
                      {latencyMetrics?.aiFirstTokenMs || 0} ms
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-black border border-white/10">
                    <div className="text-white/50 text-[10px]">TTS First-Audio</div>
                    <div className="text-sm font-semibold text-[#FFC928] mt-1 font-mono">
                      {latencyMetrics?.ttsFirstAudioMs || 0} ms
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-black border border-white/10">
                    <div className="text-white/50 text-[10px]">Total Turn Roundtrip</div>
                    <div className="text-sm font-semibold text-[#FFC928] mt-1 font-mono">
                      {latencyMetrics?.totalTurnMs || 0} ms
                    </div>
                  </div>
                </div>
              </div>

              {/* Rendering & Storage Diagnostics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-1.5">
                  <div className="text-[#C5A059] uppercase tracking-wider text-[10px]">3D Orb Shaders</div>
                  <div className="text-white font-medium">{renderTelemetry.fps} FPS · {renderTelemetry.nodes} nodes · {renderTelemetry.filaments} filaments</div>
                </div>

                <div className="p-3 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-1.5">
                  <div className="text-[#C5A059] uppercase tracking-wider text-[10px]">Local Persistence</div>
                  <div className="text-white font-medium">{(storageStats.bytesUsed / 1024).toFixed(2)} KB · {storageStats.itemCount} items</div>
                </div>
              </div>

              {/* Reset All Data */}
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Wipe All Data</span>
                </div>
                {!confirmWipe ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold"
                  >
                    Wipe Local Storage Data...
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onWipeAll();
                        setConfirmWipe(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    >
                      Confirm Wipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(false)}
                      className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-white/70"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* APPEARANCE & ORB */}
          {/* ========================================================================= */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-[#0B0B0B] border border-white/10 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[#C5A059]">Golden Orb Intensity</span>
                  <span className="text-[#FFC928]">{settings.appearance.goldIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={settings.appearance.goldIntensity}
                  onChange={(e) => updateAppearance({ goldIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-[#FFC928]"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Orb Rings</div>
                    <div className="text-[11px] text-white/50">Display orbital rings around the golden core</div>
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
                    <div className="text-xs font-medium text-white">Network Filaments</div>
                    <div className="text-[11px] text-white/50">Render synaptic connections between neural nodes</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.showNetworkFilaments}
                    onChange={(e) => updateAppearance({ showNetworkFilaments: e.target.checked })}
                    className="w-4 h-4 accent-[#FFC928]"
                  />
                </label>

                <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0B0B] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Reduced Motion</div>
                    <div className="text-[11px] text-white/50">Minimize camera drift and particle velocities</div>
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
        </div>
      </div>
    </div>
  );
};

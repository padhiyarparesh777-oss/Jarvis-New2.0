import {
  JarvisSettings,
  ChatMessage,
  ChatThread,
  MemoryFact,
  DeviceActionResult,
  PlannerTask,
  AutomationRoutine,
  AutomationLog,
} from '../../types/jarvis';

const STORAGE_KEYS = {
  SETTINGS: 'jarvis_ai_settings_v2',
  THREADS: 'jarvis_ai_threads_v2',
  LEGACY_HISTORY: 'jarvis_ai_history_v1',
  MEMORIES: 'jarvis_ai_memories_v2',
  ACTION_LOGS: 'jarvis_ai_device_logs_v1',
  PLANNER_TASKS: 'jarvis_ai_planner_tasks_v1',
  ROUTINES: 'jarvis_ai_routines_v1',
  AUTOMATION_LOGS: 'jarvis_ai_automation_logs_v1',
};

export const DEFAULT_SETTINGS: JarvisSettings = {
  aiBrain: {
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    fallbackModel: 'gemini-3.1-flash-lite',
    responseStyle: 'natural',
    personality: 'executive',
    temperature: 0.7,
    thinkingLevel: 'LOW',
    streamingEnabled: true,
    webSearchGrounding: true,
  },
  voiceSpeech: {
    language: 'auto',
    voiceEngine: 'gemini-tts',
    geminiVoice: 'Charon',
    speechSpeed: 1.0,
    autoListenFollowUp: false,
    touchToSpeakMode: 'tap-toggle',
    voiceOutputEnabled: true,
    wakeWordForegroundActive: false,
  },
  phoneControl: {
    enabled: true,
    confirmSensitiveActions: true,
    accessibilityBridgeEnabled: false,
    preferNativeIntents: true,
    whatsappIntegrationEnabled: true,
  },
  screenVision: {
    autoAnalyzeOnCapture: true,
    includeUiCoordinates: true,
    highDetailVision: true,
  },
  chatInterface: {
    enterToSend: true,
    showInlineDrawerOnReply: false,
    showTimestamps: true,
    maxUploadSizeMb: 15,
  },
  memory: {
    enabled: true,
    saveHistory: true,
    autoExtractFacts: true,
    maxContextMessages: 16,
  },
  appearance: {
    goldIntensity: 1.0,
    animationQuality: 'ultra',
    performanceMode: 'auto',
    reducedMotion: false,
    showSubtleCaptions: true,
    showOrbRings: true,
    showNetworkFilaments: true,
    showHolographicParticles: true,
  },
  notifications: {
    remindersEnabled: true,
    soundAlertsEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
  privacy: {
    localEncryptionIndicator: true,
    ephemeralSession: false,
    telemetryEnabled: false,
  },
};

export const INITIAL_MEMORIES: MemoryFact[] = [
  {
    id: 'mem-default-1',
    fact: 'Supports fluent English, Hindi (हिन्दी), Hinglish, and Gujarati (ગુજરાતી) conversation.',
    category: 'language',
    enabled: true,
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'mem-default-2',
    fact: 'Prefers direct, calm, futuristic responses with verified tool execution.',
    category: 'preference',
    enabled: true,
    createdAt: Date.now() - 43200000,
  },
];

export const INITIAL_ROUTINES: AutomationRoutine[] = [
  {
    id: 'routine-work-mode',
    name: 'Work Mode',
    description: 'Activates a focused 25-minute Pomodoro timer, enables Concise Tactical response style, and summarizes active daily tasks.',
    triggerPhrase: 'Start Work Mode',
    steps: [
      'Switch AI response style to Concise Tactical',
      'Start 25-minute Focus Timer (1500s)',
      'Verify pending Smart Planner tasks and read briefing',
    ],
    enabled: true,
  },
  {
    id: 'routine-morning-brief',
    name: 'Morning Briefing',
    description: 'Checks live device battery/network status and reviews today’s scheduled tasks and reminders.',
    triggerPhrase: 'Morning Briefing',
    steps: [
      'Read device battery and connectivity telemetry',
      'Review today’s active reminders and tasks',
    ],
    enabled: true,
  },
];

export const INITIAL_TASKS: PlannerTask[] = [
  {
    id: 'task-init-1',
    title: 'Review Android APK build & permission configuration',
    dueTime: 'Today 18:00',
    completed: false,
    category: 'task',
    createdAt: Date.now() - 3600000,
  },
];

export const memoryRepository = {
  loadSettings(): JarvisSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw);
      const rawProvider = parsed.aiBrain?.provider;
      const normalizedProvider =
        rawProvider === 'free-unlimited' || rawProvider === 'auto-hybrid'
          ? rawProvider
          : 'auto-hybrid';
      const rawVoice = parsed.voiceSpeech?.geminiVoice;
      const validMaleVoice =
        rawVoice === 'Charon' || rawVoice === 'Fenrir' || rawVoice === 'Puck'
          ? rawVoice
          : 'Charon';
      return {
        aiBrain: {
          ...DEFAULT_SETTINGS.aiBrain,
          ...(parsed.aiBrain || {}),
          provider: normalizedProvider,
        },
        voiceSpeech: {
          ...DEFAULT_SETTINGS.voiceSpeech,
          ...(parsed.voiceSpeech || {}),
          voiceEngine: 'gemini-tts',
          geminiVoice: validMaleVoice,
        },
        phoneControl: { ...DEFAULT_SETTINGS.phoneControl, ...(parsed.phoneControl || {}) },
        screenVision: { ...DEFAULT_SETTINGS.screenVision, ...(parsed.screenVision || {}) },
        chatInterface: { ...DEFAULT_SETTINGS.chatInterface, ...(parsed.chatInterface || {}) },
        memory: { ...DEFAULT_SETTINGS.memory, ...(parsed.memory || {}) },
        appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
        privacy: { ...DEFAULT_SETTINGS.privacy, ...(parsed.privacy || {}) },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: JarvisSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  },

  loadThreads(): ChatThread[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.THREADS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      // Migrate legacy single-thread history if present
      const legacyRaw = localStorage.getItem(STORAGE_KEYS.LEGACY_HISTORY);
      const legacyMsgs: ChatMessage[] = legacyRaw ? JSON.parse(legacyRaw) : [];
      const initialThread: ChatThread = {
        id: 'thread-primary',
        title: legacyMsgs.length > 0 ? legacyMsgs[0].content.slice(0, 36) : 'Primary Session',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: legacyMsgs,
      };
      return [initialThread];
    } catch {
      return [
        {
          id: 'thread-primary',
          title: 'Primary Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        },
      ];
    }
  },

  saveThreads(threads: ChatThread[], ephemeral = false): void {
    if (ephemeral) return;
    try {
      // Strip heavy base64 preview URLs before persisting to localStorage to avoid quota overflow
      const compactThreads = threads.slice(0, 30).map((t) => ({
        ...t,
        messages: t.messages.slice(-80).map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({
            id: a.id,
            name: a.name,
            mimeType: a.mimeType,
            kind: a.kind,
          })),
        })),
      }));
      localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(compactThreads));
    } catch {
      // Ignore storage errors
    }
  },

  loadMemories(): MemoryFact[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.MEMORIES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(INITIAL_MEMORIES));
        return INITIAL_MEMORIES;
      }
      const parsed: MemoryFact[] = JSON.parse(raw);
      return parsed.map((m) => ({ ...m, enabled: m.enabled ?? true }));
    } catch {
      return INITIAL_MEMORIES;
    }
  },

  saveMemories(memories: MemoryFact[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories));
    } catch {
      // Ignore
    }
  },

  /**
   * Relevant context retrieval: selects enabled memories that match the user query keywords
   * plus core language/preference facts, rather than sending every stored entry blindly.
   */
  retrieveRelevantMemories(query: string, memories: MemoryFact[], maxItems = 8): string[] {
    const enabledList = memories.filter((m) => m.enabled !== false);
    if (enabledList.length === 0) return [];

    const qTokens = query
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);

    const scored = enabledList.map((m) => {
      const textLower = m.fact.toLowerCase();
      let score = m.category === 'language' || m.category === 'preference' ? 2 : 1;
      for (const tok of qTokens) {
        if (textLower.includes(tok)) score += 3;
      }
      return { fact: `[${m.category}] ${m.fact}`, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxItems).map((s) => s.fact);
  },

  loadPlannerTasks(): PlannerTask[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLANNER_TASKS);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.PLANNER_TASKS, JSON.stringify(INITIAL_TASKS));
        return INITIAL_TASKS;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_TASKS;
    }
  },

  savePlannerTasks(tasks: PlannerTask[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PLANNER_TASKS, JSON.stringify(tasks));
    } catch {
      // Ignore
    }
  },

  loadRoutines(): AutomationRoutine[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ROUTINES);
      if (!raw) {
        localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(INITIAL_ROUTINES));
        return INITIAL_ROUTINES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_ROUTINES;
    }
  },

  saveRoutines(routines: AutomationRoutine[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ROUTINES, JSON.stringify(routines));
    } catch {
      // Ignore
    }
  },

  loadAutomationLogs(): AutomationLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTOMATION_LOGS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveAutomationLogs(logs: AutomationLog[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTOMATION_LOGS, JSON.stringify(logs.slice(0, 50)));
    } catch {
      // Ignore
    }
  },

  loadActionLogs(): DeviceActionResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTION_LOGS);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveActionLogs(logs: DeviceActionResult[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTION_LOGS, JSON.stringify(logs.slice(0, 50)));
    } catch {
      // Ignore
    }
  },

  getStorageStats(): { bytesUsed: number; itemCount: number } {
    try {
      let bytes = 0;
      let count = 0;
      Object.values(STORAGE_KEYS).forEach((key) => {
        const val = localStorage.getItem(key);
        if (val) {
          bytes += val.length * 2;
          count++;
        }
      });
      return { bytesUsed: bytes, itemCount: count };
    } catch {
      return { bytesUsed: 0, itemCount: 0 };
    }
  },

  wipeAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore
    }
  },
};

export type InteractionState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'uploading'
  | 'error';

export type LanguageMode = 'auto' | 'en' | 'hi' | 'hinglish' | 'gu';

export type ResponseStyle = 'concise' | 'natural' | 'analytical';

export type PersonalityMode = 'tactical' | 'companion' | 'executive' | 'scholar';

export type VoiceEngineMode = 'gemini-tts';

export type GeminiVoiceName = 'Charon' | 'Fenrir' | 'Puck';

export type AnimationQuality = 'ultra' | 'balanced' | 'battery';

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'photo' | 'camera' | 'file' | 'pdf';
  dataBase64: string; // base64 payload without data:... prefix
  previewUrl?: string;
  textContent?: string;
  uploadProgress: number; // 0 to 100
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  language?: string;
  attachments?: {
    id: string;
    name: string;
    mimeType: string;
    kind: ChatAttachment['kind'];
    previewUrl?: string;
  }[];
  groundingSources?: GroundingSource[];
  deviceAction?: DeviceActionResult;
  isError?: boolean;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface MemoryFact {
  id: string;
  fact: string;
  category: 'preference' | 'contact' | 'routine' | 'language';
  enabled: boolean;
  createdAt: number;
}

export interface PlannerTask {
  id: string;
  title: string;
  dueTime?: string;
  completed: boolean;
  category: 'task' | 'reminder' | 'schedule';
  createdAt: number;
}

export interface AutomationRoutine {
  id: string;
  name: string;
  description: string;
  triggerPhrase: string;
  steps: string[];
  enabled: boolean;
  lastRunAt?: number;
}

export interface AutomationLog {
  id: string;
  routineName: string;
  status: 'completed' | 'skipped_quiet_hours' | 'failed';
  detail: string;
  timestamp: number;
}

export interface JarvisSettings {
  aiBrain: {
    provider: 'auto-hybrid' | 'free-unlimited' | 'gemini';
    model: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite';
    fallbackModel: 'gemini-3.1-flash-lite' | 'gemini-3.8-flash';
    responseStyle: ResponseStyle;
    personality: PersonalityMode;
    temperature: number;
    thinkingLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    streamingEnabled: boolean;
    webSearchGrounding: boolean;
  };
  voiceSpeech: {
    language: LanguageMode;
    voiceEngine: VoiceEngineMode;
    geminiVoice: GeminiVoiceName;
    speechSpeed: number;
    autoListenFollowUp: boolean;
    touchToSpeakMode: 'tap-toggle' | 'hold-to-talk';
    voiceOutputEnabled: boolean;
    wakeWordForegroundActive: boolean;
  };
  phoneControl: {
    enabled: boolean;
    confirmSensitiveActions: boolean;
    accessibilityBridgeEnabled: boolean;
    preferNativeIntents: boolean;
    whatsappIntegrationEnabled: boolean;
  };
  screenVision: {
    autoAnalyzeOnCapture: boolean;
    includeUiCoordinates: boolean;
    highDetailVision: boolean;
  };
  chatInterface: {
    enterToSend: boolean;
    showInlineDrawerOnReply: boolean;
    showTimestamps: boolean;
    maxUploadSizeMb: number;
  };
  memory: {
    enabled: boolean;
    saveHistory: boolean;
    autoExtractFacts: boolean;
    maxContextMessages: number;
  };
  appearance: {
    goldIntensity: number; // 0.4 to 1.5
    animationQuality: AnimationQuality;
    performanceMode: 'auto' | '60fps' | 'power-saver';
    reducedMotion: boolean;
    showSubtleCaptions: boolean;
    showOrbRings: boolean;
    showNetworkFilaments: boolean;
    showHolographicParticles: boolean;
  };
  notifications: {
    remindersEnabled: boolean;
    soundAlertsEnabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string; // "22:00"
    quietHoursEnd: string; // "07:00"
  };
  privacy: {
    localEncryptionIndicator: boolean;
    ephemeralSession: boolean;
    telemetryEnabled: boolean;
  };
}

export type DeviceActionType =
  | 'OPEN_APP'
  | 'SET_ALARM'
  | 'SET_TIMER'
  | 'DIAL_NUMBER'
  | 'SEND_SMS'
  | 'SEND_WHATSAPP'
  | 'OPEN_SETTINGS'
  | 'CHECK_DEVICE_STATUS'
  | 'NAVIGATE_SCREEN'
  | 'WEB_SEARCH_INTENT';

export interface DeviceActionRequest {
  actionType: DeviceActionType;
  targetApp?: string;
  alarmHour?: number;
  alarmMinute?: number;
  timerSeconds?: number;
  label?: string;
  phoneNumberOrContact?: string;
  navigationGesture?: 'BACK' | 'HOME' | 'SCROLL_DOWN' | 'SCROLL_UP' | 'TAP';
  requiresConfirmation?: boolean;
}

export interface DeviceActionResult {
  id: string;
  request: DeviceActionRequest;
  status:
    | 'confirmed'
    | 'intent_dispatched'
    | 'awaiting_confirmation'
    | 'permission_missing'
    | 'unsupported';
  title: string;
  detail: string;
  androidIntentUri?: string;
  timestamp: number;
}

export interface PermissionStatusMap {
  microphone: 'granted' | 'denied' | 'prompt' | 'unsupported';
  camera: 'granted' | 'denied' | 'prompt' | 'unsupported';
  notifications: 'granted' | 'denied' | 'prompt' | 'unsupported';
  screenCapture: 'active' | 'ready' | 'unsupported';
  androidIntents: 'ready' | 'simulated_web';
  accessibilityService: 'authorized' | 'unauthorized';
  wakeLock: 'supported' | 'unsupported';
}

export interface ActiveTimerOrAlarm {
  id: string;
  type: 'alarm' | 'timer';
  label: string;
  targetTimeMs: number;
  remainingSeconds: number;
  triggered: boolean;
}

export interface BackendStatus {
  configured: boolean;
  provider: string;
  models: string[];
  ttsModel: string;
  transcribeModel: string;
  message: string;
}

export interface AudioReactionMetrics {
  rmsEnergy: number;
  wordEnvelope: number;
  syllableEnvelope: number;
  emphasisLevel: number;
  wordAttackImpulse: number;
}

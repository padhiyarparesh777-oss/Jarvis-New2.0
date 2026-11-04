import { Capacitor } from '@capacitor/core';
import {
  BackendStatus,
  ChatAttachment,
  ChatMessage,
  DeviceActionRequest,
  GroundingSource,
  JarvisSettings,
  MemoryFact,
} from '../../types/jarvis';
import { memoryRepository } from '../memory/memoryRepository';

export interface PlannerToolAction {
  operation: 'ADD_TASK' | 'ADD_REMINDER' | 'RUN_ROUTINE';
  title: string;
  dueTime?: string;
}

export interface StreamCallbacks {
  onTextDelta: (delta: string, fullText: string) => void;
  onDeviceAction?: (request: DeviceActionRequest) => void;
  onMemorySaved?: (fact: string, category: MemoryFact['category']) => void;
  onPlannerAction?: (action: PlannerToolAction) => void;
  onGroundingSources?: (sources: GroundingSource[]) => void;
  onFirstToken?: (latencyMs: number) => void;
  onComplete: (fullText: string) => void;
  onError: (errorMessage: string, errorCode?: string) => void;
}

const PRIMARY_CLOUD_URL = 'https://jarvis-ai-backend-pdy8.onrender.com';
const BACKUP_LOCAL_URL = 'http://127.0.0.1:3000';

let currentFailoverEndpoint: string | null = null;
let lastCloudProbeTime = 0;

export function getBackendBaseUrl(settings?: JarvisSettings): string {
  // 1. Explicit user setting has highest priority
  const configured = settings?.aiBrain?.backendUrl?.trim();
  if (configured) {
    const sanitized = !/^https?:\/\//i.test(configured) ? `http://${configured}` : configured;
    return sanitized.replace(/\/+$/, '');
  }

  // 2. Active failover endpoint
  if (currentFailoverEndpoint) {
    return currentFailoverEndpoint;
  }

  // 3. Settings cloudLocal primary
  const primary = settings?.cloudLocal?.primaryUrl?.trim();
  if (primary) {
    const sanitized = !/^https?:\/\//i.test(primary) ? `http://${primary}` : primary;
    return sanitized.replace(/\/+$/, '');
  }

  // 4. Default to Render cloud primary
  return PRIMARY_CLOUD_URL;
}

class JarvisAIService {
  private abortController: AbortController | null = null;

  getEndpoint(path: string, settings?: JarvisSettings): string {
    const base = getBackendBaseUrl(settings);
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return base ? `${base}${cleanPath}` : cleanPath;
  }

  async checkStatus(settings?: JarvisSettings): Promise<BackendStatus> {
    const targetUrl = this.getEndpoint('/api/ai/status', settings);
    try {
      const startTime = Date.now();
      const response = await fetch(targetUrl);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${targetUrl}`);
      }

      const data = await response.json();
      return {
        ...data,
        latencyMs,
        resolvedUrl: targetUrl,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to reach AI backend.';
      return {
        configured: false,
        provider: 'Unavailable',
        models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
        ttsModel: 'gemini-3.8-flash-lite-tts',
        transcribeModel: 'gemini-3.5-transcribe',
        message: `${errorMsg} (Target: ${targetUrl || 'Same-Origin'}). If running in Termux, verify 'npm run dev' or configure your Render backend URL in Settings > AI Brain.`,
        resolvedUrl: targetUrl,
      };
    }
  }

  cancelActiveRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async streamConversation(
    history: ChatMessage[],
    attachments: ChatAttachment[],
    settings: JarvisSettings,
    memories: MemoryFact[],
    permissionsSummary: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    this.cancelActiveRequest();
    this.abortController = new AbortController();

    const maxContext = settings.memory.maxContextMessages || 16;
    const recentMessages = history.slice(-maxContext).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const latestQuery = recentMessages[recentMessages.length - 1]?.content || '';
    const relevantMemories = settings.memory.enabled
      ? memoryRepository.retrieveRelevantMemories(latestQuery, memories, 8)
      : [];

    const payload = {
      provider: settings.aiBrain.provider,
      messages: recentMessages,
      attachments: attachments.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        dataBase64: a.dataBase64,
        textContent: a.textContent,
      })),
      model: settings.aiBrain.model,
      fallbackModel: settings.aiBrain.fallbackModel,
      temperature: settings.aiBrain.temperature,
      thinkingLevel: settings.aiBrain.thinkingLevel,
      language: settings.voiceSpeech.language,
      responseStyle: settings.aiBrain.responseStyle,
      personality: settings.aiBrain.personality,
      addressPreference: settings.personality?.addressPreference || 'adaptive',
      emotionMode: settings.personality?.emotionMode || 'adaptive',
      memories: relevantMemories,
      permissionsSummary,
      webSearchGrounding: settings.aiBrain.webSearchGrounding,
      stream: settings.aiBrain.streamingEnabled,
    };

    const targetUrl = this.getEndpoint('/api/ai/chat', settings);
    const requestStart = Date.now();
    let firstTokenRecorded = false;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        let errJson: { error?: string; message?: string } = {};
        try {
          errJson = await response.json();
        } catch {
          // ignore
        }
        callbacks.onError(
          errJson.message || `AI service returned HTTP ${response.status}`,
          errJson.error || 'HTTP_ERROR'
        );
        return;
      }

      if (!settings.aiBrain.streamingEnabled) {
        const data = await response.json();
        const fullText = data.text || '';
        callbacks.onFirstToken?.(Date.now() - requestStart);
        if (Array.isArray(data.functionCalls)) {
          for (const fc of data.functionCalls) {
            this.handleFunctionCall(fc, callbacks);
          }
        }
        callbacks.onTextDelta(fullText, fullText);
        callbacks.onComplete(fullText);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback for environments lacking ReadableStream getReader
        const text = await response.text();
        callbacks.onFirstToken?.(Date.now() - requestStart);
        callbacks.onTextDelta(text, text);
        callbacks.onComplete(text);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.replace(/^data:\s*/, '');
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'text' && event.delta) {
                if (!firstTokenRecorded) {
                  firstTokenRecorded = true;
                  callbacks.onFirstToken?.(Date.now() - requestStart);
                }
                accumulatedText += event.delta;
                callbacks.onTextDelta(event.delta, accumulatedText);
              } else if (event.type === 'function_call' && event.call) {
                this.handleFunctionCall(event.call, callbacks);
              } else if (event.type === 'grounding' && Array.isArray(event.sources)) {
                callbacks.onGroundingSources?.(event.sources);
              } else if (event.type === 'error') {
                callbacks.onError(event.message || 'Streaming error occurred.');
                return;
              }
            } catch {
              // Ignore malformed chunk
            }
          }
        }
      }

      callbacks.onComplete(accumulatedText.trim());
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      // Automatic local fallback if primary cloud is down and not already on backup
      if (targetUrl.includes('onrender.com') && currentFailoverEndpoint !== BACKUP_LOCAL_URL) {
        currentFailoverEndpoint = BACKUP_LOCAL_URL;
        const fallbackUrl = `${BACKUP_LOCAL_URL}/api/ai/chat`;
        try {
          const retryResp = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: this.abortController?.signal,
          });
          if (retryResp.ok) {
            const data = await retryResp.json();
            const text = data.text || '';
            callbacks.onTextDelta(text, text);
            callbacks.onComplete(text);
            return;
          }
        } catch {
          // Both failed
        }
      }

      const rawMsg = err instanceof Error ? err.message : 'Network connection interrupted.';
      callbacks.onError(
        `Failed to connect to backend (${targetUrl}): ${rawMsg}. Verify your Termux/Render server status in Settings > AI Brain.`,
        'NETWORK_ERROR'
      );
    } finally {
      this.abortController = null;
    }
  }

  private handleFunctionCall(
    fc: { name?: string; args?: Record<string, unknown> },
    callbacks: StreamCallbacks
  ): void {
    if (!fc || !fc.name || !fc.args) return;

    if (fc.name === 'executeDeviceAction' && callbacks.onDeviceAction) {
      callbacks.onDeviceAction({
        actionType: (fc.args.actionType as DeviceActionRequest['actionType']) || 'OPEN_APP',
        targetApp: fc.args.targetApp as string | undefined,
        alarmHour: fc.args.alarmHour as number | undefined,
        alarmMinute: fc.args.alarmMinute as number | undefined,
        timerSeconds: fc.args.timerSeconds as number | undefined,
        label: fc.args.label as string | undefined,
        phoneNumberOrContact: fc.args.phoneNumberOrContact as string | undefined,
        navigationGesture: fc.args.navigationGesture as DeviceActionRequest['navigationGesture'],
        requiresConfirmation: Boolean(fc.args.requiresConfirmation),
      });
    } else if (fc.name === 'saveUserMemory' && callbacks.onMemorySaved) {
      const fact = String(fc.args.fact || '').trim();
      const rawCat = String(fc.args.category || 'preference').toLowerCase();
      const validCat: MemoryFact['category'] = ['preference', 'contact', 'routine', 'language'].includes(
        rawCat
      )
        ? (rawCat as MemoryFact['category'])
        : 'preference';
      if (fact) {
        callbacks.onMemorySaved(fact, validCat);
      }
    } else if (fc.name === 'managePlannerItem' && callbacks.onPlannerAction) {
      const op = String(fc.args.operation || 'ADD_TASK') as PlannerToolAction['operation'];
      const title = String(fc.args.title || '').trim();
      if (title) {
        callbacks.onPlannerAction({
          operation: op,
          title,
          dueTime: fc.args.dueTime as string | undefined,
        });
      }
    }
  }

  async analyzeScreenImage(
    imageBase64: string,
    mimeType: string,
    prompt?: string,
    settings?: JarvisSettings
  ): Promise<string> {
    const url = this.getEndpoint('/api/ai/screen-analyze', settings);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType, prompt }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Screen analysis failed');
    }

    const data = await response.json();
    return (data.analysis || '').trim();
  }

  async transcribeAudio(
    audioBase64: string,
    mimeType: string,
    language: string,
    settings?: JarvisSettings
  ): Promise<string> {
    const url = this.getEndpoint('/api/ai/transcribe', settings);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType, language }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Audio transcription failed');
    }

    const data = await response.json();
    return (data.transcript || '').trim();
  }

  async synthesizeSpeech(
    text: string,
    voiceName: string,
    language = 'auto',
    settings?: JarvisSettings
  ): Promise<string> {
    const url = this.getEndpoint('/api/ai/tts', settings);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceName,
        language,
        voiceEngine: settings?.voiceSpeech?.voiceEngine || 'elevenlabs',
        speed: settings?.voiceSpeech?.speechSpeed || 1.0,
        elevenLabs: settings?.voiceSpeech?.elevenLabs,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Neural TTS request failed');
    }

    const data = await response.json();
    return data.audioBase64 || '';
  }

  async getVoiceDiagnostics(settings?: JarvisSettings): Promise<Record<string, unknown>> {
    try {
      const url = this.getEndpoint('/api/ai/tts/diagnostics', settings);
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Ignore
    }
    return {
      elevenlabs: { configured: false },
      edgeNeural: { configured: true },
    };
  }
}

export const aiService = new JarvisAIService();

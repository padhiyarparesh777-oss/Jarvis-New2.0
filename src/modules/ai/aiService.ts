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
  onComplete: (fullText: string) => void;
  onError: (errorMessage: string, errorCode?: string) => void;
}

class JarvisAIService {
  private abortController: AbortController | null = null;

  async checkStatus(): Promise<BackendStatus> {
    try {
      const response = await fetch('/api/ai/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      return {
        configured: false,
        provider: 'Google Gemini',
        models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
        ttsModel: 'gemini-3.8-flash-lite-tts',
        transcribeModel: 'gemini-3.5-transcribe',
        message: err instanceof Error ? err.message : 'Unable to reach AI backend.',
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
      memories: relevantMemories,
      permissionsSummary,
      webSearchGrounding: settings.aiBrain.webSearchGrounding,
      stream: settings.aiBrain.streamingEnabled,
    };

    try {
      const response = await fetch('/api/ai/chat', {
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
        callbacks.onError('Streaming response body unavailable.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text' && event.delta) {
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
            // Ignore malformed SSE chunk
          }
        }
      }

      callbacks.onComplete(accumulatedText.trim());
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      callbacks.onError(
        err instanceof Error ? err.message : 'Network connection interrupted.',
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
    prompt?: string
  ): Promise<string> {
    const response = await fetch('/api/ai/screen-analyze', {
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
    language: string
  ): Promise<string> {
    const response = await fetch('/api/ai/transcribe', {
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
    language = 'auto'
  ): Promise<string> {
    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName, language }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Neural TTS request failed');
    }

    const data = await response.json();
    return data.audioBase64 || '';
  }
}

export const aiService = new JarvisAIService();

import {
  AudioReactionMetrics,
  EmotionMode,
  JarvisSettings,
  LanguageMode,
  VoiceEngineMode,
} from '../../types/jarvis';
import { aiService } from '../ai/aiService';

export interface TTSChunkItem {
  id: string;
  index: number;
  text: string;
  audioBuffer?: AudioBuffer;
  status: 'pending' | 'synthesizing' | 'ready' | 'playing' | 'done' | 'failed';
}

export interface VoicePlaybackCallbacks {
  onStart?: () => void;
  onSentenceStart?: (sentence: string, index: number) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export class VoiceEngine {
  private audioCtx: AudioContext | null = null;
  private ttsAnalyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isSpeakingFlag = false;

  // Ordered Queue for Fast Chunked Streaming Speech
  private sentenceQueue: TTSChunkItem[] = [];
  private currentPlayingIndex = 0;
  private isProcessingQueue = false;
  private streamGenerationActive = false;
  private activeCallbacks: VoicePlaybackCallbacks | null = null;

  // In-memory cache for repeated phrases (Greetings, short answers, action confirmations)
  private audioCache = new Map<string, { base64: string; mimeType: string }>();
  private readonly MAX_CACHE_SIZE = 120;

  // High-resolution audio analysis buffers for Three.js Golden Orb reactivity
  private floatTimeData = new Float32Array(512);
  private byteTimeData = new Uint8Array(512);
  private freqData = new Uint8Array(256);
  private adaptivePeakCeiling = 0.22;
  private smoothedRms = 0;
  private wordEnvelope = 0;
  private syllableEnvelope = 0;
  private emphasisLevel = 0;
  private wordAttackImpulse = 0;
  private wasInWordPause = true;

  // Metrics
  private firstAudioDispatchedAt: number | null = null;
  private firstAudioPlayedAt: number | null = null;
  private lastTtsLatencyMs = 0;

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  getLiveAudioMetrics(): AudioReactionMetrics {
    if (!this.isSpeakingFlag || !this.ttsAnalyser) {
      this.wordEnvelope = Math.max(0, this.wordEnvelope * 0.85);
      this.syllableEnvelope = Math.max(0, this.syllableEnvelope * 0.85);
      this.smoothedRms = Math.max(0, this.smoothedRms * 0.85);
      this.wordAttackImpulse = Math.max(0, this.wordAttackImpulse * 0.8);
      return {
        rmsEnergy: this.smoothedRms,
        wordEnvelope: this.wordEnvelope,
        syllableEnvelope: this.syllableEnvelope,
        emphasisLevel: this.emphasisLevel,
        wordAttackImpulse: this.wordAttackImpulse,
      };
    }

    this.ttsAnalyser.getByteFrequencyData(this.freqData);

    let sumSquares = 0;
    if (typeof this.ttsAnalyser.getFloatTimeDomainData === 'function') {
      this.ttsAnalyser.getFloatTimeDomainData(this.floatTimeData);
      for (let i = 0; i < this.floatTimeData.length; i++) {
        const s = this.floatTimeData[i];
        sumSquares += s * s;
      }
      sumSquares /= this.floatTimeData.length;
    } else {
      this.ttsAnalyser.getByteTimeDomainData(this.byteTimeData);
      for (let i = 0; i < this.byteTimeData.length; i++) {
        const s = (this.byteTimeData[i] - 128) / 128;
        sumSquares += s * s;
      }
      sumSquares /= this.byteTimeData.length;
    }
    const rawRms = Math.sqrt(sumSquares);

    let formantSum = 0;
    for (let i = 3; i <= 48; i++) {
      formantSum += this.freqData[i];
    }
    const formantAvg = formantSum / (46 * 255);

    const rawSignal = rawRms < 0.012 ? 0 : rawRms;
    if (rawSignal > this.adaptivePeakCeiling) {
      this.adaptivePeakCeiling += (rawSignal - this.adaptivePeakCeiling) * 0.25;
    } else {
      this.adaptivePeakCeiling = Math.max(0.16, this.adaptivePeakCeiling * 0.9985);
    }

    const normalizedRms = Math.min(1.25, rawSignal / Math.max(0.14, this.adaptivePeakCeiling * 0.88));
    const expressiveLevel = Math.min(
      1.2,
      Math.pow(normalizedRms, 1.18) * 0.72 + Math.pow(formantAvg * 2.4, 1.25) * 0.42
    );

    const isPauseNow = expressiveLevel < 0.045;
    if (this.wasInWordPause && !isPauseNow && expressiveLevel > 0.08) {
      this.wordAttackImpulse = Math.min(1.0, 0.45 + expressiveLevel * 0.65);
      this.wasInWordPause = false;
    } else {
      this.wordAttackImpulse = Math.max(0, this.wordAttackImpulse * 0.78 - 0.02);
      if (isPauseNow) this.wasInWordPause = true;
    }

    if (expressiveLevel > this.wordEnvelope) {
      this.wordEnvelope += (expressiveLevel - this.wordEnvelope) * 0.55;
    } else {
      this.wordEnvelope += (expressiveLevel - this.wordEnvelope) * 0.18;
    }

    if (expressiveLevel > this.syllableEnvelope) {
      this.syllableEnvelope += (expressiveLevel - this.syllableEnvelope) * 0.75;
    } else {
      this.syllableEnvelope += (expressiveLevel - this.syllableEnvelope) * 0.35;
    }

    this.smoothedRms += (normalizedRms - this.smoothedRms) * 0.4;
    this.emphasisLevel = Math.min(1.0, normalizedRms * 0.5 + formantAvg * 0.85);

    return {
      rmsEnergy: this.smoothedRms,
      wordEnvelope: this.wordEnvelope,
      syllableEnvelope: this.syllableEnvelope,
      emphasisLevel: this.emphasisLevel,
      wordAttackImpulse: this.wordAttackImpulse,
    };
  }

  isSpeaking(): boolean {
    return this.isSpeakingFlag;
  }

  getLastTtsLatency(): number {
    return this.lastTtsLatencyMs;
  }

  /**
   * Prepares and starts a fast chunked voice session for a streaming AI turn.
   */
  startStreamingSession(callbacks: VoicePlaybackCallbacks): void {
    this.interrupt();
    this.sentenceQueue = [];
    this.currentPlayingIndex = 0;
    this.streamGenerationActive = true;
    this.isProcessingQueue = false;
    this.activeCallbacks = callbacks;
    this.firstAudioDispatchedAt = Date.now();
    this.firstAudioPlayedAt = null;
  }

  /**
   * Pushes a completed sentence or clause chunk immediately into the pipeline.
   * Begins synthesizing in the background while Gemini produces subsequent tokens.
   */
  enqueueSentenceChunk(
    sentence: string,
    settings: JarvisSettings,
    emotion: EmotionMode = 'adaptive'
  ): void {
    const clean = sentence.replace(/[*#`_~]/g, '').trim();
    if (!clean || !settings.voiceSpeech.voiceOutputEnabled) return;

    const chunkId = `chunk-${Date.now()}-${this.sentenceQueue.length}`;
    const chunkItem: TTSChunkItem = {
      id: chunkId,
      index: this.sentenceQueue.length,
      text: clean,
      status: 'pending',
    };
    this.sentenceQueue.push(chunkItem);

    // Asynchronously synthesize this chunk in background
    this.synthesizeChunk(chunkItem, settings, emotion);

    // Trigger queue player
    if (!this.isProcessingQueue) {
      this.processQueue(settings);
    }
  }

  /**
   * Signals that Gemini streaming has ended (no more sentence chunks will arrive for this turn).
   */
  finishStreamingSession(settings: JarvisSettings): void {
    this.streamGenerationActive = false;
    if (!this.isProcessingQueue) {
      this.processQueue(settings);
    }
  }

  /**
   * Synthesizes audio for a single chunk, with caching and fallback.
   */
  private async synthesizeChunk(
    item: TTSChunkItem,
    settings: JarvisSettings,
    emotion: EmotionMode
  ): Promise<void> {
    item.status = 'synthesizing';
    const cacheKey = `${settings.voiceSpeech.voiceEngine}_${settings.voiceSpeech.language}_${item.text}`;

    try {
      let base64Audio = '';

      if (this.audioCache.has(cacheKey)) {
        base64Audio = this.audioCache.get(cacheKey)!.base64;
      } else {
        base64Audio = await this.fetchSynthesisAudio(item.text, settings, emotion);
        if (base64Audio) {
          if (this.audioCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.audioCache.keys().next().value;
            if (firstKey) this.audioCache.delete(firstKey);
          }
          this.audioCache.set(cacheKey, { base64: base64Audio, mimeType: 'audio/mpeg' });
        }
      }

      if (base64Audio) {
        const ctx = this.ensureAudioContext();
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        item.audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        item.status = 'ready';
      } else {
        item.status = 'failed';
      }
    } catch {
      item.status = 'failed';
    }

    // Nudge queue playback if waiting for this chunk
    this.processQueue(settings);
  }

  /**
   * Sequentially plays through synthesized chunks in exact arrival order.
   */
  private async processQueue(settings: JarvisSettings): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.currentPlayingIndex < this.sentenceQueue.length) {
      const current = this.sentenceQueue[this.currentPlayingIndex];

      if (current.status === 'synthesizing' || current.status === 'pending') {
        // Wait briefly for current chunk to finish decoding
        await new Promise((r) => setTimeout(r, 60));
        continue;
      }

      if (current.status === 'ready' && current.audioBuffer) {
        current.status = 'playing';

        if (this.firstAudioPlayedAt === null && this.firstAudioDispatchedAt !== null) {
          this.firstAudioPlayedAt = Date.now();
          this.lastTtsLatencyMs = this.firstAudioPlayedAt - this.firstAudioDispatchedAt;
        }

        await this.playAudioBuffer(current.audioBuffer, settings, current.text, current.index);
        current.status = 'done';
        this.currentPlayingIndex++;
      } else {
        // Chunk failed or empty, skip to next chunk
        this.currentPlayingIndex++;
      }
    }

    this.isProcessingQueue = false;

    // Check if session completely finished
    if (!this.streamGenerationActive && this.currentPlayingIndex >= this.sentenceQueue.length) {
      this.isSpeakingFlag = false;
      this.activeCallbacks?.onEnd?.();
    }
  }

  private playAudioBuffer(
    buffer: AudioBuffer,
    settings: JarvisSettings,
    sentenceText: string,
    index: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const ctx = this.ensureAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = Math.min(1.5, Math.max(0.75, settings.voiceSpeech.speechSpeed));

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      this.currentSource = source;
      this.ttsAnalyser = analyser;
      this.isSpeakingFlag = true;

      if (index === 0) {
        this.activeCallbacks?.onStart?.();
      }
      this.activeCallbacks?.onSentenceStart?.(sentenceText, index);

      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
          this.ttsAnalyser = null;
        }
        resolve();
      };

      try {
        source.start(0);
      } catch {
        resolve();
      }
    });
  }

  /**
   * Fetches synthesis audio from backend using ElevenLabs, Edge Neural, or Gemini TTS.
   */
  private async fetchSynthesisAudio(
    text: string,
    settings: JarvisSettings,
    emotion: EmotionMode
  ): Promise<string> {
    const backendUrl = aiService.getEndpoint('/api/ai/tts', settings);
    const engine = settings.voiceSpeech.voiceEngine;

    const payload = {
      text,
      voiceEngine: engine,
      language: settings.voiceSpeech.language,
      voiceName: settings.voiceSpeech.geminiVoice,
      emotion,
      speed: settings.voiceSpeech.speechSpeed,
      elevenLabs: {
        enabled: settings.voiceSpeech.elevenLabs?.enabled ?? true,
        voiceId: settings.voiceSpeech.elevenLabs?.voiceId || 'pNInz6obpgDQGcFmaJgB',
        modelId: settings.voiceSpeech.elevenLabs?.modelId || 'eleven_multilingual_v2',
        stability: settings.voiceSpeech.elevenLabs?.stability ?? 0.52,
        similarityBoost: settings.voiceSpeech.elevenLabs?.similarityBoost ?? 0.82,
        style: settings.voiceSpeech.elevenLabs?.style ?? 0.35,
        useSpeakerBoost: settings.voiceSpeech.elevenLabs?.useSpeakerBoost ?? true,
        latencyMode: settings.voiceSpeech.elevenLabs?.latencyMode ?? 1,
      },
    };

    const resp = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error(`TTS HTTP ${resp.status}`);
    }

    const data = await resp.json();
    return data.audioBase64 || '';
  }

  /**
   * One-shot speak helper for complete text responses or test button.
   */
  async speakFullText(
    text: string,
    settings: JarvisSettings,
    callbacks: VoicePlaybackCallbacks,
    emotion: EmotionMode = 'adaptive'
  ): Promise<void> {
    this.interrupt();
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) {
      callbacks.onEnd?.();
      return;
    }

    this.startStreamingSession(callbacks);
    for (const s of sentences) {
      this.enqueueSentenceChunk(s, settings, emotion);
    }
    this.finishStreamingSession(settings);
  }

  /**
   * Immediately stops current audio playback, cancels pending queues, and aborts speech.
   */
  interrupt(): void {
    this.isSpeakingFlag = false;
    this.streamGenerationActive = false;
    this.isProcessingQueue = false;
    this.sentenceQueue = [];
    this.currentPlayingIndex = 0;

    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
      } catch {
        // Ignore
      }
      this.currentSource = null;
    }
    this.ttsAnalyser = null;
  }

  /**
   * Splits conversational text into natural sentence chunks for rapid streaming TTS.
   * Handles English punctuation (. ? !), Hindi/Gujarati danda (।), and newlines.
   */
  splitIntoSentences(text: string): string[] {
    const clean = text.replace(/[*#`_~]/g, '').trim();
    if (!clean) return [];

    // Split on sentence terminators: . ! ? । or double newline
    const rawMatches = clean.match(/[^.!?।\n]+[.!?।\n]+/g);
    if (!rawMatches || rawMatches.length === 0) {
      return [clean];
    }

    const sentences: string[] = [];
    let remainder = clean;

    for (const match of rawMatches) {
      const trimmed = match.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
      remainder = remainder.replace(match, '');
    }

    const tail = remainder.trim();
    if (tail.length > 0) {
      sentences.push(tail);
    }

    return sentences;
  }

  /**
   * Clears the in-memory audio cache.
   */
  clearCache(): void {
    this.audioCache.clear();
  }

  getCacheStats(): { size: number; max: number } {
    return { size: this.audioCache.size, max: this.MAX_CACHE_SIZE };
  }
}

export const voiceEngine = new VoiceEngine();

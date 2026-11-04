import { Capacitor } from '@capacitor/core';
import { AudioReactionMetrics, JarvisSettings, LanguageMode } from '../../types/jarvis';
import { aiService } from '../ai/aiService';
import { JarvisNativeDevice } from '../device/deviceControl';
import { voiceEngine } from './VoiceEngine';

interface SpeechRecognitionEventMap {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventMap) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechLocale(lang: LanguageMode): string {
  switch (lang) {
    case 'hi':
      return 'hi-IN';
    case 'gu':
      return 'gu-IN';
    case 'hinglish':
      return 'en-IN';
    case 'en':
      return 'en-US';
    case 'auto':
    default:
      return 'en-IN';
  }
}

class JarvisVoicePipeline {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private ttsAnalyser: AnalyserNode | null = null;
  private ttsSource: AudioBufferSourceNode | null = null;
  private recognition: SpeechRecognitionInstance | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isListeningFlag = false;
  private isSpeakingFlag = false;
  private nativeListeners: Array<{ remove: () => Promise<void> }> = [];
  private nativeRmsLevel = 0;
  private listeningSessionId = 0;

  // High-resolution time-domain and frequency buffers for real-time speech envelope extraction
  private floatTimeData = new Float32Array(512);
  private byteTimeData = new Uint8Array(512);
  private freqData = new Uint8Array(256);

  // Adaptive envelope followers for word-synced 3D cloud expansion & contraction
  private adaptivePeakCeiling = 0.22;
  private smoothedRms = 0;
  private wordEnvelope = 0;
  private syllableEnvelope = 0;
  private emphasisLevel = 0;
  private wordAttackImpulse = 0;
  private wasInWordPause = true;

  // Fallback word-boundary envelope state when browser native SpeechSynthesis is used
  private fallbackWordTarget = 0;
  private fallbackSyllableTime = 0;
  private fallbackWordEmphasis = 0.5;
  private boundaryPulseTimer: number | null = null;

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Computes real-time speech playback and microphone amplitude envelopes:
   * - rmsEnergy: instantaneous smoothed RMS amplitude
   * - wordEnvelope: expands smoothly when a word starts, scales with word loudness/duration, and returns to 0 during inter-word pauses
   * - syllableEnvelope: tracks rapid syllable inflections within words (contracting on softer syllables, expanding on louder syllables)
   * - emphasisLevel: measures vocal emphasis & formant power to distinguish short/soft words from loud/emphasized words
   * - wordAttackImpulse: detects word start boundaries after silence/pauses
   */
  getLiveAudioMetrics(): AudioReactionMetrics {
    if (voiceEngine.isSpeaking()) {
      return voiceEngine.getLiveAudioMetrics();
    }

    if (this.isListeningFlag && this.nativeRmsLevel > 0) {
      const level = Math.min(1.0, this.nativeRmsLevel);
      return {
        rmsEnergy: level,
        wordEnvelope: Math.min(1.0, level * 1.15),
        syllableEnvelope: level,
        emphasisLevel: level,
        wordAttackImpulse: level > 0.08 ? 0.75 : 0.0,
      };
    }

    const activeAnalyser =
      this.isSpeakingFlag && this.ttsAnalyser
        ? this.ttsAnalyser
        : this.isListeningFlag && this.micAnalyser
        ? this.micAnalyser
        : null;

    if (activeAnalyser) {
      activeAnalyser.getByteFrequencyData(this.freqData);

      // Compute exact time-domain RMS amplitude
      let sumSquares = 0;
      if (typeof activeAnalyser.getFloatTimeDomainData === 'function') {
        activeAnalyser.getFloatTimeDomainData(this.floatTimeData);
        for (let i = 0; i < this.floatTimeData.length; i++) {
          const sample = this.floatTimeData[i];
          sumSquares += sample * sample;
        }
        sumSquares /= this.floatTimeData.length;
      } else {
        activeAnalyser.getByteTimeDomainData(this.byteTimeData);
        for (let i = 0; i < this.byteTimeData.length; i++) {
          const sample = (this.byteTimeData[i] - 128) / 128;
          sumSquares += sample * sample;
        }
        sumSquares /= this.byteTimeData.length;
      }
      const rawRms = Math.sqrt(sumSquares);

      // Compute vocal formant power (300Hz - 3000Hz) to capture vowel emphasis accurately
      let formantSum = 0;
      const startBin = 3;
      const endBin = 48;
      for (let i = startBin; i <= endBin; i++) {
        formantSum += this.freqData[i];
      }
      const formantAvg = formantSum / ((endBin - startBin + 1) * 255);

      // Noise gate so inter-word pauses cleanly drop to 0.0
      const rawSignal = rawRms < 0.012 ? 0 : rawRms;

      // Adaptive dynamic range tracking (allows short/soft words to stay small and loud/emphasized words to expand larger)
      if (rawSignal > this.adaptivePeakCeiling) {
        this.adaptivePeakCeiling += (rawSignal - this.adaptivePeakCeiling) * 0.25;
      } else {
        this.adaptivePeakCeiling = Math.max(0.16, this.adaptivePeakCeiling * 0.9985);
      }

      const normalizedRms = Math.min(
        1.25,
        rawSignal / Math.max(0.14, this.adaptivePeakCeiling * 0.88)
      );

      // Apply non-linear dynamic curve so soft words/syllables produce subtle expansions and emphasized words produce strong expansions
      const expressiveLevel = Math.min(
        1.2,
        Math.pow(normalizedRms, 1.18) * 0.72 + Math.pow(formantAvg * 2.4, 1.25) * 0.42
      );

      // Detect word start after inter-word pause
      const isPauseNow = expressiveLevel < 0.045;
      if (this.wasInWordPause && !isPauseNow && expressiveLevel > 0.08) {
        this.wordAttackImpulse = Math.min(1.0, 0.45 + expressiveLevel * 0.65);
        this.wasInWordPause = false;
      } else if (isPauseNow) {
        this.wasInWordPause = true;
        this.wordAttackImpulse *= 0.78;
      } else {
        this.wordAttackImpulse *= 0.86;
      }

      // 1. Instantaneous smoothed RMS
      const rmsCoeff = expressiveLevel > this.smoothedRms ? 0.48 : 0.26;
      this.smoothedRms += (expressiveLevel - this.smoothedRms) * rmsCoeff;

      // 2. Fast Syllable Envelope: closely follows louder vs softer syllables inside a word
      const sylCoeff = expressiveLevel > this.syllableEnvelope ? 0.42 : 0.22;
      this.syllableEnvelope += (expressiveLevel - this.syllableEnvelope) * sylCoeff;

      // 3. Word-Level Expansion Envelope: smoothly expands when a word begins, grows with sustained word loudness,
      // and naturally contracts back toward 0 during pauses between words
      const wordTarget = isPauseNow ? 0 : expressiveLevel;
      const wordCoeff = wordTarget > this.wordEnvelope ? 0.24 : isPauseNow ? 0.16 : 0.12;
      this.wordEnvelope += (wordTarget - this.wordEnvelope) * wordCoeff;

      // 4. Emphasis Level: captures peak + sustained energy of the current word
      const empTarget = Math.min(1.2, expressiveLevel * 0.65 + this.wordEnvelope * 0.45);
      const empCoeff = empTarget > this.emphasisLevel ? 0.28 : 0.14;
      this.emphasisLevel += (empTarget - this.emphasisLevel) * empCoeff;

      return {
        rmsEnergy: Math.min(1, this.smoothedRms),
        wordEnvelope: Math.min(1.15, this.wordEnvelope),
        syllableEnvelope: Math.min(1.15, this.syllableEnvelope),
        emphasisLevel: Math.min(1.15, this.emphasisLevel),
        wordAttackImpulse: this.wordAttackImpulse,
      };
    }

    // Smooth organic return to zero when speech or listening stops
    this.wasInWordPause = true;
    this.smoothedRms *= 0.86;
    this.wordEnvelope *= 0.85;
    this.syllableEnvelope *= 0.85;
    this.emphasisLevel *= 0.85;
    this.wordAttackImpulse *= 0.8;

    return {
      rmsEnergy: this.smoothedRms < 0.002 ? 0 : this.smoothedRms,
      wordEnvelope: this.wordEnvelope < 0.002 ? 0 : this.wordEnvelope,
      syllableEnvelope: this.syllableEnvelope < 0.002 ? 0 : this.syllableEnvelope,
      emphasisLevel: this.emphasisLevel < 0.002 ? 0 : this.emphasisLevel,
      wordAttackImpulse: this.wordAttackImpulse < 0.002 ? 0 : this.wordAttackImpulse,
    };
  }

  getLiveAudioEnergy(): number {
    return this.getLiveAudioMetrics().rmsEnergy;
  }

  playSubtleTone(type: 'listen-start' | 'listen-end' | 'error' | 'alarm'): void {
    try {
      const ctx = this.ensureAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'listen-start') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.045, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.17);
      } else if (type === 'listen-end') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(460, now + 0.12);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.035, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'error') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(175, now + 0.22);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'alarm') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(528, now);
        osc.frequency.setValueAtTime(792, now + 0.18);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.46);
      }
    } catch {
      // Ignore audio context autoplay restrictions
    }
  }

  private async cleanupNativeListeners(): Promise<void> {
    for (const h of this.nativeListeners) {
      try {
        await h.remove();
      } catch {
        // Ignore
      }
    }
    this.nativeListeners = [];
    this.nativeRmsLevel = 0;
  }

  async startListening(
    settings: JarvisSettings,
    callbacks: {
      onInterimTranscript: (text: string) => void;
      onFinalTranscript: (text: string) => void;
      onError: (message: string, permissionDenied?: boolean) => void;
    }
  ): Promise<void> {
    this.stopSpeaking();
    this.stopListening();

    const currentSessionId = ++this.listeningSessionId;
    let finalized = false;
    let latestTranscript = '';

    const finalizeOnce = (transcript: string) => {
      if (finalized || this.listeningSessionId !== currentSessionId) return;
      finalized = true;
      this.playSubtleTone('listen-end');
      this.stopListening();
      callbacks.onFinalTranscript(transcript.trim());
    };

    const errorOnce = (message: string, isPermission = false) => {
      if (finalized || this.listeningSessionId !== currentSessionId) return;
      finalized = true;
      this.playSubtleTone('error');
      this.stopListening();
      callbacks.onError(message, isPermission);
    };

    // 1. Native Android SpeechRecognizer Bridge (Primary & Ultra-reliable on Android)
    if (Capacitor.isNativePlatform()) {
      try {
        const avail = await JarvisNativeDevice.isSpeechRecognitionAvailable().catch(() => ({ available: false }));
        if (avail && avail.available) {
          this.isListeningFlag = true;
          this.playSubtleTone('listen-start');

          const langLocale = getSpeechLocale(settings.voiceSpeech.language);
          await this.cleanupNativeListeners();

          const r1 = await JarvisNativeDevice.addListener('speechReady', () => {
            if (this.listeningSessionId !== currentSessionId) return;
            callbacks.onInterimTranscript('Listening...');
          });
          const r2 = await JarvisNativeDevice.addListener('speechStart', () => {
            if (this.listeningSessionId !== currentSessionId) return;
          });
          const r3 = await JarvisNativeDevice.addListener('speechRms', (ev) => {
            if (this.listeningSessionId !== currentSessionId) return;
            this.nativeRmsLevel = ev.rms;
          });
          const r4 = await JarvisNativeDevice.addListener('speechPartial', (ev) => {
            if (this.listeningSessionId !== currentSessionId) return;
            if (ev.transcript && ev.transcript.trim()) {
              latestTranscript = ev.transcript.trim();
              callbacks.onInterimTranscript(latestTranscript);
            }
          });
          const r5 = await JarvisNativeDevice.addListener('speechResult', (ev) => {
            if (this.listeningSessionId !== currentSessionId) return;
            const res = (ev.transcript || latestTranscript).trim();
            if (res) {
              finalizeOnce(res);
            } else {
              errorOnce('No speech detected. Please speak clearly or tap to retry.');
            }
          });
          const r6 = await JarvisNativeDevice.addListener('speechError', (ev) => {
            if (this.listeningSessionId !== currentSessionId) return;
            if (latestTranscript.trim()) {
              finalizeOnce(latestTranscript.trim());
              return;
            }
            if (ev.errorCode === 7 || ev.errorCode === 6) {
              errorOnce('No speech detected. Tap or hold to retry.');
            } else if (ev.errorCode === 9) {
              errorOnce('Microphone permission required for voice recognition.', true);
            } else {
              errorOnce(ev.error || 'Speech recognition failed. Tap to retry.');
            }
          });
          const r7 = await JarvisNativeDevice.addListener('speechEndOfSpeech', () => {
            if (this.listeningSessionId !== currentSessionId) return;
            if (latestTranscript.trim()) {
              callbacks.onInterimTranscript(latestTranscript);
            }
          });

          this.nativeListeners = [r1, r2, r3, r4, r5, r6, r7];
          await JarvisNativeDevice.startSpeechRecognition({ language: langLocale });
          return;
        }
      } catch (err) {
        console.warn('Native speech recognition fallback triggered:', err);
      }
    }

    // 2. Web Speech API + AudioRecorder fallback (For Web/Browser/Desktop environments)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        errorOnce('Microphone capture is not supported in this environment.', true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micStream = stream;
      this.isListeningFlag = true;
      this.playSubtleTone('listen-start');

      const ctx = this.ensureAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      this.micAnalyser = analyser;

      // MediaRecorder fallback in parallel for multimodal audio transcription
      this.recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      try {
        this.mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        this.mediaRecorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            this.recordedChunks.push(ev.data);
          }
        };
        this.mediaRecorder.start(250);
      } catch {
        this.mediaRecorder = null;
      }

      const SpeechRec =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
          .SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
          .webkitSpeechRecognition;

      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = getSpeechLocale(settings.voiceSpeech.language);

        rec.onresult = (event: SpeechRecognitionEventMap) => {
          if (this.listeningSessionId !== currentSessionId) return;
          let interim = '';
          let finalStr = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalStr += transcriptPiece;
            } else {
              interim += transcriptPiece;
            }
          }
          const combined = (finalStr || interim).trim();
          if (combined) {
            latestTranscript = combined;
            callbacks.onInterimTranscript(combined);
          }
          if (finalStr.trim() && !finalized) {
            finalizeOnce(finalStr.trim());
          }
        };

        rec.onerror = (ev) => {
          if (this.listeningSessionId !== currentSessionId) return;
          if (latestTranscript.trim()) {
            finalizeOnce(latestTranscript.trim());
            return;
          }
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
            errorOnce('Microphone permission denied.', true);
          } else if (ev.error === 'no-speech') {
            errorOnce('No speech detected. Please speak clearly or tap to retry.');
          } else if (ev.error !== 'aborted') {
            this.finishWithGeminiTranscribe(settings.voiceSpeech.language, {
              onInterimTranscript: callbacks.onInterimTranscript,
              onFinalTranscript: (txt) => {
                if (txt.trim()) {
                  finalizeOnce(txt.trim());
                } else {
                  errorOnce('Speech recognition error. Tap to retry.');
                }
              },
              onError: (msg) => errorOnce(msg),
            }, settings);
          }
        };

        rec.onend = async () => {
          if (finalized || this.listeningSessionId !== currentSessionId) return;
          if (!this.isListeningFlag) return;

          if (latestTranscript.trim()) {
            finalizeOnce(latestTranscript.trim());
          } else {
            await this.finishWithGeminiTranscribe(settings.voiceSpeech.language, {
              onInterimTranscript: callbacks.onInterimTranscript,
              onFinalTranscript: (txt) => {
                if (txt.trim()) {
                  finalizeOnce(txt.trim());
                } else {
                  errorOnce('No speech detected. Tap or hold to retry.');
                }
              },
              onError: (msg) => errorOnce(msg),
            }, settings);
          }
        };

        this.recognition = rec;
        rec.start();
      } else {
        callbacks.onInterimTranscript('Listening (tap orb when done speaking)...');
      }
    } catch (err: unknown) {
      this.cleanupMic();
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      errorOnce(
        isDenied
          ? 'Microphone access was denied. Grant microphone permission to use voice input.'
          : 'Could not access microphone.',
        isDenied
      );
    }
  }

  async finishListeningManually(
    language: LanguageMode,
    callbacks: {
      onInterimTranscript: (text: string) => void;
      onFinalTranscript: (text: string) => void;
      onError: (message: string) => void;
    },
    currentInterim: string,
    settings?: JarvisSettings
  ): Promise<void> {
    if (!this.isListeningFlag) return;
    this.playSubtleTone('listen-end');

    if (Capacitor.isNativePlatform()) {
      try {
        await JarvisNativeDevice.stopSpeechRecognition();
      } catch {
        // Ignore
      }
    }

    if (currentInterim.trim()) {
      this.stopListening();
      callbacks.onFinalTranscript(currentInterim.trim());
      return;
    }

    await this.finishWithGeminiTranscribe(language, {
      onInterimTranscript: callbacks.onInterimTranscript,
      onFinalTranscript: (txt) => {
        if (txt.trim()) {
          callbacks.onFinalTranscript(txt.trim());
        } else {
          callbacks.onError('No speech detected. Tap or hold to retry.');
        }
      },
      onError: (err) => callbacks.onError(err),
    }, settings);
  }

  private async finishWithGeminiTranscribe(
    language: LanguageMode,
    callbacks: {
      onInterimTranscript: (text: string) => void;
      onFinalTranscript: (text: string) => void;
      onError: (message: string) => void;
    },
    settings?: JarvisSettings
  ): Promise<void> {
    const chunks = [...this.recordedChunks];
    const recorderMime = this.mediaRecorder?.mimeType || 'audio/webm';
    this.cleanupMic();

    if (chunks.length === 0) {
      callbacks.onFinalTranscript('');
      return;
    }

    try {
      callbacks.onInterimTranscript('Processing voice signal...');
      const blob = new Blob(chunks, { type: recorderMime });
      const base64 = await this.blobToBase64(blob);
      const cleanMime = recorderMime.split(';')[0] || 'audio/webm';
      const transcript = await aiService.transcribeAudio(base64, cleanMime, language, settings);
      callbacks.onFinalTranscript(transcript.trim());
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : 'Voice transcription failed.');
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = String(reader.result || '');
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  stopListening(): void {
    this.cleanupMic();
  }

  private cleanupMic(): void {
    this.isListeningFlag = false;
    this.nativeRmsLevel = 0;
    if (Capacitor.isNativePlatform()) {
      JarvisNativeDevice.cancelSpeechRecognition().catch(() => {});
      this.cleanupNativeListeners().catch(() => {});
    }
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch {
        // Ignore
      }
      this.mediaRecorder = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.micAnalyser = null;
  }

  async speak(
    text: string,
    settings: JarvisSettings,
    onStart: () => void,
    onEnd: () => void
  ): Promise<void> {
    this.stopSpeaking();

    const cleanText = text.replace(/[*#`_~]/g, '').trim();
    if (!cleanText || !settings.voiceSpeech.voiceOutputEnabled) {
      onEnd();
      return;
    }

    this.isSpeakingFlag = true;

    try {
      await voiceEngine.speakFullText(
        cleanText,
        settings,
        {
          onStart: () => {
            this.isSpeakingFlag = true;
            onStart();
          },
          onEnd: () => {
            this.isSpeakingFlag = false;
            onEnd();
          },
          onError: () => {
            this.isSpeakingFlag = false;
            onEnd();
          },
        },
        settings.personality.emotionMode
      );
    } catch {
      this.isSpeakingFlag = false;
      onEnd();
    }
  }

  stopSpeaking(): void {
    this.isSpeakingFlag = false;
    voiceEngine.interrupt();
    if (this.ttsSource) {
      try {
        this.ttsSource.onended = null;
        this.ttsSource.stop();
      } catch {
        // Ignore
      }
      this.ttsSource = null;
    }
    this.ttsAnalyser = null;
  }
}

export const voicePipeline = new JarvisVoicePipeline();

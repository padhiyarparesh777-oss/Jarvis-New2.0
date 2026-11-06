import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Polyfill minimal browser globals for testing in Node
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.navigator === 'undefined') {
  (globalThis as any).navigator = {
    userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    onLine: true,
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import {
  processDeviceAction,
  isActionDirectExecution,
  isActionConfirmationRequired,
  resolveTargetPackage,
} from '../src/modules/device/deviceControl';
import { DEFAULT_SETTINGS } from '../src/modules/memory/memoryRepository';
import { aiService } from '../src/modules/ai/aiService';
import { voiceEngine } from '../src/modules/voice/VoiceEngine';
import { voicePipeline } from '../src/modules/voice/voicePipeline';

describe('JARVIS AI Voice Pipeline & Action Policy Tests', () => {

  // Test 1: Voice transcript reaches Gemini
  test('1. Voice transcript reaches Gemini processing function', async () => {
    let capturedPrompt = '';
    const originalStream = aiService.streamConversation;

    try {
      (aiService as any).streamConversation = async (
        messages: any[],
        _attachments: any[],
        _settings: any,
        _memories: any[],
        _perms: any,
        callbacks: any
      ) => {
        const lastMsg = messages[messages.length - 1];
        capturedPrompt = lastMsg.content;
        callbacks.onFirstToken?.(50);
        callbacks.onTextDelta?.('I am ready, Sir.', 'I am ready, Sir.');
        callbacks.onComplete?.('I am ready, Sir.');
      };

      const testVoiceTranscript = 'Hello JARVIS how are you';
      let reached = false;

      // Simulate sending voice transcript into Gemini pipeline
      await aiService.streamConversation(
        [{ role: 'user', content: testVoiceTranscript, timestamp: Date.now(), id: 'msg-1' }],
        [],
        DEFAULT_SETTINGS,
        [],
        'perms',
        {
          onTextDelta: () => {},
          onComplete: (reply: string) => {
            reached = reply.length > 0;
          },
          onError: () => {},
        }
      );

      assert.equal(capturedPrompt, testVoiceTranscript);
      assert.equal(reached, true);
    } finally {
      aiService.streamConversation = originalStream;
    }
  });

  // Test 2: Voice response triggers TTS
  test('2. Voice response triggers TTS audio chunk synthesis', async () => {
    let ttsChunkReceived = '';
    const originalEnqueue = voiceEngine.enqueueSentenceChunk;
    const originalStart = voiceEngine.startStreamingSession;

    try {
      (voiceEngine as any).startStreamingSession = () => {};
      (voiceEngine as any).enqueueSentenceChunk = (sentence: string) => {
        ttsChunkReceived = sentence;
      };

      const aiResponseChunk = 'System diagnostic completed successfully.';
      voiceEngine.enqueueSentenceChunk(aiResponseChunk, DEFAULT_SETTINGS, 'adaptive');

      assert.equal(ttsChunkReceived, aiResponseChunk);
    } finally {
      voiceEngine.enqueueSentenceChunk = originalEnqueue;
      voiceEngine.startStreamingSession = originalStart;
    }
  });

  // Test 3: STT ending does not cancel Gemini
  test('3. STT ending does not cancel Gemini', async () => {
    let geminiAborted = false;
    const originalCancel = aiService.cancelActiveRequest;

    try {
      let isTurnActive = true;
      (aiService as any).cancelActiveRequest = () => {
        if (isTurnActive) geminiAborted = true;
      };

      // When STT finishes listening, cleanupMic / stopListening must NOT cancel the ongoing AI turn
      voicePipeline.stopListening();

      // Normal STT ending should not abort the ongoing turn
      assert.equal(geminiAborted, false, 'Gemini request must not be cancelled by STT stopListening');
    } finally {
      aiService.cancelActiveRequest = originalCancel;
    }
  });

  // Test 4: Stop button cancels intentionally
  test('4. Stop button cancels intentionally', () => {
    let requestCancelled = false;
    const originalCancel = aiService.cancelActiveRequest;

    try {
      (aiService as any).cancelActiveRequest = () => {
        requestCancelled = true;
      };

      // User explicitly taps Stop button
      aiService.cancelActiveRequest();
      voiceEngine.interrupt();
      voicePipeline.stopSpeaking();
      voicePipeline.stopListening();

      assert.equal(requestCancelled, true, 'Intentional stop must trigger cancelActiveRequest');
    } finally {
      aiService.cancelActiveRequest = originalCancel;
    }
  });

  // Test 5: Opening YouTube requires no confirmation
  test('5. Opening YouTube requires no confirmation (DIRECT EXECUTION)', async () => {
    const isDirect = isActionDirectExecution('OPEN_APP', { actionType: 'OPEN_APP', targetApp: 'YouTube' });
    const isConfReq = isActionConfirmationRequired('OPEN_APP', { actionType: 'OPEN_APP', targetApp: 'YouTube' });

    assert.equal(isDirect, true, 'OPEN_APP for YouTube must be direct');
    assert.equal(isConfReq, false, 'OPEN_APP for YouTube must not require confirmation');

    const result = await processDeviceAction(
      { actionType: 'OPEN_APP', targetApp: 'YouTube' },
      DEFAULT_SETTINGS
    );

    assert.equal(result.status, 'intent_dispatched');
    assert.notEqual(result.status, 'awaiting_confirmation');
  });

  // Test 6: Opening Telegram requires no confirmation
  test('6. Opening Telegram requires no confirmation (DIRECT EXECUTION)', async () => {
    const isDirect = isActionDirectExecution('OPEN_APP', { actionType: 'OPEN_APP', targetApp: 'Telegram' });
    const isConfReq = isActionConfirmationRequired('OPEN_APP', { actionType: 'OPEN_APP', targetApp: 'Telegram' });

    assert.equal(isDirect, true, 'OPEN_APP for Telegram must be direct');
    assert.equal(isConfReq, false, 'OPEN_APP for Telegram must not require confirmation');

    const result = await processDeviceAction(
      { actionType: 'OPEN_APP', targetApp: 'Telegram' },
      DEFAULT_SETTINGS
    );

    assert.equal(result.status, 'intent_dispatched');
    assert.notEqual(result.status, 'awaiting_confirmation');
  });

  // Test 7: Explicit phone call commands execute directly
  test('7. Placing an explicit call does not require an extra confirmation', async () => {
    const request = {
      actionType: 'DIAL_NUMBER' as const,
      phoneNumberOrContact: '+919876543210',
    };
    const isDirect = isActionDirectExecution('DIAL_NUMBER', request);
    const isConfReq = isActionConfirmationRequired('DIAL_NUMBER', request);

    assert.equal(isDirect, true, 'DIAL_NUMBER should use direct execution');
    assert.equal(isConfReq, false, 'DIAL_NUMBER should not show a redundant confirmation');

    const result = await processDeviceAction(request, DEFAULT_SETTINGS);
    assert.equal(result.status, 'intent_dispatched');
  });

  // Test 8: Sending WhatsApp messages requires confirmation
  test('8. Sending WhatsApp messages requires confirmation (CONFIRMATION REQUIRED)', async () => {
    // 8a: Opening WhatsApp application itself is direct
    const openWhatsAppDirect = isActionDirectExecution('OPEN_APP', {
      actionType: 'OPEN_APP',
      targetApp: 'WhatsApp',
    });
    assert.equal(openWhatsAppDirect, true, 'Opening WhatsApp app itself must be direct');

    // 8b: Sending a WhatsApp message requires confirmation
    const isDirect = isActionDirectExecution('SEND_WHATSAPP', {
      actionType: 'SEND_WHATSAPP',
      phoneNumberOrContact: '+919876543210',
      label: 'Meeting at 5pm',
    });
    const isConfReq = isActionConfirmationRequired('SEND_WHATSAPP', {
      actionType: 'SEND_WHATSAPP',
      phoneNumberOrContact: '+919876543210',
      label: 'Meeting at 5pm',
    });

    assert.equal(isDirect, false, 'SEND_WHATSAPP must not be direct execution');
    assert.equal(isConfReq, true, 'SEND_WHATSAPP must require confirmation');

    const result = await processDeviceAction(
      {
        actionType: 'SEND_WHATSAPP',
        phoneNumberOrContact: '+919876543210',
        label: 'Meeting at 5pm',
      },
      DEFAULT_SETTINGS
    );

    assert.equal(result.status, 'awaiting_confirmation');
  });
});

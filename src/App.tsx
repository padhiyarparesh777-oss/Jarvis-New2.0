/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Settings, ExternalLink, X } from 'lucide-react';
import {
  ActiveTimerOrAlarm,
  AutomationLog,
  AutomationRoutine,
  BackendStatus,
  ChatAttachment,
  ChatMessage,
  ChatThread,
  DeviceActionRequest,
  DeviceActionResult,
  GroundingSource,
  InteractionState,
  JarvisSettings,
  MemoryFact,
  PermissionStatusMap,
  PlannerTask,
} from './types/jarvis';
import {
  DEFAULT_SETTINGS,
  INITIAL_MEMORIES,
  INITIAL_ROUTINES,
  INITIAL_TASKS,
  memoryRepository,
} from './modules/memory/memoryRepository';
import {
  checkPermissionsStatus,
  processDeviceAction,
} from './modules/device/deviceControl';
import { aiService, PlannerToolAction } from './modules/ai/aiService';
import { voicePipeline } from './modules/voice/voicePipeline';
import { NeuralNetworkCore } from './modules/neural/NeuralNetworkCore';
import { BottomChatComposer } from './modules/chat/BottomChatComposer';
import { SettingsModal } from './modules/settings/SettingsModal';

function isCurrentlyQuietHours(settings: JarvisSettings): boolean {
  if (!settings.notifications.quietHoursEnabled) return false;
  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = settings.notifications.quietHoursStart.split(':').map(Number);
  const [endH, endM] = settings.notifications.quietHoursEnd.split(':').map(Number);
  const startMins = (startH || 22) * 60 + (startM || 0);
  const endMins = (endH || 7) * 60 + (endM || 0);

  if (startMins <= endMins) {
    return curMins >= startMins && curMins <= endMins;
  }
  return curMins >= startMins || curMins <= endMins;
}

export default function App() {
  const [settings, setSettings] = useState<JarvisSettings>(() =>
    memoryRepository.loadSettings()
  );
  const [threads, setThreads] = useState<ChatThread[]>(() =>
    memoryRepository.loadThreads()
  );
  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    const loaded = memoryRepository.loadThreads();
    return loaded[0]?.id || 'thread-primary';
  });
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState<boolean>(false);

  const [memories, setMemories] = useState<MemoryFact[]>(() =>
    memoryRepository.loadMemories()
  );
  const [plannerTasks, setPlannerTasks] = useState<PlannerTask[]>(() =>
    memoryRepository.loadPlannerTasks()
  );
  const [routines, setRoutines] = useState<AutomationRoutine[]>(() =>
    memoryRepository.loadRoutines()
  );
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>(() =>
    memoryRepository.loadAutomationLogs()
  );
  const [actionLogs, setActionLogs] = useState<DeviceActionResult[]>(() =>
    memoryRepository.loadActionLogs()
  );

  const [interactionState, setInteractionState] = useState<InteractionState>('idle');
  const [liveCaption, setLiveCaption] = useState<string>('');
  const [captionSubtext, setCaptionSubtext] = useState<string>('');
  const [pendingDeviceAction, setPendingDeviceAction] = useState<DeviceActionResult | null>(null);
  const [activeTimers, setActiveTimers] = useState<ActiveTimerOrAlarm[]>([]);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatusMap>({
    microphone: 'prompt',
    camera: 'prompt',
    notifications: 'prompt',
    screenCapture: 'ready',
    androidIntents: 'simulated_web',
    accessibilityService: 'unauthorized',
    wakeLock: 'unsupported',
  });
  const [renderTelemetry, setRenderTelemetry] = useState<{
    fps: number;
    nodes: number;
    filaments: number;
  }>({
    fps: 60,
    nodes: 360,
    filaments: 740,
  });

  const captionFadeTimeoutRef = useRef<number | null>(null);
  const errorResetTimeoutRef = useRef<number | null>(null);
  const interimTranscriptRef = useRef<string>('');

  const activeThread =
    threads.find((t) => t.id === activeThreadId) || threads[0];

  const clearCaptionTimer = () => {
    if (captionFadeTimeoutRef.current !== null) {
      window.clearTimeout(captionFadeTimeoutRef.current);
      captionFadeTimeoutRef.current = null;
    }
  };

  const scheduleCaptionFadeOut = useCallback((delayMs = 6000) => {
    clearCaptionTimer();
    captionFadeTimeoutRef.current = window.setTimeout(() => {
      setLiveCaption('');
      setCaptionSubtext('');
    }, delayMs);
  }, []);

  const triggerTransientErrorState = useCallback(
    (msg: string) => {
      voicePipeline.playSubtleTone('error');
      setInteractionState('error');
      setLiveCaption(msg);
      setCaptionSubtext('');
      if (errorResetTimeoutRef.current) {
        window.clearTimeout(errorResetTimeoutRef.current);
      }
      errorResetTimeoutRef.current = window.setTimeout(() => {
        setInteractionState('idle');
        scheduleCaptionFadeOut(3500);
      }, 2600);
    },
    [scheduleCaptionFadeOut]
  );

  const refreshBackendStatus = useCallback(async () => {
    const status = await aiService.checkStatus();
    setBackendStatus(status);
  }, []);

  const refreshPermissions = useCallback(async () => {
    const perms = await checkPermissionsStatus(
      settings.phoneControl.accessibilityBridgeEnabled
    );
    setPermissions(perms);
  }, [settings.phoneControl.accessibilityBridgeEnabled]);

  useEffect(() => {
    refreshBackendStatus();
    refreshPermissions();
  }, [refreshBackendStatus, refreshPermissions]);

  // Countdown tick for active session timers & alarms
  useEffect(() => {
    if (activeTimers.length === 0) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setActiveTimers((prev) => {
        let changed = false;
        const updated = prev.map((item) => {
          if (item.triggered) return item;
          const rem = Math.max(0, Math.ceil((item.targetTimeMs - now) / 1000));
          if (rem === 0 && !item.triggered) {
            changed = true;
            if (!isCurrentlyQuietHours(settings) && settings.notifications.soundAlertsEnabled) {
              voicePipeline.playSubtleTone('alarm');
            }
            setLiveCaption(`${item.label} complete`);
            scheduleCaptionFadeOut(5500);
            return { ...item, remainingSeconds: 0, triggered: true };
          }
          if (rem !== item.remainingSeconds) {
            changed = true;
            return { ...item, remainingSeconds: rem };
          }
          return item;
        });
        return changed ? updated : prev;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimers.length, settings, scheduleCaptionFadeOut]);

  const handleScheduleTimerOrAlarm = useCallback(
    (type: 'alarm' | 'timer', label: string, seconds: number) => {
      const newEntry: ActiveTimerOrAlarm = {
        id: `tmr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type,
        label,
        targetTimeMs: Date.now() + seconds * 1000,
        remainingSeconds: seconds,
        triggered: false,
      };
      setActiveTimers((prev) => [newEntry, ...prev.slice(0, 9)]);
    },
    []
  );

  const handleExecuteDeviceAction = useCallback(
    async (req: DeviceActionRequest) => {
      const result = await processDeviceAction(req, settings, handleScheduleTimerOrAlarm);
      setActionLogs((prev) => {
        const next = [result, ...prev.slice(0, 49)];
        memoryRepository.saveActionLogs(next);
        return next;
      });

      if (
        result.status === 'awaiting_confirmation' ||
        (result.androidIntentUri && result.status === 'intent_dispatched')
      ) {
        setPendingDeviceAction(result);
      } else {
        setCaptionSubtext(`${result.title}: ${result.detail}`);
      }
      return result;
    },
    [settings, handleScheduleTimerOrAlarm]
  );

  const handleSaveMemoryFact = useCallback(
    (fact: string, category: MemoryFact['category']) => {
      setMemories((prev) => {
        if (prev.some((m) => m.fact.toLowerCase() === fact.toLowerCase())) {
          return prev;
        }
        const created: MemoryFact = {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fact,
          category,
          enabled: true,
          createdAt: Date.now(),
        };
        const next = [created, ...prev];
        memoryRepository.saveMemories(next);
        return next;
      });
    },
    []
  );

  const handleToggleMemory = useCallback((id: string) => {
    setMemories((prev) => {
      const next = prev.map((m) =>
        m.id === id ? { ...m, enabled: m.enabled === false ? true : false } : m
      );
      memoryRepository.saveMemories(next);
      return next;
    });
  }, []);

  const handleDeleteMemory = useCallback((id: string) => {
    setMemories((prev) => {
      const next = prev.filter((m) => m.id !== id);
      memoryRepository.saveMemories(next);
      return next;
    });
  }, []);

  const handleAddPlannerTask = useCallback(
    (title: string, dueTime: string, category: PlannerTask['category']) => {
      setPlannerTasks((prev) => {
        const created: PlannerTask = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          dueTime,
          completed: false,
          category,
          createdAt: Date.now(),
        };
        const next = [created, ...prev];
        memoryRepository.savePlannerTasks(next);
        return next;
      });
    },
    []
  );

  const handleTogglePlannerTask = useCallback((id: string) => {
    setPlannerTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t
      );
      memoryRepository.savePlannerTasks(next);
      return next;
    });
  }, []);

  const handleDeletePlannerTask = useCallback((id: string) => {
    setPlannerTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      memoryRepository.savePlannerTasks(next);
      return next;
    });
  }, []);

  const handleRunRoutine = useCallback(
    (routine: AutomationRoutine) => {
      if (isCurrentlyQuietHours(settings)) {
        const skippedLog: AutomationLog = {
          id: `alog-${Date.now()}`,
          routineName: routine.name,
          status: 'skipped_quiet_hours',
          detail: 'Routine suppressed due to active Quiet Hours policy.',
          timestamp: Date.now(),
        };
        setAutomationLogs((prev) => {
          const next = [skippedLog, ...prev.slice(0, 49)];
          memoryRepository.saveAutomationLogs(next);
          return next;
        });
        setCaptionSubtext(`${routine.name} paused during Quiet Hours.`);
        return;
      }

      if (routine.name.toLowerCase().includes('work')) {
        handleScheduleTimerOrAlarm('timer', 'Work Mode Focus Session', 1500);
        setSettings((prev) => {
          const updated: JarvisSettings = {
            ...prev,
            aiBrain: { ...prev.aiBrain, responseStyle: 'concise', personality: 'tactical' },
          };
          memoryRepository.saveSettings(updated);
          return updated;
        });
      }

      const logEntry: AutomationLog = {
        id: `alog-${Date.now()}`,
        routineName: routine.name,
        status: 'completed',
        detail: `Executed ${routine.steps.length} workflow steps.`,
        timestamp: Date.now(),
      };
      setAutomationLogs((prev) => {
        const next = [logEntry, ...prev.slice(0, 49)];
        memoryRepository.saveAutomationLogs(next);
        return next;
      });
      setRoutines((prev) => {
        const next = prev.map((r) =>
          r.id === routine.id ? { ...r, lastRunAt: Date.now() } : r
        );
        memoryRepository.saveRoutines(next);
        return next;
      });
      setLiveCaption(`${routine.name} activated.`);
      setCaptionSubtext(routine.steps.join(' · '));
      scheduleCaptionFadeOut(6000);
    },
    [settings, handleScheduleTimerOrAlarm, scheduleCaptionFadeOut]
  );

  const handleToggleRoutine = useCallback((id: string) => {
    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
      memoryRepository.saveRoutines(next);
      return next;
    });
  }, []);

  const handlePlannerToolAction = useCallback(
    (action: PlannerToolAction) => {
      if (action.operation === 'RUN_ROUTINE') {
        const matched =
          routines.find((r) =>
            r.name.toLowerCase().includes(action.title.toLowerCase())
          ) || routines[0];
        if (matched) {
          handleRunRoutine(matched);
        }
      } else {
        handleAddPlannerTask(
          action.title,
          action.dueTime || 'Today',
          action.operation === 'ADD_REMINDER' ? 'reminder' : 'task'
        );
        setCaptionSubtext(`Added to Smart Planner: ${action.title}`);
      }
    },
    [routines, handleRunRoutine, handleAddPlannerTask]
  );

  const appendMessageToActiveThread = useCallback(
    (msg: ChatMessage) => {
      setThreads((prev) => {
        const current = prev.find((t) => t.id === activeThreadId) || prev[0];
        if (!current) return prev;
        const isFirstUserMsg =
          current.messages.length === 0 && msg.role === 'user' && msg.content.trim();
        const updatedThread: ChatThread = {
          ...current,
          title: isFirstUserMsg ? msg.content.slice(0, 36) : current.title,
          updatedAt: Date.now(),
          messages: [...current.messages, msg],
        };
        const next = prev.map((t) => (t.id === current.id ? updatedThread : t));
        if (settings.memory.saveHistory) {
          memoryRepository.saveThreads(next, settings.privacy.ephemeralSession);
        }
        return next;
      });
    },
    [activeThreadId, settings.memory.saveHistory, settings.privacy.ephemeralSession]
  );

  const processUserTurn = useCallback(
    async (text: string, attachments: ChatAttachment[] = []) => {
      const cleanInput = text.trim();
      if (!cleanInput && attachments.length === 0) {
        setInteractionState('idle');
        return;
      }

      clearCaptionTimer();
      const displayPrompt =
        cleanInput ||
        `Analyzing ${attachments.map((a) => a.name).join(', ')}...`;
      setLiveCaption(displayPrompt);
      setCaptionSubtext('');
      setInteractionState('thinking');

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-u`,
        role: 'user',
        content: displayPrompt,
        timestamp: Date.now(),
        attachments:
          attachments.length > 0
            ? attachments.map((a) => ({
                id: a.id,
                name: a.name,
                mimeType: a.mimeType,
                kind: a.kind,
                previewUrl: a.previewUrl,
              }))
            : undefined,
      };

      const currentMessages = activeThread ? [...activeThread.messages, userMessage] : [userMessage];
      appendMessageToActiveThread(userMessage);

      const permSummary = `Microphone: ${permissions.microphone}, Camera: ${permissions.camera}, Notifications: ${permissions.notifications}, AndroidIntents: ${permissions.androidIntents}, Accessibility: ${permissions.accessibilityService}`;

      let collectedGrounding: GroundingSource[] = [];

      await aiService.streamConversation(
        currentMessages,
        attachments,
        settings,
        memories,
        permSummary,
        {
          onTextDelta: (_delta, fullText) => {
            setLiveCaption(fullText);
          },
          onDeviceAction: (req) => {
            handleExecuteDeviceAction(req);
          },
          onMemorySaved: (fact, category) => {
            if (settings.memory.autoExtractFacts) {
              handleSaveMemoryFact(fact, category);
            }
          },
          onPlannerAction: (action) => {
            handlePlannerToolAction(action);
          },
          onGroundingSources: (sources) => {
            collectedGrounding = sources;
          },
          onComplete: async (finalReply) => {
            const replyText = finalReply || 'Command processed.';
            const assistantMsg: ChatMessage = {
              id: `msg-${Date.now()}-a`,
              role: 'assistant',
              content: replyText,
              timestamp: Date.now(),
              groundingSources:
                collectedGrounding.length > 0 ? collectedGrounding : undefined,
            };

            appendMessageToActiveThread(assistantMsg);
            setLiveCaption(replyText);

            if (settings.chatInterface.showInlineDrawerOnReply) {
              setIsChatDrawerOpen(true);
            }

            if (settings.voiceSpeech.voiceOutputEnabled) {
              await voicePipeline.speak(
                replyText,
                settings,
                () => {
                  setInteractionState('speaking');
                },
                () => {
                  setInteractionState('idle');
                  scheduleCaptionFadeOut(6500);
                  if (settings.voiceSpeech.autoListenFollowUp) {
                    window.setTimeout(() => {
                      beginVoiceListening();
                    }, 450);
                  }
                }
              );
            } else {
              setInteractionState('idle');
              scheduleCaptionFadeOut(6500);
            }
          },
          onError: (errMsg) => {
            triggerTransientErrorState(errMsg);
          },
        }
      );
    },
    [
      activeThread,
      settings,
      memories,
      permissions,
      appendMessageToActiveThread,
      handleExecuteDeviceAction,
      handleSaveMemoryFact,
      handlePlannerToolAction,
      scheduleCaptionFadeOut,
      triggerTransientErrorState,
    ]
  );

  const beginVoiceListening = useCallback(() => {
    clearCaptionTimer();
    aiService.cancelActiveRequest();
    voicePipeline.stopSpeaking();

    interimTranscriptRef.current = '';
    setInteractionState('listening');
    setLiveCaption('');
    setCaptionSubtext('');

    voicePipeline.startListening(settings, {
      onInterimTranscript: (interim) => {
        interimTranscriptRef.current = interim;
        setLiveCaption(interim);
      },
      onFinalTranscript: (finalText) => {
        refreshPermissions();
        if (!finalText.trim()) {
          setInteractionState('idle');
          setLiveCaption('');
          return;
        }
        processUserTurn(finalText, []);
      },
      onError: (errMsg) => {
        refreshPermissions();
        triggerTransientErrorState(errMsg);
      },
    });
  }, [settings, processUserTurn, refreshPermissions, triggerTransientErrorState]);

  const handleStopActiveAction = useCallback(() => {
    aiService.cancelActiveRequest();
    voicePipeline.stopSpeaking();
    voicePipeline.stopListening();
    setInteractionState('idle');
    scheduleCaptionFadeOut(2000);
  }, [scheduleCaptionFadeOut]);

  const handleCoreTap = useCallback(() => {
    if (interactionState === 'speaking' || interactionState === 'thinking') {
      handleStopActiveAction();
      return;
    }

    if (interactionState === 'listening') {
      voicePipeline.finishListeningManually(
        settings.voiceSpeech.language,
        {
          onInterimTranscript: (txt) => setLiveCaption(txt),
          onFinalTranscript: (finalText) => {
            if (!finalText.trim()) {
              setInteractionState('idle');
              setLiveCaption('');
              return;
            }
            processUserTurn(finalText, []);
          },
          onError: (errMsg) => triggerTransientErrorState(errMsg),
        },
        interimTranscriptRef.current
      );
      return;
    }

    beginVoiceListening();
  }, [
    interactionState,
    settings.voiceSpeech.language,
    beginVoiceListening,
    handleStopActiveAction,
    processUserTurn,
    triggerTransientErrorState,
  ]);

  const handleCoreHoldStart = useCallback(() => {
    if (interactionState !== 'listening') {
      beginVoiceListening();
    }
  }, [interactionState, beginVoiceListening]);

  const handleCoreHoldEnd = useCallback(() => {
    if (interactionState === 'listening') {
      voicePipeline.finishListeningManually(
        settings.voiceSpeech.language,
        {
          onInterimTranscript: (txt) => setLiveCaption(txt),
          onFinalTranscript: (finalText) => {
            if (!finalText.trim()) {
              setInteractionState('idle');
              setLiveCaption('');
              return;
            }
            processUserTurn(finalText, []);
          },
          onError: (errMsg) => triggerTransientErrorState(errMsg),
        },
        interimTranscriptRef.current
      );
    }
  }, [
    interactionState,
    settings.voiceSpeech.language,
    processUserTurn,
    triggerTransientErrorState,
  ]);

  const handleNewThread = useCallback(() => {
    const newThread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: `Session ${threads.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setThreads((prev) => {
      const next = [newThread, ...prev];
      memoryRepository.saveThreads(next, settings.privacy.ephemeralSession);
      return next;
    });
    setActiveThreadId(newThread.id);
  }, [threads.length, settings.privacy.ephemeralSession]);

  const handleRenameThread = useCallback(
    (id: string, title: string) => {
      setThreads((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, title, updatedAt: Date.now() } : t
        );
        memoryRepository.saveThreads(next, settings.privacy.ephemeralSession);
        return next;
      });
    },
    [settings.privacy.ephemeralSession]
  );

  const handleDeleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        const next =
          filtered.length > 0
            ? filtered
            : [
                {
                  id: `thread-${Date.now()}`,
                  title: 'Primary Session',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  messages: [],
                },
              ];
        memoryRepository.saveThreads(next, settings.privacy.ephemeralSession);
        if (activeThreadId === id) {
          setActiveThreadId(next[0].id);
        }
        return next;
      });
    },
    [activeThreadId, settings.privacy.ephemeralSession]
  );

  const handleClearAllThreads = useCallback(() => {
    const fresh: ChatThread = {
      id: `thread-${Date.now()}`,
      title: 'Primary Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setThreads([fresh]);
    setActiveThreadId(fresh.id);
    memoryRepository.saveThreads([fresh], settings.privacy.ephemeralSession);
  }, [settings.privacy.ephemeralSession]);

  const handleUpdateSettings = (next: JarvisSettings) => {
    setSettings(next);
    memoryRepository.saveSettings(next);
  };

  const handleWipeAll = () => {
    memoryRepository.wipeAllData();
    const freshThread: ChatThread = {
      id: 'thread-primary',
      title: 'Primary Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSettings(DEFAULT_SETTINGS);
    setThreads([freshThread]);
    setActiveThreadId(freshThread.id);
    setMemories(INITIAL_MEMORIES);
    setPlannerTasks(INITIAL_TASKS);
    setRoutines(INITIAL_ROUTINES);
    setAutomationLogs([]);
    setActionLogs([]);
    setActiveTimers([]);
    setLiveCaption('');
  };

  const getAudioMetricsCallback = useCallback(() => {
    return voicePipeline.getLiveAudioMetrics();
  }, []);

  const handleFpsReport = useCallback((fps: number, nodes: number, filaments: number) => {
    setRenderTelemetry({ fps, nodes, filaments });
  }, []);

  return (
    <div className="relative w-full h-full bg-black text-white overflow-hidden select-none">
      {/* 1. Full-Screen 3D Golden AI Orb & Neural Network Core */}
      <NeuralNetworkCore
        interactionState={interactionState}
        getAudioMetrics={getAudioMetricsCallback}
        goldIntensity={settings.appearance.goldIntensity}
        animationQuality={settings.appearance.animationQuality}
        performanceMode={settings.appearance.performanceMode}
        reducedMotion={settings.appearance.reducedMotion}
        showOrbRings={settings.appearance.showOrbRings}
        showNetworkFilaments={settings.appearance.showNetworkFilaments}
        showHolographicParticles={settings.appearance.showHolographicParticles}
        onCoreTap={handleCoreTap}
        onCoreHoldStart={handleCoreHoldStart}
        onCoreHoldEnd={handleCoreHoldEnd}
        touchMode={settings.voiceSpeech.touchToSpeakMode}
        onFpsReport={handleFpsReport}
      />

      {/* 2. Minimal Top Header: "JARVIS AI" top-left and ONE gold Settings gear top-right */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6 pt-[max(1.1rem,env(safe-area-inset-top,1.1rem))] pb-3 pointer-events-none">
        <h1 className="font-display text-sm sm:text-base font-semibold tracking-[0.26em] text-white/95 whitespace-nowrap shrink-0">
          JARVIS <span className="text-[#FFC928]">AI</span>
        </h1>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Open JARVIS AI Settings"
          className="pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#FFC928] hover:text-[#FFDF70] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFC928] transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* 3. Pending Android Intent Confirmation Banner (Only when user confirmation is required) */}
      {pendingDeviceAction && (
        <div className="fixed top-20 left-0 right-0 z-30 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0A0A0A]/95 border border-[#FFC928]/45 text-xs shadow-2xl">
            <div className="max-w-xs sm:max-w-sm">
              <div className="font-semibold text-[#FFC928]">{pendingDeviceAction.title}</div>
              <div className="text-white/70 truncate">{pendingDeviceAction.detail}</div>
            </div>
            {pendingDeviceAction.androidIntentUri && (
              <a
                href={pendingDeviceAction.androidIntentUri}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPendingDeviceAction(null)}
                className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#FFC928] text-black font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Confirm</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setPendingDeviceAction(null)}
              aria-label="Dismiss intent confirmation"
              className="p-1.5 text-white/50 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Persistent Bottom Chat Bar with + Attachment Menu (Photo, Camera, File, PDF) */}
      <BottomChatComposer
        interactionState={interactionState}
        liveCaption={liveCaption}
        captionSubtext={captionSubtext}
        showSubtleCaptions={settings.appearance.showSubtleCaptions}
        enterToSend={settings.chatInterface.enterToSend}
        maxUploadSizeMb={settings.chatInterface.maxUploadSizeMb}
        threads={threads}
        activeThreadId={activeThreadId}
        isChatDrawerOpen={isChatDrawerOpen}
        onToggleChatDrawer={setIsChatDrawerOpen}
        onSelectThread={(id) => setActiveThreadId(id)}
        onNewThread={handleNewThread}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onSendMessage={(text, attachments) => processUserTurn(text, attachments)}
        onRetryMessage={(msg) => processUserTurn(msg.content, [])}
        onStopActiveAction={handleStopActiveAction}
        onUploadStateChange={(uploading) =>
          setInteractionState((prev) =>
            uploading ? 'uploading' : prev === 'uploading' ? 'idle' : prev
          )
        }
        onErrorFeedback={(msg) => triggerTransientErrorState(msg)}
      />

      {/* 5. Top-Right Settings Drawer */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={(id) => setActiveThreadId(id)}
        onNewThread={handleNewThread}
        onRenameThread={handleRenameThread}
        onDeleteThread={handleDeleteThread}
        onClearAllThreads={handleClearAllThreads}
        memories={memories}
        onAddMemory={handleSaveMemoryFact}
        onToggleMemory={handleToggleMemory}
        onDeleteMemory={handleDeleteMemory}
        plannerTasks={plannerTasks}
        onAddPlannerTask={handleAddPlannerTask}
        onTogglePlannerTask={handleTogglePlannerTask}
        onDeletePlannerTask={handleDeletePlannerTask}
        routines={routines}
        automationLogs={automationLogs}
        onRunRoutine={handleRunRoutine}
        onToggleRoutine={handleToggleRoutine}
        permissions={permissions}
        onRefreshPermissions={refreshPermissions}
        actionLogs={actionLogs}
        activeTimers={activeTimers}
        onTriggerDeviceAction={(req) => {
          handleExecuteDeviceAction(req);
        }}
        onAnalyzeScreen={(b64, mime, prompt) =>
          aiService.analyzeScreenImage(b64, mime, prompt)
        }
        backendStatus={backendStatus}
        onRefreshBackend={refreshBackendStatus}
        onWipeAll={handleWipeAll}
        storageStats={memoryRepository.getStorageStats()}
        renderTelemetry={renderTelemetry}
      />
    </div>
  );
}

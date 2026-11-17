# JARVIS — Friday Mark 2 Architecture

## Purpose

This document is the living architecture contract for the existing JARVIS Android application. Read it before adding modules, moving files, changing backend boundaries, or introducing agents and tools.

## Important implementation decision

The current product is a **TypeScript + React + Capacitor Android app with a Node/Express backend**. The earlier Friday Mark 2 proposal described a Python package. We adapt its architectural principles to the current stack instead of copying Python files or replacing working Android code.

The migration is additive and incremental. Existing user-facing behavior, Android permissions, device-control flows, voice pipeline, settings, and persistent local data must remain functional.

## Current system map

| Concern | Current implementation | Target boundary |
|---|---|---|
| Android/UI interface | `src/App.tsx`, `src/modules/**`, `android/**` | `src/interfaces/**` (future extraction; keep App as composition root meanwhile) |
| AI provider/backend | `server.ts`, `src/modules/ai/aiService.ts` | `server/**` (incremental extraction from server.ts) |
| Memory | `src/modules/memory/memoryRepository.ts` | `src/modules/memory/**` |
| Device capabilities | `src/modules/device/deviceControl.ts`, native Capacitor plugins | `src/tools/device/**` (adapter extraction, preserve native bridge) |
| Automation/background | `src/modules/automation/automationEngine.ts`, App lifecycle | `src/modules/execution/**`, `src/modules/background/**` |
| Voice/multimodal | `src/modules/voice/**`, Android services | `src/interfaces/voice/**` |
| Persona | `src/modules/persona/PersonaEngine.ts` | `src/modules/agents/persona/**` only when agent orchestration is introduced |
| Neural/context UI | `src/modules/neural/NeuralNetworkCore.tsx` | UI visualization remains separate from reasoning and execution |

## Core architectural laws

1. **Dependency direction:** UI/interfaces call application services; orchestration coordinates agents and tools; tools do not import UI components or agents. Shared contracts live in `src/core`.
2. **Separate planning from execution:** an agent may propose work, but the execution layer validates and runs registered capabilities.
3. **Keep capabilities small:** tools are deterministic adapters with validated inputs/outputs. They do not contain model prompts or decide user intent.
4. **Every input may update memory asynchronously:** memory extraction must be bounded, cancellable, privacy-aware, and must never delay the user-facing response. Persist only permitted facts; respect memory settings and explicit user consent.
5. **Context is a snapshot:** pass a small, explicit context object to model/agent calls rather than reading global UI state from deep modules.
6. **Explain decisions without exposing private reasoning:** record routing labels, selected tool/agent, timings, outcomes, and concise user-safe summaries. Do not persist hidden chain-of-thought or raw private chat by default.
7. **No silent side effects:** sensitive device actions, communications, payments, destructive operations, and permission changes must retain explicit confirmation gates.
8. **Discoverability is explicit:** registries are the extension point. Do not rely on unsafe filesystem auto-imports in the browser/Capacitor runtime.

## New foundation added in this migration

- `src/core/contracts.ts`: shared contracts for execution context, tools, and agents.
- `src/core/registry.ts`: explicit registries with duplicate-name protection and deterministic lookup.
- `src/modules/awareness/contextSnapshot.ts`: immutable, bounded context snapshot contract.
- `src/modules/reasoning/decisionTrace.ts`: bounded decision audit metadata; intentionally excludes chain-of-thought.

These foundations are additive. Existing modules are not silently replaced or rewired.

## Target module layout

```text
src/
  core/                 # shared contracts and registries
  modules/
    ai/                 # model/provider adapter
    agents/             # specialist agents (future, opt-in)
    tools/              # deterministic capabilities (future extraction)
      general/
      device/
      memory/
      planner/
    memory/             # persistence, retrieval, learning pipeline
    reasoning/          # routing metadata, reflection policy, audit trail
    awareness/          # current task/session/context snapshots
    execution/          # serial/parallel task orchestration
    background/         # scheduled/proactive work with user controls
    voice/              # STT/TTS and audio pipeline
    device/             # Capacitor/native device bridge
    automation/         # triggers and routine definitions
    persona/            # response style and persona policy
    chat/               # chat UI
    settings/           # settings UI
interfaces/
  # future adapters for terminal, REST, messaging and LiveKit
server/
  # future extracted Express routes, provider adapters and backend services
android/
  # native Android host, services and Capacitor plugins
test/
  # regression tests and core contract tests
```

## Migration phases

| Phase | Scope | Safety gate |
|---|---|---|
| 0 | Document current architecture and preserve baseline | No runtime behavior changes |
| 1 | Add shared core contracts and explicit registries | TypeScript check + core tests |
| 2 | Add context snapshot and decision audit metadata | Bounded data; no raw prompt logging |
| 3 | Extract backend routes/provider adapters from `server.ts` | Existing API contract tests pass |
| 4 | Extract device, memory, planner and general tools behind adapters | Android bridge and user data remain compatible |
| 5 | Add agent orchestration with serial/parallel limits | Explicit allow-list, cancellation, depth limits |
| 6 | Add async memory learning pipeline | Respect memory controls, consent and retention |
| 7 | Add background goal scheduler | Opt-in, quiet hours, resource limits |
| 8 | Add voice/messaging interface adapters | Existing voice and Android permissions preserved |
| 9 | Full regression, Android build and deployment verification | CI green; no secrets committed |

## Rules for future changes

- Do not move or delete existing files until imports and tests are updated in the same phase.
- Do not change API response shapes without a compatibility layer.
- Never commit `.env`, API keys, access tokens, user chat exports, or device data.
- Keep provider keys on the server. The Android client must not contain provider secrets.
- Every background task needs cancellation, a timeout, bounded retries, and observable status.
- Parallel agent execution needs concurrency and recursion limits.
- Tests must cover both success and failure paths for tools that can affect the device.
- Update this document whenever the actual architecture changes.

## Definition of done

A phase is complete only when its code is committed, type checks pass, relevant tests pass, existing JARVIS behavior is preserved, and the migration table is updated with evidence. A pushed commit alone is not proof of a successful Android build or deployment.

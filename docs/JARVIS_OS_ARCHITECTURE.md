# JARVIS OS Architecture & Implementation Status

## Product direction
JARVIS is being evolved in stages: an advanced Android assistant first, a launcher and deeper native integration second, and a custom Android-based OS only after the app-level platform is stable.

## Current repository foundation
- React + TypeScript interface packaged with Capacitor 8.
- Native Java Android plugins for device controls, permissions, speech recognition, and hardware integration.
- Accessibility service for visible UI inspection and supported UI actions.
- Notification listener and optional background/overlay services.
- Existing local memory repository and Gemini-backed backend.
- Deterministic offline device command parser.

## Agent foundation added in this milestone
- Typed contracts for plans, steps, tools, tool results, and execution reports.
- Dependency validation and topological ordering for plans.
- Sequential cancellable runtime with registered tool adapters only.
- Explicit risk policy: read/local actions can run directly; external and destructive actions require owner approval by default unless configured as trusted (destructive actions remain approval-gated).
- Runtime never reports success unless the registered adapter returns success.

## Platform constraints
This project intentionally does not require root or Shizuku. Ordinary Android applications cannot silently grant themselves Accessibility, notification access, microphone, screen-capture, overlay, or other special permissions. The user must enable system-controlled permissions. Some protected settings and third-party app data remain inaccessible.

## Not yet implemented / must not be advertised as ready
- Whisper.cpp local microphone capture, model installation, and inference bridge.
- Fully integrated autonomous planner connected to the existing conversation/tool-calling flow.
- Durable Room/SQLite native memory migration and encrypted sync.
- Complete app-specific automation connectors.
- Always-on wake-word engine with verified battery and OEM behavior.
- Custom launcher / system image / custom Android OS.

## Verification
Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npx cap sync android`, and `cd android && ./gradlew assembleDebug`. Device-level checks are still required for permissions, Accessibility, notification access, microphone, and OEM background behavior.

# JARVIS 2.0 Implementation Roadmap

This roadmap defines the recommended order for completing the six selected improvement areas. It is a plan and status reference, not a claim that every listed feature already exists.

## Engineering rules

1. Preserve working features and make small, reviewable changes.
2. Keep all work on the active feature branch; do not commit directly to `main`.
3. Audit existing implementations before adding dependencies or duplicate services.
4. Require explicit user consent for sensitive Android capabilities and external actions.
5. Keep secrets server-side and validate every backend/tool boundary.
6. Every feature needs automated tests where practical and a documented physical-device test where hardware or Android lifecycle behavior is involved.
7. Never report success unless the underlying operation returned a verified success result.

## Phase 1 — Security and stability

Priority: Critical

- Authenticate private backend endpoints.
- Add schema validation, request timeouts, endpoint-specific limits, and safe error handling.
- Harden proxy-aware rate limiting and CORS.
- Review Android backup behavior and sensitive data handling.
- Request permissions just in time rather than all at onboarding.
- Make overlay and background behavior explicitly opt-in.
- Add redacted diagnostics and recovery paths.

Acceptance:
- Unauthenticated private API requests are rejected.
- Invalid or oversized payloads are rejected safely.
- Secrets are absent from the APK and client bundle.
- Overlay does not start unless the user explicitly enables it.
- Network loss and backend failures produce recoverable UI states.

## Phase 2 — Voice and local Whisper

Priority: High

- Implement Android audio capture with lifecycle-safe cleanup.
- Integrate a maintained on-device Whisper-compatible runtime after validating Android ABI, license, model size, and device memory requirements.
- Add model download, checksum verification, progress, cancellation, storage management, and deletion.
- Add voice activity detection and interruption-safe TTS.
- Evaluate Hindi, Gujarati, Hinglish, and English with recorded test fixtures.
- Add optional wake-word support only with visible consent and Android-compliant microphone service behavior.

Acceptance:
- Transcription works offline with a downloaded model.
- Recording can be stopped reliably.
- Playback can be interrupted without stale audio continuing.
- Model download failures and low-memory conditions are handled.

## Phase 3 — Native Android control

Priority: High

- Split the monolithic native device plugin into focused controllers.
- Use allowlisted actions and typed request/result contracts.
- Add permission checks immediately before sensitive operations.
- Distinguish dispatched intents from verified completion.
- Add secure-screen and sensitive-field safeguards to accessibility workflows.
- Test Android 14+ foreground-service requirements and OEM behavior.

Acceptance:
- Every action returns a structured result.
- Unsupported actions fail explicitly.
- Sensitive actions require confirmation.
- Physical-device tests cover supported Android versions.

## Phase 4 — Floating assistant UI

Priority: Medium

- Keep the overlay explicitly opt-in.
- Add compact and expanded states, drag behavior, close/mute controls, and accessible touch targets.
- Synchronize UI state with the native service lifecycle.
- Avoid secure screens and respect system overlay restrictions.
- Adapt animation workload to refresh rate, battery, and thermal conditions.

Acceptance:
- Overlay starts and stops on explicit user action.
- It never silently restarts after being disabled.
- Returning to the app dismisses the overlay.
- Repeated start/stop does not leak windows or services.

## Phase 5 — Autonomous AI agent

Priority: High

- Connect the existing agent planner/runtime/policy to the real model tool-calling loop.
- Use a strict tool registry and typed schemas.
- Validate dependency graphs, step limits, and cancellation.
- Classify risk before execution.
- Require approval for external, destructive, financial, communication, or privacy-sensitive actions.
- Add bounded retries, timeouts, idempotency keys, progress events, and result verification.

Acceptance:
- Unknown tools and invalid plans are rejected.
- Cancellation stops pending work.
- Failed actions are never reported as completed.
- Approval cannot be bypassed by model-generated arguments.

## Phase 6 — Memory and Google integrations

Priority: High

- Migrate sensitive local data to Keystore-backed encryption where applicable.
- Add user-controlled memory review, correction, export, retention, and deletion.
- Implement optional authenticated per-user cloud sync with conflict handling.
- Implement Google OAuth authorization-code flow with state validation, exact redirect URIs, least-privilege scopes, and server-side token storage.
- Add Calendar, Gmail, and Drive adapters incrementally.
- Require confirmation before sending email, changing events, or deleting data.

Acceptance:
- User data is isolated by account.
- Tokens never enter browser local storage or APK assets.
- Disconnect/revocation works.
- Google provider actions are tested against real consented accounts.

## Release gates

Before a release candidate:

- TypeScript validation passes.
- Automated tests pass.
- Production web build passes.
- Capacitor sync and Android debug build pass.
- Dependency and secret scans are reviewed.
- Physical-device smoke tests pass for microphone, overlay, permissions, app lifecycle, and native actions.
- Known limitations are documented.
- A signed release uses protected CI secrets and is never built with debug credentials.

## Current first fix

The Android activity previously attempted to start the floating overlay whenever it entered the background if overlay permission was present. This contradicted the in-app opt-in control. The activity now only dismisses the overlay on resume; starting it remains the responsibility of the explicit Floating Island action in the native plugin.

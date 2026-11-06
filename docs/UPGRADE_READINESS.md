# JARVIS 2.0 Upgrade & Integration Readiness

This document tracks the requested Gemini-first upgrade. It intentionally distinguishes code that exists from integrations that still need credentials or a persistent data service.

## Implemented hardening in this branch
- Backend status reports whether GEMINI_API_KEY is actually configured; it no longer reports configured=true unconditionally.
- Added /api/ai/health for deployment liveness checks.
- Production CORS uses an explicit allow-list. Capacitor local origins are allowed; add the hosted web origin to CORS_ALLOWED_ORIGINS.
- Added a basic per-instance rate limit for /api/ai endpoints. This is a safety net, not a replacement for a shared Redis limiter when scaling to multiple instances.
- CI now runs TypeScript validation and the existing test suite before web and Android builds, including pushes to feature/google-integration.

## Runtime environment
Required:
- GEMINI_API_KEY: Gemini API key stored in Render Environment, never in Vite variables or the Android package.

Recommended:
- CORS_ALLOWED_ORIGINS: comma-separated exact trusted web origins (for example https://your-domain.example).
- API_RATE_WINDOW_MS: rate-limit window in milliseconds (default 60000).
- API_RATE_MAX: requests per IP per window (default 60).

Native Capacitor origins are explicitly allowed. Production web clients must be listed in CORS_ALLOWED_ORIGINS.

## Cloud memory status
The current application memory repository persists data in browser localStorage. Cloud backup/sync is NOT enabled by this commit. A production cloud-memory rollout requires a persistent database (for example managed PostgreSQL), authenticated user identity, per-user authorization, encryption at rest, retention/deletion controls, and a migration/restore strategy. Do not store user memories in Render's ephemeral filesystem or expose a shared unauthenticated memory endpoint.

## Google integration status
Google Drive, Gmail, and Photos Picker require a Google Cloud project, OAuth consent configuration, verified redirect URIs, least-privilege scopes, and secure token storage. No OAuth client secrets are committed. Gmail send actions must retain an explicit user confirmation step. Photos access should use the supported Picker flow rather than unrestricted library scraping.

## Wake-word status
The existing Android speech-recognition bridge supports foreground speech input. Always-on wake-word detection is not enabled by this upgrade because it requires a dedicated foreground microphone service, explicit user opt-in, battery policy handling, privacy indicators, and device-level tests. Do not claim wake-word is active until those tests pass.

## Offline mode status
Existing local command detection and native Android actions provide limited offline behavior. General-purpose offline LLM responses are not available merely by enabling a toggle; they require a separately packaged/downloaded on-device model and device capability checks. Keep the UI honest about online-only AI features.

## Advanced automation safety
Multi-step routines must execute only approved allow-listed actions. Calls, messages, purchases, deleting data, account changes, and other sensitive actions require confirmation. Automation must have a visible run log, cancel/stop control, and permission checks before each action.

## Validation still required
CI build/test results are the source of truth for compile and unit-test status. Real device tests are still required for microphone/STT, TTS, accessibility, notification listener, camera, Android background behavior, and sensitive-action confirmation. Render deployment must be checked separately after environment variables are configured.

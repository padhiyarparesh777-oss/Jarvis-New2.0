# JARVIS Implementation Audit — 2026-11-06

## Scope and safety boundary

- Repository: `padhiyarparesh777-oss/Jarvis-New2.0`
- Audited branch: `feature/google-integration`
- The `main` branch was not modified.
- This is a source review of the branch files listed below; it is not a live Render, Supabase, Android-device, or OAuth verification.

## Current verified baseline

### Backend and deployment
- `server.ts` starts an Express server and serves the Vite SPA in production.
- AI endpoints currently include health, status, chat, screen analysis, transcription, TTS, and TTS diagnostics.
- `render.yaml` defines a Render Free Node web service and currently configures `GEMINI_API_KEY`, `CORS_ALLOWED_ORIGINS`, and AI rate-limit settings.
- The client AI service points to the Render host `https://jarvis-ai-backend-pdy8.onrender.com`.
- The backend has an in-memory per-IP limiter under `/api/ai`; it is instance-local and not a shared/distributed limiter.

### Integrations and OAuth
- The Plugin Hub UI/catalog exists for Google Workspace and Spotify.
- The client opens only configured HTTPS OAuth entry URLs using the public Vite variables `VITE_PLUGIN_GOOGLE_CONNECT_URL` and `VITE_PLUGIN_SPOTIFY_CONNECT_URL`.
- `docs/PLUGIN_HUB.md` explicitly records that the OAuth backend routes, encrypted token vault, provider action adapters, and real-consent tests are not implemented.
- No Google OAuth callback or token-vault implementation was found in the inspected backend source.
- Do not set the Vite connect URL to a secret or token. Vite variables are public in the app bundle.

### Database
- No Supabase/PostgreSQL client or database integration is present in the inspected `package.json` dependencies or `server.ts`.
- A configured Render environment variable alone does not prove database connectivity. The app needs a server-side database adapter, schema/migrations, and a health/connection test before Supabase can be considered integrated.

### Existing app capabilities
- The client has a substantial AI service, voice pipeline, device-action layer, memory repository, settings UI, and tests.
- Existing device-action policy tests cover opening apps as direct actions and require confirmation for calls and WhatsApp messages.
- Existing client-side memory repository is not evidence of durable server-side cross-device memory.

## Risks and implementation blockers

1. **No backend user/session identity for personal OAuth.** Before connecting a Google account, establish a personal-only authorization boundary so an unauthenticated caller cannot start or use the connected account.
2. **No OAuth state/session/token vault.** Implement state validation, server-side code exchange, encrypted refresh-token storage, refresh handling, disconnect/revocation, and status metadata without returning secrets.
3. **No verified database adapter.** Add PostgreSQL connectivity and migrations, then verify it from Render without printing credentials.
4. **AI endpoints are not user-authenticated.** The current IP limiter is useful as a basic safeguard but is not a replacement for user authentication, abuse controls, or a shared limiter. The current client-IP extraction trusts the first forwarded header value; harden this using the deployment's trusted-proxy configuration before relying on IP quotas.
5. **Large JSON request allowance.** The global 35 MB JSON limit supports attachments but increases memory pressure. Add endpoint-specific limits and attachment validation when separating the upload/AI request paths.
6. **Production readiness is unverified.** TypeScript checks, unit tests, Render health, Supabase connectivity, Android build, and OAuth consent must be run and recorded after each relevant change.

## Recommended implementation order

### Stage 0 — Baseline and guardrails
- Keep all work on `feature/google-integration`.
- Record the branch head and inspect workflows before changing runtime code.
- Run lint, tests, and production build; capture existing failures as baseline.
- Never put secrets in source, Vite variables, APK assets, commits, logs, or chat.

### Stage 1 — Backend and database foundation
- Add a server-only PostgreSQL adapter and versioned migrations.
- Add a database health check that reports only connected/disconnected state.
- Add personal-only API authentication, request validation, endpoint-specific body limits, trusted-proxy-aware rate limiting, security headers, and structured redacted logs.
- Add tests for missing/invalid auth, rate limits, validation, and DB-unavailable behavior.

### Stage 2 — Google OAuth (personal account)
- Add a single approved Google account allowlist.
- Implement OAuth authorization-code flow with state validation and exact redirect URI matching.
- Exchange codes only on the backend.
- Encrypt refresh tokens at rest using a strong key held only in Render environment variables.
- Add token refresh, status, disconnect/revocation, audit events, and least-privilege scopes.
- Start with one low-risk integration (Calendar read-only); add Gmail/Drive scopes only when each feature is ready.

### Stage 3 — AI, voice, memory, and agent
- Refactor AI provider selection and tool orchestration behind typed service boundaries.
- Preserve the existing voice/device-action behavior and confirmation policy.
- Move approved long-term memory to PostgreSQL with user-visible export/delete controls.
- Add agent planning with allowlisted tools, bounded steps, timeouts, and approval gates for consequential actions.

### Stage 4 — Android, proactive workflows, and release
- Validate native permissions and device actions on a real Android device.
- Add foreground/background execution only within Android platform limits and user-granted permissions.
- Add opt-in scheduled workflows and quiet hours.
- Run CI, security tests, Android release build, and production smoke tests.

## Acceptance gates

- No secret is present in the repository or client bundle.
- All private API routes reject unauthenticated requests.
- OAuth callback rejects missing, mismatched, expired, or replayed state.
- Database stores encrypted provider credentials only; API responses never expose tokens.
- Disconnect removes stored credentials and attempts provider revocation where supported.
- Existing device-action confirmation tests continue to pass.
- `npm run lint`, `npm test`, and `npm run build` pass, or any known baseline failure is documented and resolved before release.

## Files reviewed

- `package.json`
- `server.ts`
- `render.yaml`
- `.env.example`
- `tsconfig.json`
- `vite.config.ts`
- `docs/PLUGIN_HUB.md`
- `src/modules/plugins/pluginHub.ts`
- `src/modules/settings/SettingsModal.tsx`
- `src/modules/ai/aiService.ts`
- `test/jarvis.test.ts`

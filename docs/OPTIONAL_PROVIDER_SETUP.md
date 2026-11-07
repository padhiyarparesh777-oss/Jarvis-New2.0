# Optional AI provider setup

The backend exposes two optional provider adapters. They are deliberately server-side so provider secrets are never shipped in the APK.

## OpenRouter

Set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` in the backend host environment. Default model: `openai/gpt-4o-mini`.

## Ollama

Set `OLLAMA_BASE_URL` to an address reachable **from the backend process** and `OLLAMA_MODEL` to an installed model (for example `qwen2.5:3b`). A phone's `127.0.0.1` is not the backend host; use the actual reachable Ollama host when backend and Ollama run on different devices.

## API

- `GET /api/ai/providers/status` reports whether each provider has server configuration.
- `POST /api/ai/providers/chat` accepts `{ "provider": "openrouter" | "ollama", "messages": [{ "role": "user", "content": "..." }] }` and returns `{ "text": "...", "provider": "...", "model": "..." }`.

The adapter validates message count/size, enforces a 45-second upstream timeout, clamps temperature, and returns sanitized errors. These endpoints are backend primitives; the current app settings/chat UI has not yet been wired to select them, and tool calling/streaming is not yet supported by these adapters.

## Google Workspace integrations

Gmail, Calendar, Drive, Meet, and Notes require a Google Cloud OAuth client, consent-screen configuration, exact redirect URI, least-privilege scopes, per-user authorization, encrypted server-side token storage, refresh/revocation handling, and user confirmation for writes. The repository currently has no complete OAuth/token lifecycle, so these integrations are **not enabled** by adding client ID/secret placeholders alone. Configure Google OAuth credentials only after the callback URL and token-storage deployment are finalized. Do not put client secrets or refresh tokens in the APK, frontend settings, or committed files.

## Remaining integration work

- Add provider selector and model settings to the app UI and route chat/TTS through the selected provider.
- Add provider streaming and safe tool-call schema support.
- Complete Google OAuth authorization callback, encrypted token persistence, account isolation, Gmail/Calendar/Drive adapters, and consented device tests.
- Meetings, Finance, Team Chat, and Notion/Notes need their own supported APIs and explicit account connections; they are not generic Google OAuth features.

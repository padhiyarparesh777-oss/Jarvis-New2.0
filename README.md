# JARVIS-New2.0

## Simple Google Gemini backend

JARVIS uses one lightweight Node.js backend hosted on Render. The backend connects directly to the Google Gemini API using the private `GEMINI_API_KEY` environment variable. The key must never be placed in the Android app or frontend source.

### Render deployment

1. Create one Render Web Service from this repository.
2. Runtime: Node; Build command: `npm install --no-audit --no-fund && npm run build`; Start command: `npm run start`.
3. Add `GEMINI_API_KEY` in Render Environment using your Google AI Studio API key.
4. Optional: set `JARVIS_DIAGNOSTICS_TOKEN` only if you want authenticated remote diagnostics.

The Android app sends requests to the JARVIS backend; the backend calls Google Gemini directly. If Gemini is unavailable or the API quota is exhausted, JARVIS reports the error instead of silently switching to another provider.

## Developer Mode & diagnostics

Open Settings → Diagnostics → Developer Mode to run runtime, local storage, backend health, and diagnostic-capture checks. Local diagnostic events stay on the device. Remote reports are disabled by default and can be enabled only when the backend token is configured. Only sanitized technical summaries are sent over HTTPS; chats, contacts, screenshots, audio, and attachments are excluded.

## Android build

The GitHub Actions workflow validates TypeScript, runs regression tests, builds the web app, syncs Capacitor Android, and produces a debug APK. Native Android code, permissions, and manifest changes require a new APK installation.

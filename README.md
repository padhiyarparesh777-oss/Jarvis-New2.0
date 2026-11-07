# JARVIS 2.0

A voice-first personal AI assistant built with React, TypeScript, Capacitor, Android native services, and a Node.js/Gemini backend.

> JARVIS is under active development. A visible control or configured integration does not necessarily mean its complete end-to-end workflow is implemented. See the roadmap and implementation status before relying on a feature.

## Project structure

- `src/` — React UI, chat, AI client, voice pipeline, offline commands, memory and agent modules.
- `android/` — Capacitor Android project and native Java plugins/services.
- `server.ts` — Express backend and Gemini integration.
- `test/` — automated TypeScript tests.
- `docs/` — architecture, audit notes and implementation roadmap.
- `.github/workflows/` — CI validation and Android debug APK build.

## Requirements

- Node.js 22 (CI baseline)
- npm
- Java 21 for Android builds
- Android SDK and a compatible Gradle installation for local APK builds

## Local development

Install dependencies:

```bash
npm ci
```

Create a local `.env` file from `.env.example` and configure the required server secrets. Never commit `.env`, API keys, OAuth secrets, or signing credentials.

Start the backend development process:

```bash
npm run dev
```

In another terminal, start the Vite development server using the project's configured Vite command or the available npm scripts.

## Validation

Run the same core checks used by CI:

```bash
npm run lint
npm test
npm run build
npx cap sync android
```

Build a debug APK:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is generated at:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Android permissions and user control

JARVIS requests Android capabilities only when the relevant feature is used. Microphone, camera, notification access, accessibility, and display-over-other-apps access are sensitive capabilities and must remain under the user's control.

The Floating Island overlay is opt-in. It must be started through the in-app Floating Island control after Android overlay permission has been granted. Moving JARVIS to the background must not silently enable or start the overlay.

Android background execution, wake-word listening, and device automation are subject to Android version, manufacturer, battery, and permission restrictions.

## Security principles

- Keep provider API keys and OAuth client secrets on the backend.
- Authenticate private backend endpoints before exposing personal data or actions.
- Validate all user and model-generated inputs.
- Treat model-generated tool calls as untrusted requests.
- Require confirmation for sensitive or destructive operations.
- Do not store access tokens in browser local storage.
- Do not log passwords, OTPs, tokens, or private message contents.
- Report actual tool results; never fabricate successful execution.

## Current implementation status

Some capabilities are foundations or partial implementations, not completed end-to-end features. In particular, local Whisper inference, complete Google OAuth provider workflows, encrypted cloud memory synchronization, and Gemini-connected autonomous native tool execution require further implementation and device testing.

See [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md) and [JARVIS OS Architecture](docs/JARVIS_OS_ARCHITECTURE.md).

## CI

GitHub Actions validates TypeScript, runs automated tests, builds the web app, syncs Capacitor, builds a debug APK, and uploads the APK as a workflow artifact.

A successful CI build confirms compilation and the checks that ran; it does not replace testing on a physical Android device.

## License

See the repository license and individual dependency licenses.

<!-- GitHub connector write-access verification: 2026-11-07; documentation-only change. -->

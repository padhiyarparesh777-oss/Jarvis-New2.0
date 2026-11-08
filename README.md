# Jarvis-New2.0

## FCC Cloud AI Gateway

Jarvis can optionally route chat requests through a separately deployed Free Claude Code (FCC) gateway. Existing Gemini and Free Unlimited modes remain available.

### Deploy on Render

1. Create a Render Blueprint from this repository and review the two services in render.yaml.
2. Deploy jarvis-fcc-gateway. It builds from fcc-cloud/Dockerfile and stores FCC state on the persistent /data disk.
3. Set ANTHROPIC_AUTH_TOKEN on the FCC service to a long random secret. PROXY_AUTH_ENABLED=true is already defined in the Blueprint.
4. Add at least one provider key to FCC, for example GEMINI_API_KEY, and set MODEL=gemini/models/gemini-3.1-flash-lite. Provider free-tier limits still apply.
5. Set Jarvis backend FCC_BASE_URL to the FCC service URL. Set FCC_API_KEY to the exact same value as FCC's ANTHROPIC_AUTH_TOKEN.
6. In Jarvis Settings > AI Brain, select FCC Cloud AI Gateway.

### Backend environment

- FCC_BASE_URL: FCC service origin, for example https://jarvis-fcc-gateway.onrender.com.
- FCC_API_KEY: must match FCC's ANTHROPIC_AUTH_TOKEN.
- FCC_MODEL: FCC model reference; default gemini/models/gemini-3.1-flash-lite.

The Android app calls the Jarvis backend only. FCC credentials are never embedded in the APK. FCC chat currently returns a complete response before Jarvis emits compatible chat events; native token streaming can be added separately.

Cost note: the FCC service uses a Render Starter plan because FCC needs persistent storage. Render and upstream provider charges/limits apply; FCC does not guarantee unlimited free inference.

## Developer Mode, OTA updates & diagnostics

### Capgo OTA (web bundle updates)
JARVIS integrates `@capgo/capacitor-updater`. OTA updates can replace the React/Vite web bundle (UI, CSS, and JavaScript) without reinstalling the APK. Native Android/Java/Kotlin changes, new Capacitor plugins, permissions, and manifest changes still require a new APK.

To activate Capgo publishing:

1. Create the JARVIS app in your Capgo dashboard and create/select the `production` channel.
2. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `CAPGO_APP_ID`: the App ID shown for JARVIS in Capgo.
   - `CAPGO_API_KEY`: a Capgo API key allowed to publish bundles for this app.
3. Run the Android workflow. After `npm run build`, CI uploads the web bundle to the `production` channel using delta updates.
4. The native updater automatically checks for updates when the app returns to foreground and applies the downloaded bundle when it backgrounds. Failed startup acknowledgement triggers Capgo rollback.

Until both GitHub secrets are set, OTA remains disabled and the APK build still works normally. Do not put the Capgo API key in source code or in the APK.

### Developer Mode
Open Settings → Diagnostics → Developer Mode to run runtime checks, inspect Capgo updater state, and view locally captured JavaScript errors.

### Secure remote diagnostics
Remote reports are disabled by default. To enable the backend receiver, configure `JARVIS_DIAGNOSTICS_TOKEN` on the JARVIS backend with a long random secret. In the app's Developer Mode, enable remote reports and enter the same token. Reports use HTTPS and include only sanitized technical event summaries; chats, contacts, screenshots, audio, and attachments are not collected. The backend keeps the most recent 200 reports in memory; they are cleared when the backend restarts.

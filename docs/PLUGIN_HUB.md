# JARVIS Plugin Hub

The Settings > App Integrations area now contains two plugin surfaces.

## Android app plugins

- Uses the existing native Capacitor `JarvisDevice.getInstalledApps()` bridge to discover launchable apps.
- Stores enabled apps and voice aliases in the existing app integration settings.
- Launches selected apps through the native `openApp` intent bridge; it does not inject into other apps or bypass their permissions.
- Android 11+ package visibility is limited to launchable apps through the manifest's launcher query.

## API plugin catalog

The initial catalog includes:
- Google Workspace: Gmail, Calendar, Drive, Maps and YouTube (one Google OAuth consent flow).
- Spotify: playback, search and playlists.

The UI only opens a deployer-configured HTTPS OAuth entry point. Configure these Vite build-time URLs:

- `VITE_PLUGIN_GOOGLE_CONNECT_URL`
- `VITE_PLUGIN_SPOTIFY_CONNECT_URL`

These URLs must point to your own backend's OAuth-start routes. Do not put provider client secrets, access tokens, refresh tokens, or private API keys in Vite variables or the Android APK. Vite variables are public in the built app.

### Backend work still required before API accounts are actually connected

Implement server-side OAuth authorization-code + PKCE/state validation, provider callback routes, encrypted token storage per authenticated user, refresh-token rotation, revocation/disconnect, status endpoints, and narrowly scoped action endpoints. Validate redirect URIs and requested scopes. The client UI deliberately does not claim a provider is connected merely because a browser tab opened.

Suggested route contract:
- `GET /api/plugins/:provider/connect` — create state/PKCE and redirect to provider consent.
- `GET /api/plugins/:provider/callback` — validate state, exchange code server-side, store encrypted tokens.
- `GET /api/plugins/:provider/status` — return connected/scopes/expiry metadata only (never tokens).
- `POST /api/plugins/:provider/disconnect` — revoke where supported and delete stored credentials.
- `POST /api/plugins/:provider/actions/:action` — execute an allow-listed provider action for the authenticated user.

Require user confirmation for message sending, email sending, calendar edits, purchases, or other consequential actions. Apply per-user authorization, rate limits, audit logs, scope minimization, and data deletion.

## Current implementation boundary

Android discovery/launch uses existing native bridge functionality. API catalog, secure connect-entry configuration, and the UI are implemented. The backend OAuth routes, encrypted token vault, provider API action adapters, and real-device consent tests are not yet implemented; API cards remain in setup-required state until the backend entry URL is configured.

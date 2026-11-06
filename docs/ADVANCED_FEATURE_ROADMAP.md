# JARVIS AI — Advanced Feature Roadmap

> Planning document only. Items below are proposed scope, not claims that the features are implemented or tested.

## Product goal

Build JARVIS as a reliable, privacy-conscious, voice-first personal AI companion for Android, with a native background runtime, natural conversation, useful device actions, personal memory, and user-approved automation.

## Phase 1 — Always-Available Voice Assistant

- [ ] Native Android foreground service with a persistent, clear listening notification.
- [ ] On-device "Hey JARVIS" wake-word detection, with explicit opt-in, visible microphone state, and a quick mute/stop control.
- [ ] Start listening for a command immediately after wake-word detection.
- [ ] Support screen-off operation where Android/OEM policies permit it; document battery-optimization and microphone permission requirements.
- [ ] Restore the service after reboot only when the user has enabled auto-start and Android permits it.
- [ ] Continuous conversation mode with turn detection, interruption/barge-in, and automatic return to wake-word standby.
- [ ] Hindi, Gujarati, Hinglish, and English recognition and responses.
- [ ] Whisper/quiet response mode and voice-controlled listening mute.

## Phase 2 — YouTube Music and Entertainment

- [ ] Understand natural requests for a specific song, artist, album, genre, devotional track, or mood.
- [ ] Search YouTube and present/select the best matching result; avoid silently choosing ambiguous matches.
- [ ] Play the selected result using a supported YouTube app/deep-link or approved playback integration.
- [ ] Voice controls: pause, resume, next, previous, replay, and open currently playing item.
- [ ] User-managed favourite songs, artists, and playlists.
- [ ] Optional Spotify playback integration when the user connects and authorizes it.
- [ ] Respect platform restrictions: background playback may depend on the YouTube app/account, supported APIs, and Android behavior. Do not promise unrestricted YouTube background playback.

## Phase 3 — Android Device Control

- [ ] Launch apps and perform supported navigation/actions.
- [ ] Quick settings actions such as Wi-Fi, Bluetooth, brightness, and volume only through supported Android APIs/settings panels and required user permissions.
- [ ] Read notifications only after the user explicitly enables Notification Listener access.
- [ ] Voice-triggered camera photo/video capture with clear Android permission handling.
- [ ] Alarms, timers, reminders, and media controls.
- [ ] Use Accessibility only for user-authorized assistive actions; avoid hidden or non-consensual interaction.
- [ ] Require confirmation for calls, messages, purchases, destructive actions, and other sensitive operations.

## Phase 4 — Emotional Memory and Personalization

- [ ] User-controlled long-term memory for preferences, important dates, goals, and explicitly saved facts.
- [ ] Conversation summaries and retrieval of relevant prior context.
- [ ] Mood-aware response style and expressive modes such as caring, cheerful, firm, sad/gentle, proud, and playful.
- [ ] Natural address preferences and configurable persona.
- [ ] Memory review, correction, export, and deletion controls.
- [ ] Treat emotions as expressive communication styles; never claim human consciousness, fabricate distress, or manipulate the user into dependency.

## Phase 5 — Google and Internet Intelligence

- [ ] Web search and current information with source links.
- [ ] Weather, news, and user-requested live information.
- [ ] Google OAuth with state validation, secure token storage, refresh/revoke/disconnect, and least-privilege scopes.
- [ ] Gmail search/read and draft creation; sending requires explicit user approval.
- [ ] Google Calendar event lookup and user-approved event creation.
- [ ] Google Drive file search and retrieval.
- [ ] Google Maps place search and navigation handoff.
- [ ] Each integration remains disabled until the user connects the account and grants the required scopes.

## Phase 6 — Autonomous Agent

- [ ] Break multi-step requests into a transparent plan.
- [ ] Execute supported low-risk steps and report progress.
- [ ] Retry recoverable failures with safe alternatives.
- [ ] Ask before sensitive, irreversible, external, or financial actions.
- [ ] Maintain an action history with outcomes and cancellation controls.
- [ ] Use allowlisted tools and scoped permissions rather than unrestricted device or shell access.

## Phase 7 — Proactive Personal Companion

- [ ] Optional morning briefing with weather, calendar, and user-selected updates.
- [ ] User-configured reminders for birthdays, anniversaries, appointments, and goals.
- [ ] Daily check-ins with configurable frequency and quiet hours.
- [ ] Goal and task progress summaries.
- [ ] Context-aware driving/quiet/office modes only when the user enables the relevant signals and permissions.
- [ ] Trusted-contact emergency workflow only when explicitly configured; never infer an emergency or send messages without a clear policy/approval.

## Phase 8 — Security, Privacy, Reliability

- [ ] Owner verification for sensitive commands using Android biometrics/PIN where appropriate.
- [ ] Visible microphone/listening indicator and immediate stop control.
- [ ] Private mode and granular permission controls.
- [ ] Secure local storage and encrypted server-side secrets; no API secrets in the APK or client bundle.
- [ ] Personal API authentication, rate limiting, audit logs, and abuse protection.
- [ ] Data export, memory deletion, retention controls, and clear privacy disclosures.
- [ ] Graceful offline/fallback behavior and recovery from network/service failures.

## Phase 9 — Quality and Release

- [ ] Unit tests for command parsing, permissions, memory, and action policies.
- [ ] Android tests for foreground service lifecycle, reboot behavior, wake-word latency, and screen-off operation.
- [ ] Device tests across Android versions and OEM battery-management policies.
- [ ] Integration tests for YouTube handoff, Google OAuth, and connected services.
- [ ] Measure wake-word false activations, missed detections, battery drain, latency, and crash rate.
- [ ] Release only after permission flows, privacy controls, and critical tests pass.

## Recommended implementation order

1. Audit and stabilize the existing native foreground service and permission flow.
2. Implement and device-test the opt-in on-device wake-word engine.
3. Add YouTube search, disambiguation, playback handoff, and media controls.
4. Complete device-control permission and confirmation policies.
5. Build user-controlled emotional memory.
6. Implement secure Google OAuth and individual integrations.
7. Add the autonomous planner and proactive workflows.
8. Complete privacy, reliability, and release testing.

## Platform constraints

Android may restrict microphone use, foreground-service starts, background launches, and auto-start behavior depending on Android version, permission state, and device manufacturer. JARVIS must explain these constraints and provide user-facing setup guidance rather than promise that it can always listen after force-stop, reboot, or OS restrictions. A foreground notification and explicit microphone permission are expected for ongoing listening.

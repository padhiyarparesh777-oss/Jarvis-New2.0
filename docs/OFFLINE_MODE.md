# JARVIS Offline Mode

## Current implementation
- Adds a deterministic local command parser for flashlight, media volume, screen brightness, Wi-Fi/Bluetooth settings, device status, and camera.
- Routes recognized local commands through the existing `handleExecuteDeviceAction` and Capacitor native device plugin.
- Blocks network-dependent communication/search intents from being guessed or silently executed.
- Uses `navigator.onLine` as an early offline signal. Cloud request failures still remain distinguishable from local command handling.

## Whisper Local engine status
The selected Whisper backend is **not yet wired into microphone capture** in this commit. The existing `SpeechRecognizer` bridge can depend on Google speech services and is not proof of Whisper/offline recognition. The Android Whisper.cpp integration needs a model file (recommended multilingual `ggml-base.bin`, approximately 142 MB) plus native microphone-to-16 kHz mono WAV capture and lifecycle management. The model must be downloaded on Wi-Fi or sideloaded; it is not bundled into the APK. Do not show Whisper as ready until model presence and native inference are verified.

## Next Whisper integration milestone
Use the maintained Android whisper.cpp AAR, load the multilingual base model from app-private external files, capture PCM audio with Android `AudioRecord`, write a valid WAV, call the local Whisper transcriber, and emit transcript events to the existing voice pipeline. Preserve the current recognizer as a user-selectable fallback until device tests pass.

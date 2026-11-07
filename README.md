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
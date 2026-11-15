# OpenCode on Render (free test)

This directory builds an isolated OpenCode 2.3.0 HTTP server for Render.

## Render settings

- Runtime: Docker
- Docker context: `opencode-render`
- Dockerfile: `opencode-render/Dockerfile`
- Plan: Free
- Region: Singapore

## Required environment variable

Set `OPENCODE_PASSWORD` to a long, unique password in Render. OpenCode 2 uses HTTP Basic authentication with the username `opencode`.

The server listens on Render's `PORT` and binds to `0.0.0.0`.

## Free-plan caveats

Render free services sleep after 15 minutes without inbound traffic and have an ephemeral filesystem. OpenCode's local session/workspace data can be lost on restart, redeploy, or spin-down. This is for connection testing only, not durable 24/7 use.

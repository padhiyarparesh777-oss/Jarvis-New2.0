# Tittu Super Tools MCP

A separate, secure MCP server for ChatGPT. It is kept under `tittu-super-tools/` on the isolated `feature/tittu-super-tools-mcp` branch so the existing JARVIS app and its `main` branch remain unchanged.

## Included tools

- `get_server_status` — MCP service health/version.
- `calculate` — safe arithmetic expression evaluation (no JavaScript eval).
- `text_analyzer` — character, word, line and reading-time stats.
- `get_current_time` — ISO/UTC time.
- `jarvis_status` — optional read-only check of the configured JARVIS `/health` endpoint.

## Requirements

- Node.js 20+
- A long random `MCP_AUTH_TOKEN`
- Public HTTPS hosting for ChatGPT remote connection, or a supported secure MCP tunnel for private development.

## Run locally (Termux or desktop)

```bash
cd tittu-super-tools
cp .env.example .env
# Edit .env and set MCP_AUTH_TOKEN to a long random value.
npm install
npm run dev
```

Health: `http://localhost:8787/health`

MCP endpoint: `http://localhost:8787/mcp` (authenticated POST; bearer token required).

For production, configure `PORT` and `MCP_AUTH_TOKEN` as host environment variables. Never commit `.env` or secrets.

## Optional JARVIS connection

After verifying the correct deployed JARVIS backend URL, set `JARVIS_API_BASE_URL` to its HTTPS base URL. The tool calls only `/health` and does not modify JARVIS. If the endpoint requires a bearer key, set `JARVIS_API_KEY`.

## Connect to ChatGPT

1. Deploy this service to a stable HTTPS host.
2. In ChatGPT web, open the custom MCP/plugin connection flow available to your account/workspace.
3. Add the server URL ending in `/mcp`.
4. Configure bearer-token authentication if supported by the selected connection flow.
5. Review the discovered tools and test read-only tools first.

Custom MCP availability depends on the ChatGPT plan and workspace permissions. ChatGPT custom MCP setup is web-only; mobile app connection setup is not currently supported. Once connected on a supported account, use the tools from ChatGPT conversations.

## Security

- Authentication is mandatory; the server returns 503 if `MCP_AUTH_TOKEN` is missing.
- JARVIS integration is read-only.
- No arbitrary URL fetch, shell execution, filesystem access, device control, or destructive actions are exposed.
- Keep tokens in host secrets, never in Git.

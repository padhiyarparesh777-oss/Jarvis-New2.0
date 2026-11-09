import express, { type Request, type Response, type NextFunction } from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Parser } from "expr-eval";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? "";
const app = express();
app.use(express.json({ limit: "1mb" }));

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_TOKEN) {
    res.status(503).json({ error: "Server authentication is not configured. Set MCP_AUTH_TOKEN." });
    return;
  }
  const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(supplied, AUTH_TOKEN)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function createMcpServer() {
  const server = new McpServer({ name: "Tittu Super Tools", version: "0.1.0" });

  server.tool("get_server_status", "Check whether Tittu Super Tools MCP server is healthy.", {}, async () => ({
    content: [{ type: "text", text: JSON.stringify({ status: "ok", service: "tittu-super-tools", version: "0.1.0", timestamp: new Date().toISOString() }) }]
  }));

  server.tool("calculate", "Safely evaluate a basic mathematical expression. Supports arithmetic, parentheses, powers and common math functions.", {
    expression: z.string().min(1).max(200)
  }, async ({ expression }) => {
    try {
      const parser = new Parser({ operators: { in: false, assignment: false, logical: false, comparison: false, conditional: false } });
      const value = parser.evaluate(expression);
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Expression did not produce a finite number.");
      return { content: [{ type: "text", text: String(value) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Invalid expression" }] };
    }
  });

  server.tool("text_analyzer", "Analyze text length, words, lines and reading time. Text is processed in memory only.", {
    text: z.string().min(1).max(20000)
  }, async ({ text }) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const result = { characters: text.length, charactersWithoutSpaces: text.replace(/\s/g, "").length, words: words.length, lines: text.split(/\r?\n/).length, estimatedReadingMinutes: Math.max(1, Math.ceil(words.length / 200)) };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("get_current_time", "Get current server time in ISO format and UTC.", {}, async () => {
    const now = new Date();
    return { content: [{ type: "text", text: JSON.stringify({ iso: now.toISOString(), utc: now.toUTCString(), unixMilliseconds: now.getTime() }) }] };
  });

  server.tool("jarvis_status", "Read the configured JARVIS backend health endpoint. Requires JARVIS_API_BASE_URL; this tool is read-only.", {}, async () => {
    const base = process.env.JARVIS_API_BASE_URL?.trim();
    if (!base) return { isError: true, content: [{ type: "text", text: "JARVIS_API_BASE_URL is not configured yet. Set it after confirming your deployed JARVIS backend URL." }] };
    let url: URL;
    try { url = new URL(base); } catch { return { isError: true, content: [{ type: "text", text: "JARVIS_API_BASE_URL is not a valid URL." }] }; }
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return { isError: true, content: [{ type: "text", text: "JARVIS status endpoint must use HTTPS (localhost is allowed for development)." }] };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const headers: Record<string, string> = { accept: "application/json" };
      if (process.env.JARVIS_API_KEY) headers.authorization = `Bearer ${process.env.JARVIS_API_KEY}`;
      const response = await fetch(new URL("/health", url), { headers, signal: controller.signal });
      const body = await response.text();
      return { content: [{ type: "text", text: JSON.stringify({ httpStatus: response.status, ok: response.ok, body: body.slice(0, 4000) }) }], isError: !response.ok };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "Could not reach JARVIS backend." }] };
    } finally { clearTimeout(timeout); }
  });

  return server;
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "tittu-super-tools", version: "0.1.0" }));

app.post("/mcp", requireAuth, async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

app.get("/mcp", requireAuth, async (_req, res) => {
  res.status(405).json({ error: "This stateless MCP endpoint accepts POST requests only." });
});
app.delete("/mcp", requireAuth, async (_req, res) => {
  res.status(405).json({ error: "This stateless MCP endpoint does not support DELETE." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tittu Super Tools MCP listening on port ${PORT}`);
});

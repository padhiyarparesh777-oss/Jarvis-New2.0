import type { Express, Request, Response } from "express";

type Provider = "openrouter" | "ollama";

function providerStatus() {
  return {
    openrouter: {
      configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    },
    ollama: {
      configured: Boolean(process.env.OLLAMA_BASE_URL?.trim()),
      model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
      baseUrlConfigured: Boolean(process.env.OLLAMA_BASE_URL?.trim()),
    },
  };
}

function normalizeMessages(value: unknown): Array<{ role: "system" | "user" | "assistant"; content: string }> | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const messages = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (!["system", "user", "assistant"].includes(String(role)) || typeof content !== "string" || content.length > 20000) return null;
    messages.push({ role: role as "system" | "user" | "assistant", content });
  }
  return messages;
}

export function registerProviderRoutes(app: Express): void {
  app.get("/api/ai/providers/status", (_req: Request, res: Response) => {
    res.json(providerStatus());
  });

  app.post("/api/ai/providers/chat", async (req: Request, res: Response) => {
    const provider = req.body?.provider as Provider;
    const messages = normalizeMessages(req.body?.messages);
    if (!messages) {
      res.status(400).json({ error: "INVALID_MESSAGES", message: "Provide 1–40 valid chat messages." });
      return;
    }
    if (provider !== "openrouter" && provider !== "ollama") {
      res.status(400).json({ error: "UNSUPPORTED_PROVIDER", message: "Provider must be openrouter or ollama." });
      return;
    }

    const model = typeof req.body?.model === "string" && req.body.model.length <= 160
      ? req.body.model
      : undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      let endpoint: string;
      let headers: Record<string, string>;
      let payload: Record<string, unknown>;

      if (provider === "openrouter") {
        const apiKey = process.env.OPENROUTER_API_KEY?.trim();
        if (!apiKey) {
          res.status(503).json({ error: "PROVIDER_NOT_CONFIGURED", message: "OPENROUTER_API_KEY is not configured on the server." });
          return;
        }
        endpoint = "https://openrouter.ai/api/v1/chat/completions";
        headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
        payload = {
          model: model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          messages,
          temperature: typeof req.body?.temperature === "number" ? Math.max(0, Math.min(1.5, req.body.temperature)) : 0.7,
        };
      } else {
        const base = process.env.OLLAMA_BASE_URL?.trim();
        if (!base) {
          res.status(503).json({ error: "PROVIDER_NOT_CONFIGURED", message: "Set OLLAMA_BASE_URL on the server to enable Ollama." });
          return;
        }
        let parsed: URL;
        try { parsed = new URL(base); } catch {
          res.status(500).json({ error: "INVALID_PROVIDER_URL", message: "OLLAMA_BASE_URL must be a valid URL." });
          return;
        }
        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
          res.status(500).json({ error: "INVALID_PROVIDER_URL", message: "OLLAMA_BASE_URL must be an HTTP(S) URL without embedded credentials." });
          return;
        }
        endpoint = new URL("/api/chat", parsed).toString();
        headers = { "Content-Type": "application/json" };
        payload = {
          model: model || process.env.OLLAMA_MODEL || "qwen2.5:3b",
          messages,
          stream: false,
          options: { temperature: typeof req.body?.temperature === "number" ? Math.max(0, Math.min(1.5, req.body.temperature)) : 0.7 },
        };
      }

      const upstream = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await upstream.json().catch(() => ({})) as Record<string, any>;
      if (!upstream.ok) {
        res.status(upstream.status >= 500 ? 502 : upstream.status).json({
          error: "PROVIDER_REQUEST_FAILED",
          message: String(data?.error?.message || data?.error || data?.message || `${provider} request failed.`).slice(0, 500),
        });
        return;
      }
      const answer = provider === "openrouter"
        ? data.choices?.[0]?.message?.content
        : data.message?.content;
      if (typeof answer !== "string" || !answer.trim()) {
        res.status(502).json({ error: "EMPTY_PROVIDER_RESPONSE", message: "The selected AI provider returned no text." });
        return;
      }
      res.json({ text: answer.trim(), provider, model: data.model || model || (provider === "ollama" ? process.env.OLLAMA_MODEL : process.env.OPENROUTER_MODEL) });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      res.status(timedOut ? 504 : 502).json({
        error: timedOut ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
        message: timedOut ? "AI provider timed out after 45 seconds." : "Could not connect to the configured AI provider.",
      });
    } finally {
      clearTimeout(timeout);
    }
  });
}

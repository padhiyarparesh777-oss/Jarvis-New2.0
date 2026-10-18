import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  GoogleGenAI,
  Type,
  FunctionDeclaration,
  GenerateContentResponse,
  ThinkingLevel,
} from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const deviceActionTool: FunctionDeclaration = {
  name: "executeDeviceAction",
  description:
    "Trigger an Android device control intent or system action when the user explicitly requests opening an app, setting an alarm, setting a timer, making a phone call, sending an SMS or WhatsApp message, navigating the screen, toggling system settings, or checking device status.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      actionType: {
        type: Type.STRING,
        description:
          "One of: OPEN_APP, SET_ALARM, SET_TIMER, DIAL_NUMBER, SEND_SMS, SEND_WHATSAPP, OPEN_SETTINGS, CHECK_DEVICE_STATUS, NAVIGATE_SCREEN, WEB_SEARCH_INTENT",
      },
      targetApp: {
        type: Type.STRING,
        description:
          "Name of the application or system screen (e.g., YouTube, WhatsApp, Maps, Spotify, Camera, Gmail, Settings).",
      },
      alarmHour: {
        type: Type.INTEGER,
        description: "Hour in 24-hour format (0-23) if setting an alarm.",
      },
      alarmMinute: {
        type: Type.INTEGER,
        description: "Minute (0-59) if setting an alarm.",
      },
      timerSeconds: {
        type: Type.INTEGER,
        description: "Duration in seconds if setting a timer.",
      },
      label: {
        type: Type.STRING,
        description: "Label, message body, or search query for the action.",
      },
      phoneNumberOrContact: {
        type: Type.STRING,
        description: "Recipient phone number or contact name if dialing or messaging.",
      },
      navigationGesture: {
        type: Type.STRING,
        description:
          "If actionType is NAVIGATE_SCREEN, one of: BACK, HOME, SCROLL_DOWN, SCROLL_UP, TAP.",
      },
      requiresConfirmation: {
        type: Type.BOOLEAN,
        description:
          "True if this action is sensitive (like sending SMS/WhatsApp or placing a call) and must ask user confirmation.",
      },
    },
    required: ["actionType"],
  },
};

const saveMemoryTool: FunctionDeclaration = {
  name: "saveUserMemory",
  description:
    "Save a user-approved preference, personal detail, or recurring instruction into JARVIS persistent memory when the user explicitly asks to remember something or shares a lasting preference.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      fact: {
        type: Type.STRING,
        description: "Concise statement of the preference or fact to remember.",
      },
      category: {
        type: Type.STRING,
        description: "Category: preference, contact, routine, or language.",
      },
    },
    required: ["fact", "category"],
  },
};

const managePlannerTool: FunctionDeclaration = {
  name: "managePlannerItem",
  description:
    "Create a planner task, reminder, scheduled item, or execute a named automation routine (such as 'Work Mode') when requested by the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: {
        type: Type.STRING,
        description: "One of: ADD_TASK, ADD_REMINDER, RUN_ROUTINE",
      },
      title: {
        type: Type.STRING,
        description: "Task title, reminder text, or routine name (e.g., 'Work Mode').",
      },
      dueTime: {
        type: Type.STRING,
        description: "Optional time or schedule string (e.g., '17:00', 'Tomorrow 9 AM').",
      },
    },
    required: ["operation", "title"],
  },
};

function buildSystemInstruction(options: {
  language: string;
  responseStyle: string;
  personality: string;
  memories: string[];
  permissionsSummary: string;
}): string {
  const styleGuide =
    options.responseStyle === "concise"
      ? "Keep responses ultra-concise (1 to 2 crisp sentences maximum), calm, direct, and suitable for immediate voice playback."
      : options.responseStyle === "analytical"
      ? "Provide structured, insightful, and technically rigorous responses while remaining natural for spoken delivery."
      : "Speak naturally, intelligently, and warmly with composed futuristic precision (2 to 4 sentences unless detailed analysis is requested).";

  const personaGuide =
    options.personality === "tactical"
      ? "Adopt a composed, high-precision tactical AI demeanor."
      : options.personality === "companion"
      ? "Adopt an empathetic, warm, encouraging personal assistant demeanor."
      : options.personality === "scholar"
      ? "Adopt an analytical, research-oriented polymath demeanor."
      : "Adopt a polished executive AI chief-of-staff demeanor.";

  const langGuide =
    options.language === "hi"
      ? "Respond primarily in natural Hindi (हिन्दी). You may use common English technical terms naturally."
      : options.language === "hinglish"
      ? "Respond in natural Hinglish (conversational blend of Hindi and English written in Latin or Devanagari script matching the user's input)."
      : options.language === "gu"
      ? "Respond primarily in natural Gujarati (ગુજરાતી)."
      : options.language === "auto"
      ? "Automatically detect whether the user is speaking or typing in English, Hindi, Hinglish, or Gujarati, and reply fluently in that exact language/style."
      : "Respond in clear, articulate English unless the user speaks in Hindi, Hinglish, or Gujarati, in which case adapt seamlessly.";

  const memoryContext =
    options.memories && options.memories.length > 0
      ? `\nRelevant User Memory & Context:\n${options.memories.map((m) => `- ${m}`).join("\n")}`
      : "";

  return `You are JARVIS AI, an advanced, practical, privacy-conscious Android & Web Personal AI Assistant.
Identity & Demeanor:
- ${personaGuide}
- ${styleGuide}
- Language directive: ${langGuide}

Capabilities & Honesty Rules:
- Current Android/Runtime Permission Status: ${options.permissionsSummary || "Standard Web/Android Intent bridge active"}.
- When the user asks to open an app, set an alarm/timer, dial a number, send an SMS or WhatsApp message, navigate the screen, or check device status, invoke \`executeDeviceAction\` or confirm the prepared intent.
- When the user asks to add a task, reminder, or start a routine like "Work Mode", invoke \`managePlannerItem\`.
- When the user uploads an image, photo, camera snapshot, PDF, or file, analyze its actual contents thoroughly and answer their question or command about it.
- Never claim a restricted native Android action, call, or message succeeded automatically without user confirmation; state clearly that you have prepared the action or Android intent for confirmation.
${memoryContext}`;
}

interface IncomingAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  textContent?: string;
}

interface DetectedFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Local Instant Intent & Command Detector (English, Hindi, Hinglish, Gujarati).
 * Ensures device actions, alarms, timers, apps, calls, WhatsApp, and planner tasks work
 * even when using the Free Unlimited AI engine or when Gemini tool quota is exhausted.
 */
function detectLocalCommandTools(userText: string): DetectedFunctionCall[] {
  const calls: DetectedFunctionCall[] = [];
  const text = userText.trim();
  const lower = text.toLowerCase();

  // 1. Open App (English / Hinglish / Hindi / Gujarati)
  const appNames = [
    "youtube",
    "whatsapp",
    "spotify",
    "maps",
    "gmail",
    "chrome",
    "camera",
    "settings",
  ];
  for (const app of appNames) {
    const openRegex = new RegExp(
      `\\b(open|launch|start|kholo|khol|chalu karo|chalu)\\b.*\\b${app}\\b|\\b${app}\\b.*\\b(kholo|khol|open|chalu karo)\\b`,
      "i"
    );
    if (openRegex.test(lower)) {
      calls.push({
        name: "executeDeviceAction",
        args: {
          actionType: app === "settings" ? "OPEN_SETTINGS" : "OPEN_APP",
          targetApp: app.charAt(0).toUpperCase() + app.slice(1),
        },
      });
      return calls;
    }
  }

  // 2. Set Timer (e.g. "timer for 5 minutes", "2 minute ka timer", "timer 30 seconds")
  if (/\b(timer)\b/i.test(lower)) {
    const minMatch = lower.match(/(\d+)\s*(min|minute|minutes|मिनट)/i);
    const secMatch = lower.match(/(\d+)\s*(sec|second|seconds|सेकंड)/i);
    let totalSeconds = 60;
    if (minMatch) totalSeconds = parseInt(minMatch[1], 10) * 60;
    else if (secMatch) totalSeconds = parseInt(secMatch[1], 10);
    calls.push({
      name: "executeDeviceAction",
      args: {
        actionType: "SET_TIMER",
        timerSeconds: totalSeconds,
        label: "JARVIS Timer",
      },
    });
    return calls;
  }

  // 3. Set Alarm (e.g. "alarm for 7:30", "7 baje ka alarm")
  if (/\b(alarm|अलार्म)\b/i.test(lower)) {
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let hour = 7;
    let minute = 0;
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
    }
    calls.push({
      name: "executeDeviceAction",
      args: {
        actionType: "SET_ALARM",
        alarmHour: hour,
        alarmMinute: minute,
        label: "JARVIS Alarm",
      },
    });
    return calls;
  }

  // 4. Work Mode / Morning Briefing Routine
  if (/\b(work mode|morning briefing)\b/i.test(lower)) {
    const isMorning = lower.includes("morning");
    calls.push({
      name: "managePlannerItem",
      args: {
        operation: "RUN_ROUTINE",
        title: isMorning ? "Morning Briefing" : "Work Mode",
      },
    });
    return calls;
  }

  // 5. Remember / Memory Save
  const remMatch = text.match(/^(?:remember that|remember|yaad rakhna ki|yaad rakho)\s+(.+)/i);
  if (remMatch && remMatch[1]) {
    calls.push({
      name: "saveUserMemory",
      args: {
        fact: remMatch[1].trim(),
        category: "preference",
      },
    });
    return calls;
  }

  // 6. Remind me / Add Task
  const taskMatch = text.match(/^(?:remind me to|add task|task add karo)\s+(.+)/i);
  if (taskMatch && taskMatch[1]) {
    calls.push({
      name: "managePlannerItem",
      args: {
        operation: "ADD_REMINDER",
        title: taskMatch[1].trim(),
        dueTime: "Today",
      },
    });
    return calls;
  }

  return calls;
}

/**
 * Free Unlimited Cloud AI Engine (No API Key / Zero Rate Limits).
 * Uses Pollinations OpenAI-compatible Free Endpoint with automatic local fallback.
 */
async function generateFreeUnlimitedResponse(
  systemInstruction: string,
  messages: { role: string; content: string }[],
  attachments: IncomingAttachment[]
): Promise<string> {
  const openAiMessages: Record<string, unknown>[] = [
    { role: "system", content: systemInstruction },
  ];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isLastUser = i === messages.length - 1 && m.role !== "assistant";

    if (isLastUser && attachments && attachments.length > 0) {
      const contentParts: Record<string, unknown>[] = [];
      for (const att of attachments) {
        if (att.textContent) {
          contentParts.push({
            type: "text",
            text: `[Attached File: ${att.name}]\n${att.textContent.slice(0, 25000)}`,
          });
        } else if (att.dataBase64 && att.mimeType.startsWith("image/")) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${att.mimeType};base64,${att.dataBase64}`,
            },
          });
        }
      }
      contentParts.push({
        type: "text",
        text: String(m.content || "Analyze the attached content."),
      });
      openAiMessages.push({
        role: "user",
        content: contentParts,
      });
    } else {
      openAiMessages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      });
    }
  }

  // Try Pollinations Free OpenAI-compatible API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);
    const resp = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai",
        messages: openAiMessages,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return reply;
      }
    }
  } catch {
    // Fallback to GET endpoint or local intelligent response
  }

  try {
    const lastUserMsg = messages[messages.length - 1]?.content || "Hello";
    const promptUrl = `https://text.pollinations.ai/${encodeURIComponent(
      `You are JARVIS AI assistant. Reply concisely and naturally in the same language as the user (Hindi, Hinglish, Gujarati, or English): ${lastUserMsg}`
    )}`;
    const resp = await fetch(promptUrl);
    if (resp.ok) {
      const txt = (await resp.text()).trim();
      if (txt) return txt;
    }
  } catch {
    // Ignore and use offline built-in response
  }

  const lastInput = (messages[messages.length - 1]?.content || "").toLowerCase();
  if (
    lastInput.includes("hindi") ||
    lastInput.includes("kya") ||
    lastInput.includes("kaise") ||
    lastInput.includes("hai") ||
    lastInput.includes("hain")
  ) {
    return "Main JARVIS AI hoon. Aapka Free Unlimited AI engine active hai—aap mujhse Hindi, Hinglish, Gujarati ya English mein koi bhi sawaal pooch sakte hain ya phone command de sakte hain.";
  }
  return "JARVIS AI Free Unlimited Core is online and ready. How can I assist you today?";
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "35mb" }));

  // 1. Check AI Backend Status & Model Availability
  app.get("/api/ai/status", async (_req, res) => {
    const ai = getGeminiClient();
    res.json({
      configured: true,
      provider: ai
        ? "Auto-Hybrid (Google Gemini + Free Unlimited AI)"
        : "Free Unlimited AI Engine (No Key Required)",
      models: ["gemini-3.1-flash-lite", "gemini-3.8-flash"],
      ttsModel: "gemini-3.8-flash-lite-tts",
      transcribeModel: "gemini-3.5-transcribe",
      message: ai
        ? "Hybrid AI Core online: Gemini API + Automatic Free Unlimited AI Fallback active (Zero Rate-Limit Interruption)."
        : "Free Unlimited AI Engine active (Zero API Quota Limits).",
    });
  });

  // 2. Conversational Chat, Multimodal File/Image/PDF Analysis, Search Grounding & Tool Orchestration
  app.post("/api/ai/chat", async (req, res) => {
    const {
      provider = "auto-hybrid",
      messages = [],
      attachments = [] as IncomingAttachment[],
      model = "gemini-3.1-flash-lite",
      fallbackModel = "gemini-3.8-flash",
      temperature = 0.7,
      thinkingLevel = "LOW",
      language = "auto",
      responseStyle = "natural",
      personality = "executive",
      memories = [],
      permissionsSummary = "",
      webSearchGrounding = false,
      stream = true,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res
        .status(400)
        .json({ error: "EMPTY_MESSAGES", message: "No conversation input provided." });
      return;
    }

    const systemInstruction = buildSystemInstruction({
      language,
      responseStyle,
      personality,
      memories,
      permissionsSummary,
    });

    const lastUserMessageText = String(messages[messages.length - 1]?.content || "");
    const localToolCalls = detectLocalCommandTools(lastUserMessageText);

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
    }

    const ai = getGeminiClient();
    const shouldTryGemini = provider !== "free-unlimited" && ai !== null;

    if (shouldTryGemini && ai) {
      try {
        const validModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
        const primaryModel = validModels.includes(model) ? model : "gemini-3.1-flash-lite";
        const secondaryModel = validModels.includes(fallbackModel)
          ? fallbackModel
          : "gemini-3.8-flash";

        const formattedContents = messages.map(
          (msg: { role: string; content: string }, idx: number) => {
            const isLastUserMessage =
              idx === messages.length - 1 && msg.role !== "assistant";
            const parts: Record<string, unknown>[] = [];

            if (
              isLastUserMessage &&
              Array.isArray(attachments) &&
              attachments.length > 0
            ) {
              for (const att of attachments) {
                if (att.textContent) {
                  parts.push({
                    text: `[Attached File: ${att.name}]\n${att.textContent.slice(0, 40000)}`,
                  });
                } else if (att.dataBase64 && att.mimeType) {
                  parts.push({
                    inlineData: {
                      mimeType: att.mimeType,
                      data: att.dataBase64,
                    },
                  });
                }
              }
            }

            parts.push({
              text: String(msg.content || "Analyze the attached content."),
            });

            return {
              role: msg.role === "assistant" ? "model" : "user",
              parts,
            };
          }
        );

        const resolvedThinkingLevel =
          thinkingLevel === "HIGH"
            ? ThinkingLevel.HIGH
            : thinkingLevel === "MEDIUM"
            ? ThinkingLevel.MEDIUM
            : ThinkingLevel.LOW;

        const buildConfig = (includeSearch: boolean) => {
          const toolsList: Record<string, unknown>[] = [
            {
              functionDeclarations: [
                deviceActionTool,
                saveMemoryTool,
                managePlannerTool,
              ],
            },
          ];
          if (includeSearch) {
            toolsList.push({ googleSearch: {} });
          }
          return {
            systemInstruction,
            temperature: Number(temperature),
            thinkingConfig: { thinkingLevel: resolvedThinkingLevel },
            tools: toolsList,
            ...(includeSearch
              ? { toolConfig: { includeServerSideToolInvocations: true } }
              : {}),
          };
        };

        if (stream) {
          let responseStream;
          try {
            responseStream = await ai.models.generateContentStream({
              model: primaryModel,
              contents: formattedContents,
              config: buildConfig(Boolean(webSearchGrounding)),
            });
          } catch {
            // Retry without Google Search grounding or switch to secondary Gemini model
            responseStream = await ai.models.generateContentStream({
              model: secondaryModel,
              contents: formattedContents,
              config: buildConfig(false),
            });
          }

          let accumulatedText = "";
          const detectedFunctionCalls: unknown[] = [];
          const groundingSourcesMap = new Map<string, string>();

          for await (const chunk of responseStream) {
            const c = chunk as GenerateContentResponse;
            if (c.text) {
              accumulatedText += c.text;
              res.write(`data: ${JSON.stringify({ type: "text", delta: c.text })}\n\n`);
            }
            if (c.functionCalls && c.functionCalls.length > 0) {
              for (const fc of c.functionCalls) {
                detectedFunctionCalls.push(fc);
                res.write(`data: ${JSON.stringify({ type: "function_call", call: fc })}\n\n`);
              }
            }

            const gChunks = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (Array.isArray(gChunks)) {
              for (const gc of gChunks) {
                if (gc.web?.uri && gc.web?.title) {
                  groundingSourcesMap.set(gc.web.uri, gc.web.title);
                }
              }
            }
          }

          if (groundingSourcesMap.size > 0) {
            const sources = Array.from(groundingSourcesMap.entries()).map(([uri, title]) => ({
              uri,
              title,
            }));
            res.write(`data: ${JSON.stringify({ type: "grounding", sources })}\n\n`);
          }

          if (!accumulatedText.trim() && detectedFunctionCalls.length > 0) {
            const fc = detectedFunctionCalls[0] as {
              name?: string;
              args?: Record<string, unknown>;
            };
            let fallbackConfirm = "Command prepared.";
            if (fc.name === "executeDeviceAction" && fc.args) {
              const actionType = fc.args.actionType;
              const target =
                fc.args.targetApp || fc.args.phoneNumberOrContact || fc.args.label || "";
              if (actionType === "OPEN_APP") {
                fallbackConfirm = `Opening ${target || "application"} via Android intent.`;
              } else if (actionType === "SET_ALARM") {
                const h = String(fc.args.alarmHour ?? 7).padStart(2, "0");
                const m = String(fc.args.alarmMinute ?? 0).padStart(2, "0");
                fallbackConfirm = `Alarm scheduled for ${h}:${m}.`;
              } else if (actionType === "SET_TIMER") {
                fallbackConfirm = `Timer started for ${fc.args.timerSeconds || 60} seconds.`;
              } else if (actionType === "DIAL_NUMBER") {
                fallbackConfirm = `Prepared phone dialer for ${target}. Please confirm to place the call.`;
              } else if (actionType === "SEND_SMS" || actionType === "SEND_WHATSAPP") {
                fallbackConfirm = `Drafted message for ${target}. Please review and confirm before sending.`;
              }
            } else if (fc.name === "saveUserMemory" && fc.args) {
              fallbackConfirm = `Saved to memory: ${fc.args.fact}.`;
            } else if (fc.name === "managePlannerItem" && fc.args) {
              fallbackConfirm =
                fc.args.operation === "RUN_ROUTINE"
                  ? `Executing automation routine: ${fc.args.title}.`
                  : `Added to your Smart Planner: ${fc.args.title}.`;
            }
            res.write(`data: ${JSON.stringify({ type: "text", delta: fallbackConfirm })}\n\n`);
          }

          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          res.end();
          return;
        } else {
          const response = await ai.models.generateContent({
            model: primaryModel,
            contents: formattedContents,
            config: buildConfig(Boolean(webSearchGrounding)),
          });

          res.json({
            text: response.text || "",
            functionCalls: response.functionCalls || [],
          });
          return;
        }
      } catch (geminiErr) {
        // If user forced Gemini-only mode and disabled hybrid fallback, report error
        if (provider === "gemini") {
          const errMessage =
            geminiErr instanceof Error ? geminiErr.message : "Gemini API rate limit reached.";
          if (stream) {
            res.write(`data: ${JSON.stringify({ type: "error", message: errMessage })}\n\n`);
            res.end();
          } else {
            res.status(429).json({ error: "RATE_LIMIT", message: errMessage });
          }
          return;
        }
        // Otherwise seamlessly fall through to the Free Unlimited AI Engine below!
      }
    }

    // =========================================================================
    // FREE UNLIMITED AI ENGINE (Active when provider === 'free-unlimited' OR
    // automatically when Gemini hits API rate limits / quota exhaustion)
    // =========================================================================
    try {
      for (const toolCall of localToolCalls) {
        if (stream) {
          res.write(
            `data: ${JSON.stringify({ type: "function_call", call: toolCall })}\n\n`
          );
        }
      }

      const freeReply = await generateFreeUnlimitedResponse(
        systemInstruction,
        messages,
        attachments
      );

      if (stream) {
        res.write(`data: ${JSON.stringify({ type: "text", delta: freeReply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } else {
        res.json({
          text: freeReply,
          functionCalls: localToolCalls,
        });
      }
    } catch (fallbackErr) {
      const msg =
        fallbackErr instanceof Error ? fallbackErr.message : "AI service error";
      if (stream) {
        res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "AI_ERROR", message: msg });
      }
    }
  });

  // 3. Screen Understanding & Vision Analysis (`/api/ai/screen-analyze`) with Free Fallback
  app.post("/api/ai/screen-analyze", async (req, res) => {
    const { imageBase64, mimeType = "image/png", prompt = "" } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: "MISSING_IMAGE", message: "No screen image provided." });
      return;
    }

    const userQuery = prompt
      ? `User request about this screen: "${prompt}". Describe the visible screen, answer the user's request, and list 2-3 specific possible next actions.`
      : "Analyze this captured screen. Concisely describe what is visible on the screen, identify key interactive UI elements, and suggest 2-3 practical next actions the user can take.";

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: userQuery },
            ],
          },
        });

        res.json({
          analysis: (response.text || "").trim(),
        });
        return;
      } catch {
        // Fall through to Free Unlimited Vision analysis below
      }
    }

    try {
      const freeVisionText = await generateFreeUnlimitedResponse(
        "You are JARVIS AI Screen Vision analyzer.",
        [{ role: "user", content: userQuery }],
        [{ name: "screen.png", mimeType, dataBase64: imageBase64 }]
      );
      res.json({ analysis: freeVisionText });
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : "Screen analysis failed";
      res.status(500).json({
        error: "SCREEN_ANALYSIS_ERROR",
        message: errMessage,
      });
    }
  });

  // 4. Audio Transcription via Gemini (`gemini-3.5-transcribe`)
  app.post("/api/ai/transcribe", async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(200).json({ transcript: "" });
      return;
    }

    try {
      const { audioBase64, mimeType = "audio/webm", language = "auto" } = req.body;
      if (!audioBase64) {
        res.status(400).json({ error: "MISSING_AUDIO", message: "No audio data provided." });
        return;
      }

      const langHint =
        language === "hi"
          ? "The speaker is speaking Hindi (हिन्दी)."
          : language === "hinglish"
          ? "The speaker is speaking Hinglish (Hindi + English)."
          : language === "gu"
          ? "The speaker is speaking Gujarati (ગુજરાતી)."
          : language === "en"
          ? "The speaker is speaking English."
          : "The speaker may be speaking English, Hindi, Hinglish, or Gujarati.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: `Transcribe this spoken audio accurately. ${langHint} Return ONLY the exact transcribed words spoken by the user, with no commentary or quotes. If there is only silence or background noise, return an empty string.`,
            },
          ],
        },
      });

      res.json({
        transcript: (response.text || "").trim(),
      });
    } catch {
      // Return empty cleanly so client uses Web Speech transcript without throwing quota error
      res.status(200).json({ transcript: "" });
    }
  });

  // 5. 100% Free Unlimited Male Neural Text-to-Speech (Microsoft Edge Neural Male Voices + StreamElements Brian Male + Gemini Male)
  app.post("/api/ai/tts", async (req, res) => {
    const { text, voiceName = "Charon", language = "auto" } = req.body;
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      res
        .status(400)
        .json({ error: "EMPTY_TEXT", message: "No text provided for speech synthesis." });
      return;
    }

    const hasDevanagari = /[\u0900-\u097F]/.test(cleanText);
    const hasGujarati = /[\u0A80-\u0AFF]/.test(cleanText);

    // 1. Primary: Free Unlimited Microsoft Edge Neural MALE Voices (Zero API Quota Limits)
    try {
      let edgeMaleVoice = "en-IN-PrabhatNeural"; // Natural Indian/Hinglish Male Neural Voice
      if (language === "gu" || hasGujarati) {
        edgeMaleVoice = "gu-IN-NiranjanNeural"; // Gujarati Male Neural Voice
      } else if (language === "hi" || hasDevanagari) {
        edgeMaleVoice = "hi-IN-MadhurNeural"; // Hindi Male Neural Voice
      } else if (voiceName === "Fenrir") {
        edgeMaleVoice = "en-GB-RyanNeural"; // Deep British JARVIS-Style Male Neural Voice
      } else if (voiceName === "Puck") {
        edgeMaleVoice = "en-US-ChristopherNeural"; // Deep American Male Neural Voice
      } else {
        edgeMaleVoice = "en-IN-PrabhatNeural"; // Charon Default: Indian/Hinglish & English Male Neural Voice
      }

      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        edgeMaleVoice,
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
      );

      const { audioStream } = tts.toStream(cleanText.slice(0, 1200));
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        audioStream.on("data", (chunk: Buffer | Uint8Array) => {
          chunks.push(Buffer.from(chunk));
        });
        audioStream.on("end", () => resolve());
        audioStream.on("close", () => resolve());
        audioStream.on("error", (err: Error) => reject(err));
      });

      tts.close();

      if (chunks.length > 0) {
        const audioBuffer = Buffer.concat(chunks);
        if (audioBuffer.length > 128) {
          res.json({
            audioBase64: audioBuffer.toString("base64"),
            mimeType: "audio/mpeg",
          });
          return;
        }
      }
    } catch {
      // Fall through to secondary free male neural voice
    }

    // 2. Secondary Free Male Neural Voice Fallback: StreamElements 'Brian' (Deep British JARVIS Male Voice)
    try {
      const seUrl = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent(
        cleanText.slice(0, 350)
      )}`;
      const seResp = await fetch(seUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (seResp.ok) {
        const arrayBuf = await seResp.arrayBuffer();
        if (arrayBuf.byteLength > 128) {
          res.json({
            audioBase64: Buffer.from(arrayBuf).toString("base64"),
            mimeType: "audio/mpeg",
          });
          return;
        }
      }
    } catch {
      // Fall through to Gemini Male TTS if configured
    }

    // 3. Tertiary Male-Only Neural Fallback: Gemini TTS (Male voices ONLY: Charon, Fenrir, Puck)
    const ai = getGeminiClient();
    if (ai) {
      try {
        const validMaleVoices = ["Charon", "Fenrir", "Puck"];
        const selectedMaleVoice = validMaleVoices.includes(voiceName)
          ? voiceName
          : "Charon";

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [
            {
              role: "user",
              parts: [{ text: cleanText.slice(0, 1200) }],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedMaleVoice },
              },
            },
          },
        });

        const base64Audio =
          response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          res.json({
            audioBase64: base64Audio,
            mimeType: "audio/wav",
          });
          return;
        }
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Male neural TTS failed";
        res.status(500).json({ error: "TTS_ERROR", message: errMessage });
        return;
      }
    }

    res.status(500).json({
      error: "TTS_ERROR",
      message: "Male neural speech synthesis unavailable.",
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`JARVIS AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

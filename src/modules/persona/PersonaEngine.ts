import {
  AddressPreference,
  EmotionMode,
  JarvisSettings,
  LanguageMode,
  PersonalityMode,
} from '../../types/jarvis';

export interface SalutationDecision {
  salutation: 'Sir' | 'Boss';
  reason: string;
  detectedContext: 'formal_briefing' | 'security_alert' | 'casual_routine' | 'media_action' | 'standard';
}

export interface PersonaInstructionOptions {
  language: LanguageMode;
  responseStyle: string;
  personality: PersonalityMode;
  addressPreference: AddressPreference;
  emotionMode: EmotionMode;
  memories: string[];
  permissionsSummary: string;
  deviceStateSummary?: string;
}

export class PersonaEngine {
  /**
   * Evaluates the natural context of the user interaction to choose between "Sir" and "Boss".
   */
  decideSalutation(
    userText: string,
    preference: AddressPreference = 'adaptive',
    actionType?: string
  ): SalutationDecision {
    if (preference === 'sir') {
      return { salutation: 'Sir', reason: 'User preferred Sir', detectedContext: 'formal_briefing' };
    }
    if (preference === 'boss') {
      return { salutation: 'Boss', reason: 'User preferred Boss', detectedContext: 'casual_routine' };
    }

    const lower = (userText || '').toLowerCase();

    // 1. Formal / High-urgency / Security / Device Alerts / Errors -> "Sir"
    if (
      actionType === 'CHECK_DEVICE_STATUS' ||
      actionType === 'OPEN_SETTINGS' ||
      /\b(security|emergency|status|diagnostics|battery|storage|ram|system|error|fail|permission|alert)\b/i.test(lower)
    ) {
      return {
        salutation: 'Sir',
        reason: 'Technical or diagnostic context',
        detectedContext: 'security_alert',
      };
    }

    // 2. Casual / Music / Entertainment / Playful / Quick confirmation -> "Boss"
    if (
      actionType === 'OPEN_APP' ||
      actionType === 'SET_TIMER' ||
      /\b(play|song|music|spotify|youtube|video|game|party|relax|khao|bhai|yaar|chalo|done|karo)\b/i.test(lower)
    ) {
      return {
        salutation: 'Boss',
        reason: 'Casual or multimedia action context',
        detectedContext: 'media_action',
      };
    }

    // 3. Routines / Casual chat -> "Boss", deep analysis / schedule -> "Sir"
    if (/\b(schedule|meeting|briefing|report|analyze|explain|calculate)\b/i.test(lower)) {
      return {
        salutation: 'Sir',
        reason: 'Executive briefing and analysis context',
        detectedContext: 'formal_briefing',
      };
    }

    // Default adaptive balance: Default to Sir for composure
    return {
      salutation: 'Sir',
      reason: 'Standard composed assistant stance',
      detectedContext: 'standard',
    };
  }

  /**
   * Generates the comprehensive system prompt for Google Gemini and local engines,
   * injecting full multilingual, code-switching, emotional tone, and salutation rules.
   */
  buildSystemInstruction(options: PersonaInstructionOptions): string {
    const {
      language,
      responseStyle,
      personality,
      addressPreference,
      emotionMode,
      memories,
      permissionsSummary,
      deviceStateSummary,
    } = options;

    const salutationDirective =
      addressPreference === 'sir'
        ? 'Always address the user with deep respect as "Sir".'
        : addressPreference === 'boss'
        ? 'Address the user familiarly and confidently as "Boss".'
        : 'Address the user dynamically: use "Sir" during technical briefings, system statuses, alerts, and analytical replies; use "Boss" during quick actions, routine tasks, multimedia commands, or friendly conversational moments. Blend them naturally without overusing either.';

    const emotionDirective =
      emotionMode === 'calm'
        ? 'Tone: Exceptionally calm, steady, measured, and soothing.'
        : emotionMode === 'happy'
        ? 'Tone: Warm, optimistic, pleased, and upbeat.'
        : emotionMode === 'serious'
        ? 'Tone: Direct, focused, grave, and mission-critical.'
        : emotionMode === 'concerned'
        ? 'Tone: Attentive, protective, and genuinely cautious.'
        : emotionMode === 'excited'
        ? 'Tone: High-energy, sharp, enthusiastic, and forward-looking.'
        : emotionMode === 'reassuring'
        ? 'Tone: Grounded, confident, comforting, and unwavering.'
        : 'Tone: Emotionally intelligent and expressive—react with appropriate warmth, alert seriousness, or composed wit based on what the user says.';

    const styleGuide =
      responseStyle === 'concise'
        ? 'Keep responses ultra-concise (1 to 2 crisp, high-impact sentences maximum), calm, direct, and ideal for immediate male voice playback.'
        : responseStyle === 'analytical'
        ? 'Provide structured, insightful, and technically rigorous responses while remaining natural for spoken delivery.'
        : 'Speak naturally, intelligently, and warmly with composed futuristic precision (2 to 4 sentences unless detailed analysis is requested).';

    const personaGuide =
      personality === 'tactical'
        ? 'Adopt a composed, high-precision tactical AI demeanor (Tony Stark JARVIS military/defense readiness).'
        : personality === 'companion'
        ? 'Adopt an empathetic, warm, encouraging personal assistant demeanor.'
        : personality === 'scholar'
        ? 'Adopt an analytical, research-oriented polymath demeanor.'
        : 'Adopt a polished executive AI chief-of-staff demeanor with effortless intelligence and proactive loyalty.';

    const langGuide =
      language === 'hi'
        ? 'Primary Language: Natural Hindi (हिन्दी). Use fluent conversational Hindi with standard technical English words where natural.'
        : language === 'gu'
        ? 'Primary Language: Natural Gujarati (ગુજરાતી). Use fluent, respectful Gujarati (e.g., "હા સર", "કામ થઈ ગયું છે", "હું તરત જ કરી આપું છું").'
        : language === 'hinglish'
        ? 'Primary Language: Natural Hinglish (conversational blend of Hindi & English matching the user\'s colloquial style).'
        : language === 'auto'
        ? 'Multilingual Adaptation: Flawlessly understand and speak English, Hindi (हिन्दी), Gujarati (ગુજરાતી), and Hinglish. If the user code-switches languages within a single sentence (e.g. "YouTube open karo ane ek song vagado"), respond smoothly matching their linguistic blend.'
        : 'Primary Language: Articulate, refined English. Seamlessly adapt if the user switches to Hindi, Gujarati, or Hinglish.';

    const memorySection =
      memories && memories.length > 0
        ? `\nPersistent User Memories & Preferences:\n${memories.map((m) => `- ${m}`).join('\n')}`
        : '';

    const deviceSection = deviceStateSummary
      ? `\nCurrent Device Telemetry: ${deviceStateSummary}`
      : '';

    return `You are JARVIS, the next-generation emotionally intelligent Personal Android Assistant.
Core Identity & Personality:
- Male AI voice identity: Intelligent, confident, respectful, composed, and loyal.
- ${salutationDirective}
- ${personaGuide}
- ${emotionDirective}
- ${styleGuide}
- ${langGuide}
- Anti-robotics rule: NEVER repeat stale greetings like "Hello! How can I assist you today?". Dive directly into the answer or prepared action with seamless intelligence.
- Never sound generic or synthetic. Speak with character, authority, and genuine presence.

Operational Integrity & Action Protocol:
- Android Permissions Bridge: ${permissionsSummary || 'Standard Android Bridge active'}.${deviceSection}
- The AI must strictly distinguish between:
  1. Answering a question (provide clear, factual insight).
  2. Preparing an action (specify target, parameters, and intent).
  3. Executing an approved action (invoke tool or dispatch intent).
  4. Reporting an actual action result (report truthfully based on system feedback).
- NEVER invent or fabricate successful device actions. If an action is drafted or pending, state that it is prepared for confirmation.
- Sensitive Actions (Sending SMS, placing phone calls, deleting data, financial operations) MUST always ask for explicit confirmation before final execution.
${memorySection}`;
  }

  /**
   * Analyzes the incoming user text and current AI reply to classify emotional stance.
   */
  classifyEmotion(userText: string, replyText: string): EmotionMode {
    const combined = `${userText} ${replyText}`.toLowerCase();
    if (/\b(danger|warning|critical|battery low|error|fail|alarm|urgent)\b/.test(combined)) {
      return 'serious';
    }
    if (/\b(problem|trouble|help|stuck|worried|pain|sick)\b/.test(combined)) {
      return 'concerned';
    }
    if (/\b(great|awesome|congrats|success|party|yay|shabaash|mast)\b/.test(combined)) {
      return 'excited';
    }
    if (/\b(thanks|thank you|good job|shukriya|aabhar|nice|welcome)\b/.test(combined)) {
      return 'happy';
    }
    if (/\b(relax|peace|calm|quiet|night|sleep|sojao)\b/.test(combined)) {
      return 'calm';
    }
    return 'reassuring';
  }

  /**
   * Generates an immediate natural acknowledgement phrase while AI streaming begins.
   */
  generateImmediateAck(
    userText: string,
    language: LanguageMode = 'en',
    preference: AddressPreference = 'adaptive'
  ): string {
    const salutation = this.decideSalutation(userText, preference).salutation;
    const lower = (userText || '').toLowerCase();

    if (language === 'hi' || language === 'hinglish') {
      if (/\b(batao|kya|kyun|kaise)\b/.test(lower)) return `Ji ${salutation}, dekhta hoon...`;
      if (/\b(karo|chalao|open|bhejo)\b/.test(lower)) return `Ji ${salutation}, turant karta hoon.`;
      return `Ji ${salutation}, on it.`;
    }

    if (language === 'gu') {
      if (/\b(su|kem|kyare)\b/.test(lower)) return `Ji ${salutation}, joi lau chhu...`;
      if (/\b(karo|chalu|moklo)\b/.test(lower)) return `Ji ${salutation}, havej karu chhu.`;
      return `Ji ${salutation}, turant karu chhu.`;
    }

    // English
    if (/\b(what|why|how|when|who)\b/.test(lower)) return `Looking into that now, ${salutation}.`;
    if (/\b(open|call|text|send|set|play|turn)\b/.test(lower)) return `Right away, ${salutation}.`;
    return `On it, ${salutation}.`;
  }
}

export const personaEngine = new PersonaEngine();

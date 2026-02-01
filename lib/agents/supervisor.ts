// lib/agents/supervisor.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatState } from "../types";
import { retryWithBackoff } from "../retry-utility";

const genai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// ---------------------------------------------------------------------------
// FIX 2: Comprehensive emergency keyword/phrase list.
// The old list only had exact phrases like "chest pain" or "can't breathe".
// Patients describe emergencies in dozens of ways — this covers the common
// symptom-description patterns the LLM already understands but the hard-filter
// was stripping out.
// ---------------------------------------------------------------------------
const EMERGENCY_KEYWORDS: string[] = [
  // Breathing / respiratory
  "can't breathe",
  "cannot breathe",
  "difficulty breathing",
  "trouble breathing",
  "hard to breathe",
  "gasping for air",
  "gasping",
  "shortness of breath",
  "out of breath",
  "breathless",
  "choking",
  "suffocating",
  "not breathing",
  "stopped breathing",

  // Chest
  "chest pain",
  "chest tightness",
  "tight chest",
  "tightness in my chest",
  "tightness in chest",
  "chest pressure",
  "pressure in chest",
  "crushing chest",
  "squeezing chest",

  // Colour / circulation changes — classic emergency indicators
  "bluish lips",
  "blue lips",
  "bluish fingertips",
  "blue fingertips",
  "bluish skin",
  "blue skin",
  "pale skin",
  "turning blue",
  "lips turning blue",

  // Cardiac
  "heart attack",
  "heart pain",
  "heart stopped",
  "irregular heartbeat",
  "heart racing",
  "palpitations",

  // Neurological
  "stroke",
  "seizure",
  "convulsions",
  "loss of consciousness",
  "unconscious",
  "passed out",
  "fainted",
  "can't move",
  "paralysis",
  "sudden numbness",
  "sudden weakness",
  "slurred speech",
  "can't speak",
  "confusion",
  "disoriented",

  // Bleeding / trauma
  "severe bleeding",
  "uncontrolled bleeding",
  "bleeding won't stop",
  "heavy bleeding",
  "blood won't stop",

  // Poisoning / overdose
  "poisoned",
  "overdose",
  "swallowed poison",
  "toxic",

  // Allergic
  "severe allergic",
  "anaphylaxis",
  "allergic reaction",
  "swollen throat",
  "throat swelling",
  "swelling of throat",

  // Burns
  "severe burn",
  "severe burns",
  "burning skin",

  // Vomiting + breathing (the exact scenario from the screenshot)
  "vomiting and breathing",
  "breathing difficulty and vomiting",
];

/**
 * Returns true if the query contains ANY emergency signal.
 * Uses substring matching so partial phrases like "tightness in my chest"
 * still hit "tightness in chest" or "chest tightness".
 */
function hasEmergencySignal(query: string): boolean {
  const lower = query.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Returns true if the query is clearly non-healthcare (math, greetings, etc.)
 */
function isNonHealthcareQuery(query: string): boolean {
  const trimmed = query.trim();
  const nonHealthcarePatterns = [
    /^\d+[\+\-\*\/]\d+$/, // Math: 1+1
    /^\d+[<>=]\d+$/, // Comparisons: 5>6
    /^(hi|hello|hey|greetings)$/i,
    /^(ok|okay|yes|no|sure)$/i,
  ];
  return nonHealthcarePatterns.some((p) => p.test(trimmed));
}

export async function supervisorAgent(state: ChatState): Promise<string> {
  // Fast-path: if the query is clearly non-health, skip the LLM entirely
  if (isNonHealthcareQuery(state.query)) {
    console.log(
      "[Supervisor] Non-healthcare query detected (fast-path), routing to generic_faq",
    );
    return "generic_faq";
  }

  // Fast-path: if the query contains a known emergency signal, route immediately.
  // This catches cases where the LLM might under-classify due to prompt ambiguity.
  if (hasEmergencySignal(state.query)) {
    console.log(
      "[Supervisor] Emergency signal detected in query (fast-path), routing to emergency",
    );
    return "emergency";
  }

  const prompt = `You are a medical triage supervisor agent. Analyze the patient's query and determine which agent should handle it.

Available agents: clinical, personal, generic_faq, emergency

Patient Query: "${state.query}"
Chat History: ${JSON.stringify(state.chat_history.slice(-3))}

CRITICAL RULES FOR EMERGENCY:
- Respond with "emergency" if the query describes symptoms that could indicate a life-threatening condition.
- This includes but is NOT limited to: chest pain/tightness/pressure, difficulty breathing, gasping, 
  bluish or pale skin/lips/fingertips, severe bleeding, loss of consciousness, stroke symptoms, 
  seizures, severe allergic reactions, poisoning, overdose, choking, heart attack symptoms.
- Think broadly about symptom COMBINATIONS — e.g. vomiting + breathing difficulty together 
  can signal a serious emergency even if each symptom alone would not.
- DO NOT respond with "emergency" for: math problems, comparisons, greetings, non-medical questions.

RULES FOR OTHER AGENTS:
- "personal"     → queries about personal info, conversation history, past discussions, account summary
- "clinical"     → health questions / symptom descriptions that are NOT emergencies
- "generic_faq"  → FAQ-like health questions (what is diabetes, how does medication work) 
                    OR completely non-health topics (math, greetings, general knowledge)

Respond with ONLY one of these in lowercase: clinical, personal, generic_faq, emergency`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      3,
      1000,
    );

    const text = response.response.text().toLowerCase().trim();

    // Validate response is one of the known agent types
    const validAgents = ["clinical", "personal", "generic_faq", "emergency"];
    let agentType = validAgents.includes(text) ? text : "clinical";

    // Safety guard: if LLM says "emergency" but query is clearly non-health, downgrade.
    // This is the ONLY downgrade we allow. We do NOT downgrade emergency → generic_faq
    // just because a keyword is missing — the LLM already understood the context.
    if (agentType === "emergency" && isNonHealthcareQuery(state.query)) {
      console.log(
        "[Supervisor] LLM said emergency but query is clearly non-health, downgrading to generic_faq",
      );
      agentType = "generic_faq";
    }

    console.log(`[Supervisor] Routing query "${state.query}" to: ${agentType}`);
    return agentType;
  } catch (error) {
    console.error("Supervisor agent error after retries:", error);

    // ---- Fallback routing (no LLM available) ----
    const query = state.query.toLowerCase().trim();

    if (isNonHealthcareQuery(query)) {
      return "generic_faq";
    }

    if (hasEmergencySignal(query)) {
      return "emergency";
    }

    if (
      query.includes("history") ||
      query.includes("previous") ||
      query.includes("conversation") ||
      query.includes("summary") ||
      query.includes("past")
    ) {
      return "personal";
    }

    if (
      query.includes("what is") ||
      query.includes("how does") ||
      query.includes("explain") ||
      query.includes("define")
    ) {
      return "generic_faq";
    }

    // Default to clinical for anything health-sounding
    return "clinical";
  }
}

export async function shouldAskFollowUp(state: ChatState): Promise<boolean> {
  const prompt = `Based on this conversation:
Query: "${state.query}"
Answer: "${state.answer}"

Does the patient need to provide more information? Respond with "yes" or "no" only.`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      2,
      1000,
    );

    return response.response.text().toLowerCase().includes("yes");
  } catch (error) {
    console.error("Follow-up check error:", error);
    return false;
  }
}

export async function extractSeverity(
  state: ChatState,
): Promise<"low" | "medium" | "high" | "critical"> {
  const prompt = `Analyze the severity of the patient's medical condition based on their query and responses.

Query: "${state.query}"
Medical Context: ${JSON.stringify(state.chat_history.slice(-5))}

IMPORTANT: Only assess severity for actual medical/health queries. For non-medical queries (math, greetings, general questions), always respond with "low".

Respond with ONLY one: critical, high, medium, low`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      2,
      1000,
    );

    const text = response.response.text().toLowerCase().trim();

    const validSeverities: Array<"low" | "medium" | "high" | "critical"> = [
      "critical",
      "high",
      "medium",
      "low",
    ];

    if (validSeverities.includes(text as any)) {
      return text as "low" | "medium" | "high" | "critical";
    }

    return "medium";
  } catch (error) {
    console.error("Severity extraction error:", error);

    const query = state.query.toLowerCase();

    if (isNonHealthcareQuery(query)) {
      return "low";
    }

    // Use the same comprehensive check for emergency severity
    if (hasEmergencySignal(query)) {
      return "critical";
    }

    if (query.includes("severe") || query.includes("urgent")) {
      return "high";
    }

    return "medium";
  }
}

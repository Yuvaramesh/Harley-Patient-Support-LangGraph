// lib/agents/clinical-agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatState } from "../types";
import { retryWithBackoff } from "../retry-utility";
import { locationAgent } from "./location-agent";

const genai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

/**
 * Remove markdown formatting from text
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/([*_])(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[\s]*[-*+]\s+/gm, "  ")
    .replace(/^[\s]*\d+\.\s+/gm, "  ")
    .replace(/\[([^\]]+)\]$$[^)]+$$/g, "$1")
    .replace(/!\[([^\]]*)\]$$[^)]+$$/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Check if enough information has been gathered
 * Removed auto-summary trigger - frontend handles checkpoint at 7 Q/A pairs
 * Backend should only create summary when explicitly requested via createAutoSummary
 */
function hasEnoughInformation(qaPairCount: number): boolean {
  console.log("[Clinical Agent] Q/A pair check:", {
    qaPairCount,
    readyForSummary: false, // Never auto-trigger, let frontend handle checkpoint
  });

  return false;
}

/**
 * Check if we've reached 7 Q/A pairs and should ask user to continue or end
 */
function shouldShowCheckpoint(qaPairCount: number): boolean {
  // This triggers BEFORE asking the next question
  const shouldShow = qaPairCount > 0 && qaPairCount % 7 === 0;

  console.log("[Clinical Agent] Checkpoint check:", {
    qaPairCount,
    shouldShow,
    calculation: `${qaPairCount} % 7 = ${qaPairCount % 7}`,
  });

  return shouldShow;
}

function formatBufferMemory(chatHistory: any[], sessionId?: string): string {
  if (chatHistory.length === 0) return "No previous conversation history.";

  const recentExchanges = chatHistory.slice(-10); // Keep last 5 exchanges
  const memoryText = recentExchanges
    .map((msg, idx) => {
      const role = msg.role === "user" ? "Patient" : "Assistant";
      return `${role}: ${msg.content}`;
    })
    .join("\n\n");

  return `Session ID: ${
    sessionId || "unknown"
  }\n\nConversation Buffer:\n${memoryText}`;
}

export async function clinicalAgent(state: ChatState): Promise<{
  answer: string;
  followUpQuestions?: string[];
  severity: "low" | "medium" | "high" | "critical";
  needsSummary?: boolean;
  summary?: string;
  isSummaryResponse?: boolean;
  isCheckpoint?: boolean;
}> {
  const isCheckpointMoment = shouldShowCheckpoint(state.qaPairCount || 0);

  if (isCheckpointMoment) {
    console.log(
      "[Clinical Agent] Reached checkpoint at",
      state.qaPairCount,
      "Q/A pairs",
    );
    return {
      answer:
        "I have enough information from our conversation so far. Would you like to continue providing additional information, or would you like me to create a summary and send it to your doctor? type end conversation",
      severity: "medium",
      needsSummary: false,
      isSummaryResponse: false,
      isCheckpoint: true, // This tells frontend to show the checkpoint dialog
    };
  }

  // Ask next dynamic question based on conversation context
  const questionPrompt = `You are a clinical healthcare assistant gathering information from a patient.

${formatBufferMemory(state.chat_history, state.sessionId)}

Patient's Initial Query: "${state.query}"
Full Conversation History: ${JSON.stringify(state.chat_history)}

Based on the entire conversation so far, determine what critical information is still missing to understand the patient's condition.

Your task:
1. Briefly acknowledge their previous response (1 sentence)
2. Ask ONE intelligent, context-aware follow-up question to gather the most important missing information
3. Your question should be natural, empathetic, and directly related to what they've already shared
4. Focus on understanding: symptoms, duration, severity, triggers, related symptoms, medical history, medications

IMPORTANT:
- Ask ONLY ONE question
- Make it specific to their situation based on what they've already told you
- Don't ask redundant questions about information already provided
- Be conversational and caring in tone

Format your response as:
RESPONSE: [Brief acknowledgment + single contextual question in plain text]
FOLLOW_UP: CONTINUE
SEVERITY: [low/medium/high/critical based on description so far]`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(questionPrompt);
      },
      3,
      1000,
    );

    const text = response.response.text();
    const responseMatch = text.match(/RESPONSE:\s*([\s\S]*?)(?=FOLLOW_UP:|$)/);
    const severityMatch = text.match(/SEVERITY:\s*(\w+)/);

    const rawAnswer = responseMatch ? responseMatch[1].trim() : text;
    const answer = cleanMarkdown(rawAnswer);

    const severityText = severityMatch
      ? severityMatch[1].toLowerCase()
      : "medium";
    const validSeverities: Array<"low" | "medium" | "high" | "critical"> = [
      "low",
      "medium",
      "high",
      "critical",
    ];
    const severity: "low" | "medium" | "high" | "critical" =
      validSeverities.includes(severityText as any)
        ? (severityText as "low" | "medium" | "high" | "critical")
        : "medium";

    return {
      answer,
      severity,
      needsSummary: false,
      isSummaryResponse: false,
      isCheckpoint: false,
    };
  } catch (error) {
    console.error("Clinical agent error:", error);
    return {
      answer:
        "I'm experiencing technical difficulties. Please contact your healthcare provider for immediate concerns.",
      severity: "medium",
      needsSummary: false,
      isSummaryResponse: false,
      isCheckpoint: false,
    };
  }
}

export async function emergencyProtocol(state: ChatState): Promise<{
  message: string;
  emergencyNumber: string;
  nearbyClinicLocations: string[];
  needsLocation?: boolean;
  clinicInfo?: string;
}> {
  console.log("[Emergency Protocol] Executing emergency protocol");

  const query = state.query.toLowerCase();
  const recentMessages = state.chat_history.slice(-3);
  const conversationText = [
    query,
    ...recentMessages.map((m) => m.content.toLowerCase()),
  ].join(" ");

  const hasLocationKeywords =
    conversationText.includes("near") ||
    conversationText.includes("location") ||
    conversationText.includes("address") ||
    conversationText.includes("city") ||
    /\d+\.\d+,\s*-?\d+\.\d+/.test(conversationText);

  if (hasLocationKeywords) {
    try {
      console.log("[Emergency Protocol] Location detected, fetching clinics");
      const locationResult = await locationAgent(state);

      if (locationResult.clinicLocations && !locationResult.needsLocation) {
        return {
          message: `EMERGENCY DETECTED\n\n${locationResult.answer}\n\nPlease call emergency services (911) immediately if this is life-threatening. Can we end the session now?`,
          emergencyNumber: "911",
          nearbyClinicLocations: locationResult.clinicLocations.split("\n"),
          needsLocation: false,
          clinicInfo: locationResult.clinicLocations,
        };
      }
    } catch (error) {
      console.error("[Emergency Protocol] Error fetching location:", error);
    }
  }

  return {
    message:
      "EMERGENCY DETECTED\n\nThis appears to be a medical emergency. Please:\n\n1. Call 911 or your local emergency number IMMEDIATELY\n2. If safe, provide your location so I can find nearby emergency facilities\n\nTo help you find nearby emergency services, please provide:\n• Your city/area (e.g., 'New York, NY')\n• Or say 'find emergency rooms near [your location]'\n\nI need to share your profile to your doctor. Can we end the session now? or proceed with your location details?",
    emergencyNumber: "911",
    nearbyClinicLocations: [],
    needsLocation: true,
  };
}

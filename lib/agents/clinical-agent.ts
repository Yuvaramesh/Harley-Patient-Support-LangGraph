// lib/agents/clinical-agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatState } from "../types";
import { retryWithBackoff } from "../retry-utility";
import { locationAgent } from "./location-agent";

const genai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * Check if enough information has been gathered
 */
function hasEnoughInformation(chatHistory: any[]): boolean {
  const assistantQuestions = chatHistory.filter(
    (m) => m.role === "assistant"
  ).length;

  // Need at least 4-5 back-and-forth exchanges
  return assistantQuestions >= 4;
}

export async function clinicalAgent(state: ChatState): Promise<{
  answer: string;
  followUpQuestions?: string[];
  severity: "low" | "medium" | "high" | "critical";
  needsSummary?: boolean;
  summary?: string; // Summary to send to dashboard
  isSummaryResponse?: boolean; // Flag to indicate this is the final summary
}> {
  const hasEnoughInfo = hasEnoughInformation(state.chat_history);

  // If ready for summary
  if (hasEnoughInfo) {
    const summaryPrompt = `You are a clinical healthcare assistant. Create a concise medical summary.

Patient's Initial Query: "${state.query}"
Complete Conversation History: ${JSON.stringify(state.chat_history)}

Analyze the entire conversation and create a brief, structured summary that includes:
1. Chief complaint
2. Key symptoms and characteristics gathered
3. Duration and frequency
4. Severity assessment
5. Other relevant details mentioned
6. Simple statement about what this might indicate (NO recommendations or treatment advice)
7. When to seek medical care if applicable

Keep the summary concise and factual. NO markdown formatting.
DO NOT provide treatment recommendations, suggestions, or advice.

Format your response as:
RESPONSE: [Medical Summary in plain text]
FOLLOW_UP: NONE
SEVERITY: [low/medium/high/critical]`;

    try {
      const response = await retryWithBackoff(
        async () => {
          return await model.generateContent(summaryPrompt);
        },
        3,
        1000
      );

      const text = response.response.text();
      const responseMatch = text.match(
        /RESPONSE:\s*([\s\S]*?)(?=FOLLOW_UP:|$)/
      );
      const severityMatch = text.match(/SEVERITY:\s*(\w+)/);

      const rawAnswer = responseMatch ? responseMatch[1].trim() : text;
      const summaryText = cleanMarkdown(rawAnswer);

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

      // Return different message for chat UI
      return {
        answer:
          "Thank you for providing all the information. I've created a summary of our conversation and sent it to your doctor. They will review it and contact you shortly if needed. Is there anything else I can help you with?",
        severity,
        needsSummary: false,
        summary: summaryText, // This summary will be sent to dashboards
        isSummaryResponse: true, // Flag to indicate this is the final summary
      };
    } catch (error) {
      console.error("Clinical agent error:", error);
      return {
        answer:
          "I'm experiencing technical difficulties. Please contact your healthcare provider for immediate concerns.",
        severity: "medium",
      };
    }
  }

  // Ask next dynamic question based on conversation context
  const questionPrompt = `You are a clinical healthcare assistant gathering information from a patient.

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
      1000
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
      isSummaryResponse: false, // This is just a question, not the final summary
    };
  } catch (error) {
    console.error("Clinical agent error:", error);
    return {
      answer:
        "I'm experiencing technical difficulties. Please contact your healthcare provider for immediate concerns.",
      severity: "medium",
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
          message: `EMERGENCY DETECTED\n\n${locationResult.answer}\n\nPlease call emergency services (911) immediately if this is life-threatening.`,
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
      "EMERGENCY DETECTED\n\nThis appears to be a medical emergency. Please:\n\n1. Call 911 or your local emergency number IMMEDIATELY\n2. If safe, provide your location so I can find nearby emergency facilities\n\nTo help you find nearby emergency services, please provide:\n• Your city/area (e.g., 'New York, NY')\n• Or your coordinates (e.g., '40.7128,-74.0060')\n• Or say 'find emergency rooms near [your location]'",
    emergencyNumber: "911",
    nearbyClinicLocations: [],
    needsLocation: true,
  };
}

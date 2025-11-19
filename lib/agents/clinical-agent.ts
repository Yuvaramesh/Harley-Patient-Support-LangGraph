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
  return (
    text
      // Remove bold (**text** or __text__)
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      // Remove italic (*text* or _text_)
      .replace(/([*_])(.*?)\1/g, "$2")
      // Remove strikethrough (~~text~~)
      .replace(/~~(.*?)~~/g, "$1")
      // Remove inline code (`code`)
      .replace(/`([^`]+)`/g, "$1")
      // Remove headers (# ## ### etc)
      .replace(/^#{1,6}\s+/gm, "")
      // Remove horizontal rules (---, ___, ***)
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove blockquotes (> text)
      .replace(/^>\s+/gm, "")
      // Remove bullet markers but keep the text (-, *, +)
      .replace(/^[\s]*[-*+]\s+/gm, "  ")
      // Remove numbered list markers (1., 2., etc)
      .replace(/^[\s]*\d+\.\s+/gm, "  ")
      // Remove links but keep text [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Clean up multiple spaces but preserve paragraph breaks
      .replace(/ {2,}/g, " ")
      .trim()
  );
}

export async function clinicalAgent(state: ChatState): Promise<{
  answer: string;
  followUpQuestions?: string[];
  severity: "low" | "medium" | "high" | "critical";
}> {
  const prompt = `You are a clinical healthcare assistant. Help the patient with their medical query.

Patient Query: "${state.query}"
Chat History: ${JSON.stringify(state.chat_history.slice(-3))}

Provide:
1. Clear, empathetic response in plain text (NO markdown formatting - no asterisks, underscores, or dashes for formatting)
2. General health information (not medical advice)
3. When to see a doctor
4. Suggest 2-3 follow-up questions if more info is needed

IMPORTANT: Write naturally without any markdown symbols. Use simple paragraphs and line breaks only.

Format your response as:
RESPONSE: [your response in plain text]
FOLLOW_UP: [question1], [question2], [question3] or NONE
SEVERITY: [low/medium/high/critical]`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      3,
      1000
    );

    const text = response.response.text();

    const parseResponse = (
      text: string
    ): {
      answer: string;
      followUpQuestions?: string[];
      severity: "low" | "medium" | "high" | "critical";
    } => {
      const responseMatch = text.match(
        /RESPONSE:\s*([\s\S]*?)(?=FOLLOW_UP:|$)/
      );
      const followUpMatch = text.match(
        /FOLLOW_UP:\s*([\s\S]*?)(?=SEVERITY:|$)/
      );
      const severityMatch = text.match(/SEVERITY:\s*(\w+)/);

      const rawAnswer = responseMatch ? responseMatch[1].trim() : text;
      // Clean markdown from the answer
      const answer = cleanMarkdown(rawAnswer);

      const followUpText = followUpMatch ? followUpMatch[1].trim() : "";
      const severityText = severityMatch
        ? severityMatch[1].toLowerCase()
        : "medium";

      const followUpQuestions =
        followUpText && followUpText !== "NONE"
          ? followUpText.split(",").map((q) => q.trim())
          : undefined;

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

      return { answer, followUpQuestions, severity };
    };

    return parseResponse(text);
  } catch (error) {
    console.error("Clinical agent error after retries:", error);

    return {
      answer:
        "I'm currently experiencing technical difficulties connecting to the AI service. For immediate health concerns, please contact your healthcare provider or call emergency services if urgent. I'll be back online shortly to assist you.",
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

  // Check if location information is in the query or chat history
  const query = state.query.toLowerCase();

  // Check current query and last few messages for location
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
    /\d+\.\d+,\s*-?\d+\.\d+/.test(conversationText); // Check for coordinates

  // Try to extract and use location if provided
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

  // Default emergency response - ask for location
  return {
    message:
      "EMERGENCY DETECTED\n\nThis appears to be a medical emergency. Please:\n\n1. Call 911 or your local emergency number IMMEDIATELY\n2. If safe, provide your location so I can find nearby emergency facilities\n\nTo help you find nearby emergency services, please provide:\n• Your city/area (e.g., 'New York, NY')\n• Or your coordinates (e.g., '40.7128,-74.0060')\n• Or say 'find emergency rooms near [your location]'",
    emergencyNumber: "911",
    nearbyClinicLocations: [],
    needsLocation: true,
  };
}

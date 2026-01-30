// lib/agents/supervisor.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatState } from "../types";
import { retryWithBackoff } from "../retry-utility";

const genai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

export async function supervisorAgent(state: ChatState): Promise<string> {
  const prompt = `You are a medical triage supervisor agent. Analyze the patient's query and determine which agent should handle it.

Available agents: clinical, personal, generic_faq, emergency

Patient Query: "${state.query}"
Chat History: ${JSON.stringify(state.chat_history.slice(-3))}

CRITICAL RULES FOR EMERGENCY:
- ONLY respond with "emergency" if the query describes ACTUAL medical emergency symptoms
- Emergency symptoms include: severe chest pain, difficulty breathing, uncontrolled bleeding, loss of consciousness, stroke symptoms, severe allergic reaction, severe burns, suspected poisoning
- DO NOT respond with "emergency" for: math problems, comparisons (like "5>6", "3<6"), greetings, non-medical questions, or general questions

RULES FOR OTHER AGENTS:
- If query is about personal information, conversation history, past discussions, account summary, or retrieving previous conversations, respond with "personal"
- If query asks general health questions, lifestyle, symptoms, or medical concerns that are NOT emergencies, respond with "clinical"
- If query is FAQ-like (how does medication work, what is diabetes, general health info), respond with "generic_faq"
- If query is completely unrelated to health (math, greetings, general knowledge, comparisons, etc.), respond with "generic_faq"

Respond with ONLY one of these in lowercase: clinical, personal, generic_faq, emergency

Examples:
- "Can I get my previous conversation summary?" -> personal
- "Show me my conversation history" -> personal
- "What did we discuss last time?" -> personal
- "I have a headache" -> clinical
- "What is diabetes?" -> generic_faq
- "Hello" or "Hi" -> generic_faq
- "1+1" or "2+2" or "5>6" or "3<6" -> generic_faq
- "Severe chest pain and can't breathe" -> emergency
- "I'm having a heart attack" -> emergency
- "I can't breathe at all" -> emergency
- "Uncontrolled bleeding won't stop" -> emergency`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      3,
      1000,
    );

    const text = response.response.text().toLowerCase().trim();

    // Validate response
    const validAgents = ["clinical", "personal", "generic_faq", "emergency"];
    const agentType = validAgents.includes(text) ? text : "clinical";

    // Additional validation: check if the query is actually health-related
    const query = state.query.toLowerCase().trim();

    // List of non-healthcare patterns
    const nonHealthcarePatterns = [
      /^\d+[\+\-\*\/]\d+$/, // Math operations: 1+1, 2*2, etc.
      /^\d+[<>=]\d+$/, // Comparisons: 5>6, 3<6, 2=2, etc.
      /^(hi|hello|hey|greetings)$/i, // Simple greetings
      /^(ok|okay|yes|no|sure)$/i, // Simple responses
    ];

    // Check if query matches non-healthcare patterns
    const isNonHealthcare = nonHealthcarePatterns.some((pattern) =>
      pattern.test(query),
    );

    // If it's marked as emergency but the query is clearly non-healthcare, downgrade to generic_faq
    if (agentType === "emergency" && isNonHealthcare) {
      console.log(
        "[Supervisor] Non-healthcare query detected, routing to generic_faq instead of emergency",
      );
      return "generic_faq";
    }

    // Additional safety check: emergency should only trigger for actual medical emergencies
    if (agentType === "emergency") {
      const emergencyKeywords = [
        "chest pain",
        "can't breathe",
        "cannot breathe",
        "difficulty breathing",
        "severe bleeding",
        "unconscious",
        "heart attack",
        "stroke",
        "severe burn",
        "poisoned",
        "overdose",
        "severe allergic",
        "anaphylaxis",
        "choking",
        "seizure",
      ];

      const hasEmergencyKeyword = emergencyKeywords.some((keyword) =>
        query.includes(keyword),
      );

      if (!hasEmergencyKeyword) {
        console.log(
          "[Supervisor] No actual emergency keywords found, routing to generic_faq",
        );
        return "generic_faq";
      }
    }

    console.log(`[Supervisor] Routing query "${state.query}" to: ${agentType}`);
    return agentType;
  } catch (error) {
    console.error("Supervisor agent error after retries:", error);

    // Fallback: Use keyword matching as backup
    const query = state.query.toLowerCase().trim();

    // Check for non-healthcare patterns first
    const nonHealthcarePatterns = [
      /^\d+[\+\-\*\/]\d+$/,
      /^\d+[<>=]\d+$/,
      /^(hi|hello|hey|greetings)$/i,
      /^(ok|okay|yes|no|sure)$/i,
    ];

    if (nonHealthcarePatterns.some((pattern) => pattern.test(query))) {
      return "generic_faq";
    }

    // Check for actual emergencies with strict keywords
    const strictEmergencyKeywords = [
      "chest pain",
      "can't breathe",
      "cannot breathe",
      "difficulty breathing",
      "severe bleeding",
      "unconscious",
      "heart attack",
      "stroke",
      "severe burn",
      "poisoned",
      "overdose",
    ];

    if (strictEmergencyKeywords.some((keyword) => query.includes(keyword))) {
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

    // Default to generic_faq for non-healthcare questions
    return "generic_faq";
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
    return false; // Default to not asking follow-up if API fails
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

    // Validate and return proper type
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

    // Fallback: Use keyword matching
    const query = state.query.toLowerCase();

    // Check for non-healthcare patterns
    const nonHealthcarePatterns = [
      /^\d+[\+\-\*\/]\d+$/,
      /^\d+[<>=]\d+$/,
      /^(hi|hello|hey)$/i,
    ];

    if (nonHealthcarePatterns.some((pattern) => pattern.test(query))) {
      return "low";
    }

    if (
      query.includes("emergency") ||
      query.includes("severe") ||
      query.includes("critical") ||
      query.includes("urgent")
    ) {
      return "high";
    }

    return "medium";
  }
}

// lib/agents/personal-agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatState } from "../types";
import { getCollection } from "../mongodb";
import type { Communication } from "../types";
import { retryWithBackoff } from "../retry-utility";

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

export async function personalAgent(state: ChatState): Promise<{
  answer: string;
  needsEmail: boolean;
  conversationHistory?: Communication[];
}> {
  // Check if user is asking for conversation history/summary
  const query = state.query.toLowerCase();
  const isHistoryRequest =
    query.includes("previous") ||
    query.includes("past") ||
    query.includes("history") ||
    query.includes("conversation") ||
    query.includes("summary") ||
    query.includes("earlier") ||
    query.includes("before");

  if (isHistoryRequest) {
    // Check if we have user email
    if (!state.user_email || !state.patientId) {
      return {
        answer:
          "To retrieve your conversation history, I need your email address. Please provide your registered email address.",
        needsEmail: true,
      };
    }

    // Fetch conversation history from database
    try {
      const commsCollection = await getCollection<Communication>(
        "communications"
      );
      const conversationHistory = await commsCollection
        .find({ patientId: state.patientId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      if (conversationHistory.length === 0) {
        return {
          answer:
            "I couldn't find any previous conversations for your account. This might be your first interaction with our healthcare assistant.",
          needsEmail: false,
          conversationHistory: [],
        };
      }

      // Generate summary using Gemini with retry
      const historyText = conversationHistory
        .map((comm, idx) => {
          const date = new Date(comm.createdAt).toLocaleDateString();
          return `${idx + 1}. [${date}] ${comm.type.toUpperCase()}\nQ: ${
            comm.question
          }\nA: ${comm.answer}\n`;
        })
        .join("\n");

      const summaryPrompt = `You are a healthcare assistant. Generate a concise summary of the patient's entire conversation history in a SINGLE comprehensive paragraph.

Conversation History:
${historyText}

Create ONE flowing paragraph that includes:
- The patient's main health concerns and topics discussed
- Key recommendations or advice provided
- Any patterns or recurring issues
- The total number of interactions (${conversationHistory.length})

Requirements:
- Write ONLY ONE paragraph (no bullet points, no numbered lists, no line breaks within the paragraph)
- Use plain text with NO markdown formatting (no asterisks, underscores, or any markdown symbols)
- Keep it clear, empathetic, and conversational
- Maximum 150-200 words
- Flow naturally from one point to the next`;

      try {
        const response = await retryWithBackoff(
          async () => {
            return await model.generateContent(summaryPrompt);
          },
          3,
          1000
        );

        const rawSummary = response.response.text();
        const summary = cleanMarkdown(rawSummary);

        return {
          answer: `${summary}\n\nWould you like details about any specific conversation?`,
          needsEmail: false,
          conversationHistory: conversationHistory,
        };
      } catch (error) {
        console.error("Error generating summary:", error);

        // Fallback: Return basic single paragraph summary
        const topics = Array.from(
          new Set(conversationHistory.map((c) => c.type))
        ).join(", ");
        const firstDate = new Date(
          conversationHistory[conversationHistory.length - 1].createdAt
        ).toLocaleDateString();
        const lastDate = new Date(
          conversationHistory[0].createdAt
        ).toLocaleDateString();

        const basicSummary = `You have ${conversationHistory.length} recorded interactions with our healthcare assistant spanning from ${firstDate} to ${lastDate}. Your conversations have covered topics including ${topics}, with various health-related questions and personalized guidance provided throughout. I'm currently experiencing technical difficulties generating a detailed AI summary, but your complete conversation history has been retrieved successfully.`;

        return {
          answer: `${basicSummary}\n\nWould you like details about any specific conversation?`,
          needsEmail: false,
          conversationHistory: conversationHistory,
        };
      }
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      return {
        answer:
          "I encountered an error while retrieving your conversation history. Please try again or contact support if the issue persists.",
        needsEmail: false,
      };
    }
  }

  // Handle other personal queries
  const prompt = `You are a personal healthcare assistant. Help the patient with their personal health-related query.

Patient Query: "${state.query}"
Chat History: ${JSON.stringify(state.chat_history.slice(-3))}

Provide a helpful, personalized response. If the query is about:
- Personal health records: Explain what information they can access
- Account information: Guide them on how to manage their profile
- Previous conversations: Ask for their email if not provided
- General personal assistance: Provide relevant help

IMPORTANT: Write in plain text with NO markdown formatting. Do not use asterisks, underscores, dashes, or any other markdown symbols.

Keep the response warm, personal, and helpful.`;

  try {
    const response = await retryWithBackoff(
      async () => {
        return await model.generateContent(prompt);
      },
      3,
      1000
    );

    const rawAnswer = response.response.text();
    const cleanAnswer = cleanMarkdown(rawAnswer);

    return {
      answer: cleanAnswer,
      needsEmail: false,
    };
  } catch (error) {
    console.error("Personal agent error after retries:", error);

    return {
      answer:
        "I'm currently experiencing technical difficulties. For personal account assistance, please try again in a few moments or contact our support team.",
      needsEmail: false,
    };
  }
}

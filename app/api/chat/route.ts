// app/api/chat/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { runHealthcareGraph } from "@/lib/langgraph/graph";
import type { ChatMessage } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { getCollection } from "@/lib/mongodb";
import { generateContent } from "@/lib/openai";

/**
 * Generate summary using OpenAI with retry logic
 */
async function generateSummaryWithRetry(
  conversationText: string,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[API] Generating summary - Attempt ${attempt}/${maxRetries}`,
      );

      const prompt = `Please create a concise medical summary of this patient conversation. Focus on key symptoms, concerns, and assessment. Keep it professional, structured, and factual. Do NOT provide treatment recommendations.\n\nConversation:\n${conversationText}`;

      const summary = await generateContent(prompt);

      console.log("[API] Summary generated successfully");
      return summary;
    } catch (error: any) {
      console.error(`[API] Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`[API] Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Failed to generate summary after all retries");
}

/**
 * Create fallback summary if LLM fails
 */
function createFallbackSummary(messages: ChatMessage[]): string {
  if (messages.length === 0) return "No conversation data available.";

  let summary = "**Conversation Summary**\n\n";
  summary += `Total exchanges: ${Math.ceil(messages.length / 2)}\n\n`;

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  if (userMessages.length > 0) {
    summary += "**Key Topics Discussed:**\n";
    userMessages.slice(0, 3).forEach((msg, idx) => {
      const preview = msg.content.substring(0, 100);
      summary += `${idx + 1}. ${preview}${
        msg.content.length > 100 ? "..." : ""
      }\n`;
    });
  }

  if (assistantMessages.length > 0) {
    summary += "\n**Assessment Summary:**\n";
    const lastResponse =
      assistantMessages[assistantMessages.length - 1].content;
    const preview = lastResponse.substring(0, 150);
    summary += `${preview}${lastResponse.length > 150 ? "..." : ""}`;
  }

  summary +=
    "\n\n*Note: Summary created from conversation data. Generated at: " +
    new Date().toLocaleString() +
    "*";

  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[API] Raw request body:", JSON.stringify(body, null, 2));

    const {
      patientId,
      email,
      query,
      chatHistory,
      sessionId: providedSessionId,
    } = body;

    console.log("[API] Extracted fields:", {
      patientId: patientId ? "present" : "MISSING",
      email: email ? "present" : "MISSING",
      query: query ? `present (${query.length} chars)` : "MISSING",
      chatHistory: chatHistory
        ? `present (${chatHistory.length} items)`
        : "empty",
      sessionId: providedSessionId ? "present" : "will generate",
    });

    if (!patientId || !query) {
      return NextResponse.json(
        { error: "Missing required fields: patientId and query are required" },
        { status: 400 },
      );
    }

    const sessionId = providedSessionId || uuidv4();

    console.log("[API] Received chat request:", {
      patientId,
      query,
      email,
      sessionId,
    });

    const endConversationKeywords = [
      "end conversation",
      "end the conversation",
      "finish conversation",
      "stop conversation",
      "create summary",
      "end chat",
      "finish chat",
      "that's all",
      "thats all",
      "i'm done",
      "im done",
    ];

    const isEndingConversation = endConversationKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword),
    );

    if (isEndingConversation) {
      console.log(
        "[API] User wants to end conversation, generating summary...",
      );

      // Fetch full conversation history from database
      let fullChatHistory: ChatMessage[] = [];
      try {
        const commsCollection = await getCollection("communications");
        const sessionMessages = await commsCollection
          .find({ sessionId: providedSessionId })
          .sort({ createdAt: 1 })
          .toArray();

        if (sessionMessages && sessionMessages.length > 0) {
          console.log("[API] Retrieved session messages for summary:", {
            sessionId: providedSessionId,
            messageCount: sessionMessages.length,
          });

          fullChatHistory = sessionMessages.flatMap((record: any) => {
            const messages: ChatMessage[] = [];
            if (record.question) {
              messages.push({
                role: "user",
                content: record.question,
                timestamp: record.createdAt || new Date(),
              });
            }
            if (record.answer) {
              messages.push({
                role: "assistant",
                content: record.answer,
                timestamp: record.createdAt || new Date(),
              });
            }
            return messages;
          });
        }
      } catch (dbError) {
        console.error("[API] Failed to fetch session history:", dbError);
      }

      if (fullChatHistory.length === 0) {
        console.log("[API] No conversation history found");
        return NextResponse.json({
          success: true,
          shouldEndConversation: true,
          agentType: "system",
          response: {
            answer: "No conversation history found to summarize.",
          },
          sessionId,
          qaPairCount: 0,
        });
      }

      // Generate summary using OpenAI
      const conversationText = fullChatHistory
        .map(
          (msg) =>
            `${msg.role === "user" ? "Patient" : "Assistant"}: ${msg.content}`,
        )
        .join("\n\n");

      let summary: string;
      let summarySource = "ai_generated";

      try {
        summary = await generateSummaryWithRetry(conversationText);
      } catch (aiError: any) {
        console.error("[API] AI summary generation failed:", aiError.message);
        console.log("[API] Using fallback summary generation");
        summary = createFallbackSummary(fullChatHistory);
        summarySource = "fallback";
      }

      // Store summary in chat_history collection
      const timestamp = new Date();
      const chatHistoryCollection = await getCollection("chat_history");
      const qaPairCount = Math.floor(fullChatHistory.length / 2);

      const summaryRecord = {
        sessionId: providedSessionId,
        patientId,
        patientEmail: email,
        type: "summary",
        summary,
        severity: "medium",
        timestamp,
        createdAt: timestamp,
        status: "completed",
        emailSent: false,
        messageCount: fullChatHistory.length,
        summarySource,
        sentToPatient: true,
        sentToDoctor: true,
        communicationType: "clinical",
        qaPairCount,
        isConversationComplete: true,
        isConversationSummary: true,
      };

      const chatHistoryResult = await chatHistoryCollection.insertOne(
        summaryRecord as any,
      );

      console.log(
        `[API] ✓ Summary stored in CHAT_HISTORY collection (ID: ${chatHistoryResult.insertedId})`,
        {
          sessionId: providedSessionId,
          qaPairCount,
          summarySource,
          collection: "chat_history",
        },
      );

      return NextResponse.json({
        success: true,
        shouldEndConversation: true,
        agentType: "system",
        response: {
          answer:
            "Thank you for sharing your health information with me. I've created a comprehensive summary and sent it to your doctor. They will review it and may contact you if needed. Take care!",
        },
        sessionId,
        qaPairCount,
        summary,
        summaryId: chatHistoryResult.insertedId.toString(),
      });
    }

    let fullChatHistory: ChatMessage[] = (chatHistory || []).map(
      (msg: any) => ({
        role: msg.role || "user",
        content: msg.content || "",
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }),
    );

    let qaPairCount = Math.floor(fullChatHistory.length / 2);

    // If sessionId is provided and chatHistory is empty, fetch from database
    if (providedSessionId && (!chatHistory || chatHistory.length === 0)) {
      try {
        const commsCollection = await getCollection("communications");
        const sessionMessages = await commsCollection
          .find({ sessionId: providedSessionId })
          .sort({ createdAt: 1 })
          .toArray();

        if (sessionMessages && sessionMessages.length > 0) {
          console.log("[API] Retrieved session messages from database:", {
            sessionId: providedSessionId,
            messageCount: sessionMessages.length,
          });

          fullChatHistory = sessionMessages.flatMap((record: any) => {
            const messages: ChatMessage[] = [];
            if (record.question) {
              messages.push({
                role: "user",
                content: record.question,
                timestamp: record.createdAt || new Date(),
              });
            }
            if (record.answer) {
              messages.push({
                role: "assistant",
                content: record.answer,
                timestamp: record.createdAt || new Date(),
              });
            }
            return messages;
          });

          qaPairCount = sessionMessages.length;
        }
      } catch (dbError) {
        console.warn(
          "[API] Failed to fetch session history from database:",
          dbError,
        );
      }
    }

    const initialState = {
      patientId,
      query,
      chat_history: fullChatHistory,
      user_email: email,
      email: email,
      sessionId,
      qaPairCount,
    };

    console.log(
      "[API] Initial state Q/A pair count:",
      initialState.qaPairCount,
    );

    console.log("[API] Executing LangGraph...");
    const result = await runHealthcareGraph(initialState);

    console.log("[API] LangGraph execution completed");

    let response: any = {
      answer: result.answer,
    };

    if (result.agent_type === "emergency") {
      response = {
        message: result.emergencyMessage || result.answer,
        emergencyNumber: result.emergencyNumber,
        nearbyClinicLocations: result.nearbyClinicLocations || [],
        needsLocation: result.needsLocation,
        clinicInfo: result.clinicInfo,
      };
    } else if (result.agent_type === "clinical") {
      response = {
        answer: result.answer,
        followUpQuestions: result.followUpQuestions,
        severity: result.severity,
      };
    } else if (result.agent_type === "personal") {
      response = {
        answer: result.answer,
        needsEmail: result.needsEmail,
        conversationHistory: result.conversationHistory,
        personalData: result.personalData,
      };
    }

    const finalQaPairCount = qaPairCount + 1;

    return NextResponse.json({
      success: true,
      agentType: result.agent_type,
      severity: result.severity,
      response,
      emailSent: result.emailSent,
      communicationId: result.communicationId,
      sessionId,
      qaPairCount: finalQaPairCount,
      summary: result.summary,
      isSummaryResponse: result.isSummaryResponse,
      isCheckpoint: result.isCheckpoint,
    });
  } catch (error) {
    console.error("[API] Chat API error:", error);
    console.error(
      "[API] Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );

    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    message: "Healthcare Multi-Agent Chat API with LangGraph",
    version: "1.0.0",
  });
}

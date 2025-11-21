import { type NextRequest, NextResponse } from "next/server";
import { runHealthcareGraph } from "@/lib/langgraph/graph";
import type { ChatMessage } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";
import { getCollection } from "@/lib/mongodb";

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
        { status: 400 }
      );
    }

    const sessionId = providedSessionId || uuidv4();

    console.log("[API] Received chat request:", {
      patientId,
      query,
      email,
      sessionId,
    });

    let fullChatHistory: ChatMessage[] = (chatHistory || []).map(
      (msg: any) => ({
        role: msg.role || "user",
        content: msg.content || "",
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })
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

          // Extract chat messages from stored communications
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
          dbError
        );
        // Continue with empty history if database fetch fails
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
      initialState.qaPairCount
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
    });
  } catch (error) {
    console.error("[API] Chat API error:", error);
    console.error(
      "[API] Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
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

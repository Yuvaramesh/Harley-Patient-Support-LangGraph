// app/api/chat/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { runHealthcareGraph } from "@/lib/langgraph/graph";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { patientId, email, query, chatHistory } = await request.json();

    if (!patientId || !query) {
      return NextResponse.json(
        { error: "Missing required fields: patientId and query are required" },
        { status: 400 }
      );
    }

    console.log("[API] Received chat request:", {
      patientId,
      query,
      email,
    });

    // Convert chat history to proper format
    const formattedChatHistory: ChatMessage[] = (chatHistory || []).map(
      (msg: any) => ({
        role: msg.role || "user",
        content: msg.content || "",
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })
    );

    // Build initial state for LangGraph
    const initialState = {
      patientId,
      query,
      chat_history: formattedChatHistory,
      user_email: email,
    };

    // Execute the LangGraph
    console.log("[API] Executing LangGraph...");
    const result = await runHealthcareGraph(initialState);

    console.log("[API] LangGraph execution completed");

    // Build response based on agent type
    let response: any = {
      answer: result.answer,
    };

    // Add agent-specific fields
    if (result.agent_type === "emergency") {
      response = {
        message: result.emergencyMessage || result.answer,
        emergencyNumber: result.emergencyNumber,
        nearbyClinicLocations: result.nearbyClinicLocations,
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
      };
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      agentType: result.agent_type,
      severity: result.severity,
      response,
      emailSent: result.emailSent,
      communicationId: result.communicationId,
    });
  } catch (error) {
    console.error("[API] Chat API error:", error);

    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Optional: Add a GET endpoint to check API health
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    message: "Healthcare Multi-Agent Chat API with LangGraph",
    version: "1.0.0",
  });
}

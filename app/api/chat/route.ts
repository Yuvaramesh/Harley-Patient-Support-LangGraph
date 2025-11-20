// app/api/chat/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { runHealthcareGraph } from "@/lib/langgraph/graph";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[API] Raw request body:", JSON.stringify(body, null, 2));

    const { patientId, email, query, chatHistory } = body;

    console.log("[API] Extracted fields:", {
      patientId: patientId ? "present" : "MISSING",
      email: email ? "present" : "MISSING",
      query: query ? `present (${query.length} chars)` : "MISSING",
      chatHistory: chatHistory
        ? `present (${chatHistory.length} items)`
        : "empty",
    });

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
      email: email, // Explicitly set email field for consistent access
    };

    // Execute the LangGraph
    console.log("[API] Executing LangGraph...");
    const result = await runHealthcareGraph(initialState);

    console.log("[API] LangGraph execution completed");

    let response: any = {
      answer: result.answer,
    };

    // Add agent-specific fields
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
        personalData: result.personalData, // Include personal data from patients collection
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

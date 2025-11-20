import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import type { ChatHistory } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientEmail = searchParams.get("patientEmail");

    const chatHistoryCollection = await getCollection<ChatHistory>(
      "chat_history"
    );

    // Build query
    const query: any = {};
    if (patientEmail) {
      // Filter by patient email (patientId is derived from email)
      query.patientId = {
        $regex: patientEmail.replace(/[^a-zA-Z0-9]/g, ""),
        $options: "i",
      };
    }

    const chatHistories = await chatHistoryCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Transform chat_history records to match Communication interface
    const communications = chatHistories.map((chat) => ({
      _id: chat._id,
      patientId: chat.patientId,
      patientEmail: chat.patientEmail,
      type: chat.communicationType || "clinical",
      question: chat.initialMessage || "",
      answer: chat.summary || "",
      summary: chat.summary,
      severity: chat.severity,
      status: chat.status || "completed",
      createdAt: chat.createdAt,
      timestamp: chat.createdAt,
      messageCount: chat.messages?.length || 0,
    }));

    // Get unique patient IDs for summary
    const uniquePatients = [...new Set(communications.map((c) => c.patientId))];

    return NextResponse.json({
      success: true,
      communications,
      totalRecords: communications.length,
      totalPatients: uniquePatients.length,
    });
  } catch (error) {
    console.error("Doctor communications API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

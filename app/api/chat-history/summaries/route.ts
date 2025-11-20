import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const userRole = searchParams.get("userRole");
    const communicationType = searchParams.get("type");

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required" },
        { status: 400 }
      );
    }

    const chatHistoryCollection = await getCollection("chat_history");

    const query: any = { patientId };

    if (communicationType && communicationType !== "all") {
      query.communicationType = communicationType;
    }

    const chatHistories = await chatHistoryCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const communications = chatHistories.map((history: any) => ({
      _id: history._id?.toString() || "",
      patientId: history.patientId,
      patientEmail: history.patientEmail,
      type: history.communicationType || "clinical",
      summary: history.summary || "",
      status: history.status || "completed",
      createdAt: history.createdAt,
      timestamp: history.createdAt,
      messageCount: history.messages?.length || 0,
      severity: determineSeverity(history.summary),
      sentToDoctor: true,
      sentToPatient: history.communicationType !== "emergency",
    }));

    return NextResponse.json({ communications });
  } catch (error) {
    console.error("Chat History Summaries API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history summaries" },
      { status: 500 }
    );
  }
}

// Helper function to determine severity based on summary content
function determineSeverity(
  summary: string
): "low" | "medium" | "high" | "critical" {
  const text = (summary || "").toLowerCase();

  if (
    text.includes("critical") ||
    text.includes("emergency") ||
    text.includes("severe")
  ) {
    return "critical";
  }
  if (
    text.includes("high") ||
    text.includes("urgent") ||
    text.includes("serious")
  ) {
    return "high";
  }
  if (text.includes("medium") || text.includes("moderate")) {
    return "medium";
  }
  return "low";
}

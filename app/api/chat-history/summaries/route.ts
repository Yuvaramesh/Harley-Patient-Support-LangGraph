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

    const query: any = {
      patientId,
      isConversationSummary: true, // Only get summary records
    };

    if (communicationType && communicationType !== "all") {
      query.communicationType = communicationType;
    }

    const summaries = await chatHistoryCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const communications = summaries.map((record: any) => ({
      _id: record._id?.toString() || "",
      patientId: record.patientId,
      patientEmail: record.patientEmail,
      type: record.communicationType || "clinical",
      summary: record.summary || "",
      status: record.status || "completed",
      createdAt: record.createdAt,
      timestamp: record.createdAt,
      messageCount: record.messageCount || 0,
      severity: record.severity || "medium",
      sentToDoctor: record.sentToDoctor !== false,
      sentToPatient: record.sentToPatient !== false,
      sessionId: record.sessionId,
      qaPairCount: record.qaPairCount,
    }));

    console.log(
      `[v0 API] Retrieved ${communications.length} conversation summaries for patient ${patientId} from CHAT_HISTORY collection`,
      {
        userRole,
        communicationType,
        collection: "chat_history",
        NOT_from: "communications or clinical_notes",
      }
    );

    return NextResponse.json({ communications });
  } catch (error) {
    console.error("Chat History Summaries API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history summaries" },
      { status: 500 }
    );
  }
}

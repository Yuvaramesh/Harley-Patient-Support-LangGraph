import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientEmail = searchParams.get("patientEmail");
    const communicationType = searchParams.get("type");

    const chatHistoryCollection = await getCollection("chat_history");

    const query: any = {
      isConversationSummary: true, // Only get summary records
    };

    if (patientEmail) {
      query.patientEmail = patientEmail;
    }

    if (communicationType && communicationType !== "all") {
      query.communicationType = communicationType;
    }

    const summaries = await chatHistoryCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    console.log(
      `[v0 API] Doctor fetched ${summaries.length} summaries from CHAT_HISTORY collection`,
      {
        patientEmail,
        communicationType,
        collection: "chat_history",
        NOT_from: "communications or clinical_notes",
      }
    );

    return NextResponse.json({
      success: true,
      communications: summaries.map((record: any) => ({
        _id: record._id?.toString() || "",
        patientId: record.patientId,
        patientEmail: record.patientEmail,
        type: record.communicationType || "clinical",
        summary: record.summary || "",
        severity: record.severity || "medium",
        status: record.status || "completed",
        createdAt: record.createdAt,
        timestamp: record.createdAt,
        messageCount: record.messageCount || 0,
        sessionId: record.sessionId,
        qaPairCount: record.qaPairCount,
        sentToDoctor: record.sentToDoctor !== false,
        sentToPatient: record.sentToPatient !== false,
      })),
      totalRecords: summaries.length,
    });
  } catch (error) {
    console.error("[v0] Doctor communications API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

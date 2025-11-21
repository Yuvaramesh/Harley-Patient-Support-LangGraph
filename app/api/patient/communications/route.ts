import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientEmail = searchParams.get("patientEmail");
    const communicationType = searchParams.get("type");

    if (!patientEmail) {
      return NextResponse.json(
        { error: "patientEmail is required" },
        { status: 400 }
      );
    }

    // Get from communications collection (where summaries are stored)
    const commsCollection = await getCollection("communications");

    const query: any = { patientEmail };

    if (communicationType && communicationType !== "all") {
      query.type = communicationType;
    }

    const communications = await commsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    console.log(
      `[v0] Retrieved ${communications.length} communications for patient ${patientEmail}`
    );

    return NextResponse.json({
      success: true,
      communications: communications.map((comm: any) => ({
        _id: comm._id?.toString() || "",
        patientEmail: comm.patientEmail,
        type: comm.type || "clinical",
        summary: comm.summary || comm.answer || "",
        severity: comm.severity || "medium",
        status: comm.status || "completed",
        createdAt: comm.createdAt,
        timestamp: comm.createdAt,
        messageCount: comm.messageCount || 0,
        sessionId: comm.sessionId,
        qaPairCount: comm.qaPairCount,
      })),
      totalRecords: communications.length,
    });
  } catch (error) {
    console.error("[v0] Patient communications API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

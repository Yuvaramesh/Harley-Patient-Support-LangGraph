// app/api/doctor/communications/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import type { Communication } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientEmail = searchParams.get("patientEmail");

    const commsCollection = await getCollection<Communication>(
      "communications"
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

    const communications = await commsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

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

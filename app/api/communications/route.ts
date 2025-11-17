import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import type { Communication } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required" },
        { status: 400 }
      );
    }

    const commsCollection = await getCollection<Communication>(
      "communications"
    );
    const communications = await commsCollection
      .find({ patientId })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ communications });
  } catch (error) {
    console.error("Communications API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

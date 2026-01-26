import { NextRequest, NextResponse } from "next/server";
import { getAuditHistory } from "@/lib/audit-engine";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");

    console.log(`[Audit History API] Fetching audit history (limit: ${limit})`);

    const history = await getAuditHistory(limit);

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error("[Audit History API] Error retrieving history:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve audit history",
      },
      { status: 500 },
    );
  }
}

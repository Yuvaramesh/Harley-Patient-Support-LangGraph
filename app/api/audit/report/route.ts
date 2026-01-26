import { NextRequest, NextResponse } from "next/server";
import {
  generateAuditReport,
  generateReportHTML,
} from "@/lib/audit-report-generator";
import { runDynamicAudit } from "@/lib/audit-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      standards = ["NICE", "GPHC", "GDPR", "CLINICAL_SAFETY"],
      organizationName = "Healthcare AI Platform",
      format = "json", // json or html
    } = body;

    console.log(`[Report API] Generating audit report (format: ${format})`);

    // Run audit
    const auditResults = await runDynamicAudit(standards);

    // Generate report
    const report = generateAuditReport(auditResults, organizationName);

    if (format === "html") {
      const html = generateReportHTML(report);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-report-${report.reportId}.html"`,
        },
      });
    }

    // Default: JSON format
    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("[Report API] Error generating report:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate report",
      },
      { status: 500 },
    );
  }
}

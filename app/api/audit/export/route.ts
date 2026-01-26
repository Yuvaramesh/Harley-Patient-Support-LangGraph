import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auditResults, metrics, selectedAudits } = body;

    if (!auditResults) {
      return NextResponse.json(
        { error: "No audit results to export" },
        { status: 400 },
      );
    }

    // Generate CSV format report
    const csvContent = generateCSVReport(auditResults, metrics, selectedAudits);

    // Return as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-report-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("[Audit Export API] Error:", error);
    return NextResponse.json(
      { error: "Failed to export audit report" },
      { status: 500 },
    );
  }
}

function generateCSVReport(
  auditResults: any,
  metrics: any,
  selectedAudits: string[],
): string {
  let csv = "";

  // Header
  csv += "PATIENT SUPPORT AUDIT REPORT\n";
  csv += `Generated: ${new Date().toLocaleString()}\n`;
  csv += `Audit Items: ${selectedAudits.join(", ")}\n\n`;

  // Metrics Section
  csv += "COMPLIANCE METRICS\n";
  csv += "Metric,Value\n";
  csv += `Compliance Score,${auditResults.summary.complianceScore}%\n`;
  csv += `Compliant Items,${metrics.compliantCount}/${metrics.totalAudits}\n`;
  csv += `Critical Issues,${auditResults.summary.criticalFindings}\n`;
  csv += `Patients Audited,${metrics.patientsSeen}\n`;
  csv += `Records Analyzed,${auditResults.summary.recordsAnalyzed}\n\n`;

  // Findings Section
  csv += "AUDIT FINDINGS\n";
  csv += "Audit Item,Finding,Severity,Affected Records\n";
  auditResults.findings.forEach((finding: any) => {
    csv += `"${finding.auditItem.replace(/-/g, " ").toUpperCase()}","${finding.finding}","${finding.severity}",${finding.affectedRecords}\n`;
  });
  csv += "\n";

  // Recommendations Section
  csv += "RECOMMENDATIONS\n";
  csv += "Priority,Recommendation\n";
  auditResults.recommendations.forEach((rec: string, index: number) => {
    csv += `${index + 1},"${rec}"\n`;
  });

  return csv;
}

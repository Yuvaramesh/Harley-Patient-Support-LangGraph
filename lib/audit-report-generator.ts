/**
 * Audit Report Generator
 * Creates professional PDF-ready audit reports for regulatory inspectors
 */

import { AuditExecutionResult } from "./audit-engine";
import { ComplianceCheckpoint } from "./regulator-guideliness";

export interface AuditReport {
  reportId: string;
  title: string;
  auditDate: Date;
  auditId: string;
  organizationName: string;
  auditPeriod: {
    start: Date;
    end: Date;
  };
  executiveSummary: string;
  overallComplianceScore: number;
  standards: string[];
  findings: ReportFinding[];
  recommendations: ReportRecommendation[];
  complianceByStandard: StandardCompliance[];
  evidenceSummary: EvidenceSummary;
  attestation: string;
  generatedBy: string;
  generatedAt: Date;
}

export interface ReportFinding {
  id: string;
  standard: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  evidence: string[];
  affectedRecords: number;
  riskLevel: string;
  complianceGap: string;
}

export interface ReportRecommendation {
  priority: "immediate" | "short-term" | "medium-term" | "long-term";
  action: string;
  rationale: string;
  expectedOutcome: string;
  estimatedDaysToComplete: number;
}

export interface StandardCompliance {
  standard: string;
  checkpointsTotal: number;
  checkpointsPassed: number;
  complianceScore: number;
  criticalIssues: number;
  highIssues: number;
  status: "compliant" | "substantially-compliant" | "non-compliant";
}

export interface EvidenceSummary {
  patientsAudited: number;
  communicationsReviewed: number;
  dataPointsAnalyzed: number;
  auditSampleSize: number;
  coveragePercentage: number;
}

export function generateAuditReport(
  auditResults: AuditExecutionResult,
  organizationName: string = "Healthcare AI Platform",
): AuditReport {
  const reportId = `AUDIT-REPORT-${Date.now()}`;
  const auditDate = auditResults.timestamp;

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(auditResults);

  // Process findings
  const findings = processFindings(auditResults.checkpoints);

  // Generate recommendations
  const recommendations = generateRecommendations(auditResults);

  // Calculate compliance by standard
  const complianceByStandard = calculateComplianceByStandard(
    auditResults.checkpoints,
  );

  // Create evidence summary
  const evidenceSummary: EvicenceSummary = {
    patientsAudited: auditResults.evidenceCollected.patientsAudited,
    communicationsReviewed:
      auditResults.evidenceCollected.communicationsReviewed,
    dataPointsAnalyzed: auditResults.evidenceCollected.dataPointsAnalyzed,
    auditSampleSize: auditResults.checkpoints.length,
    coveragePercentage: calculateCoveragePercentage(auditResults),
  };

  // Generate attestation statement
  const attestation = generateAttestationStatement(auditResults);

  return {
    reportId,
    title: `Regulatory Compliance Audit Report - ${new Date(auditDate).toLocaleDateString()}`,
    auditDate,
    auditId: auditResults.auditId,
    organizationName,
    auditPeriod: {
      start: new Date(auditDate.getTime() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: auditDate,
    },
    executiveSummary,
    overallComplianceScore: auditResults.overallComplianceScore,
    standards: auditResults.auditedStandards,
    findings,
    recommendations,
    complianceByStandard,
    evidenceSummary,
    attestation,
    generatedBy: "Harley Health Audit System v1.0",
    generatedAt: new Date(),
  };
}

function generateExecutiveSummary(auditResults: AuditExecutionResult): string {
  const score = auditResults.overallComplianceScore;
  let scoreDescription = "non-compliant";
  if (score >= 95) scoreDescription = "fully compliant";
  else if (score >= 80) scoreDescription = "substantially compliant";
  else if (score >= 60) scoreDescription = "partially compliant";

  return `
This regulatory compliance audit was conducted on ${new Date(auditResults.timestamp).toLocaleDateString()} 
to assess the Harley Health platform's adherence to ${auditResults.auditedStandards.join(", ")} standards.

OVERALL COMPLIANCE ASSESSMENT: ${scoreDescription.toUpperCase()}
Overall Compliance Score: ${score}%

The audit evaluated ${auditResults.totalCheckpoints} regulatory checkpoints across ${auditResults.auditedStandards.length} standards.
Results: ${auditResults.passedCheckpoints} passed, ${auditResults.failedCheckpoints} failed.

Critical Findings: ${auditResults.summary.criticalIssues.length}
High Priority Findings: ${auditResults.summary.highPriorityIssues.length}

The platform demonstrates ${score >= 80 ? "strong" : "areas needing"} compliance with regulatory requirements. 
${auditResults.summary.criticalIssues.length > 0 ? "Immediate action is required to address critical findings." : "No critical issues identified."}
  `.trim();
}

function processFindings(checkpoints: ComplianceCheckpoint[]): ReportFinding[] {
  const findings: ReportFinding[] = [];
  let findingId = 1;

  checkpoints.forEach((checkpoint) => {
    checkpoint.checkResult.findings.forEach((finding) => {
      findings.push({
        id: `FINDING-${String(findingId).padStart(3, "0")}`,
        standard: checkpoint.standard,
        severity: checkpoint.severity,
        description: finding,
        evidence: checkpoint.checkResult.recommendations || [],
        affectedRecords: checkpoint.checkResult.affectedRecords || 0,
        riskLevel: getRiskLevel(checkpoint.severity),
        complianceGap: generateComplianceGap(checkpoint.standard, finding),
      });
      findingId++;
    });
  });

  return findings.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function generateRecommendations(
  auditResults: AuditExecutionResult,
): ReportRecommendation[] {
  const recommendations: ReportRecommendation[] = [];

  // Critical recommendations (immediate)
  const criticalIssues = auditResults.summary.criticalIssues;
  if (criticalIssues.length > 0) {
    recommendations.push({
      priority: "immediate",
      action: "Address all critical compliance gaps identified in this audit",
      rationale: `${criticalIssues.length} critical issues pose regulatory and patient safety risks`,
      expectedOutcome: "Achieve critical compliance in all flagged areas",
      estimatedDaysToComplete: 7,
    });
  }

  // High priority recommendations (short-term)
  const highIssues = auditResults.summary.highPriorityIssues;
  if (highIssues.length > 0) {
    recommendations.push({
      priority: "short-term",
      action: "Resolve high priority compliance findings",
      rationale: `${highIssues.length} high priority issues require timely remediation`,
      expectedOutcome: "Improve overall compliance score by 5-10%",
      estimatedDaysToComplete: 30,
    });
  }

  // General recommendations
  auditResults.summary.recommendations.forEach((rec) => {
    recommendations.push({
      priority: "medium-term",
      action: rec,
      rationale: "Improves long-term compliance and operational efficiency",
      expectedOutcome: "Sustained compliance with regulatory standards",
      estimatedDaysToComplete: 60,
    });
  });

  // Continuous improvement
  recommendations.push({
    priority: "long-term",
    action: "Implement continuous compliance monitoring system",
    rationale: "Proactive monitoring prevents future non-compliance",
    expectedOutcome:
      "Maintain 95%+ compliance score through ongoing monitoring",
    estimatedDaysToComplete: 90,
  });

  return recommendations;
}

function calculateComplianceByStandard(
  checkpoints: ComplianceCheckpoint[],
): StandardCompliance[] {
  const standards = new Set(checkpoints.map((c) => c.standard));
  const complianceByStandard: StandardCompliance[] = [];

  standards.forEach((standard) => {
    const standardCheckpoints = checkpoints.filter(
      (c) => c.standard === standard,
    );
    const passed = standardCheckpoints.filter(
      (c) => c.checkResult.passed,
    ).length;
    const score = Math.round((passed / standardCheckpoints.length) * 100);

    let status: "compliant" | "substantially-compliant" | "non-compliant" =
      "non-compliant";
    if (score >= 95) status = "compliant";
    else if (score >= 80) status = "substantially-compliant";

    const critical = standardCheckpoints.filter(
      (c) => c.severity === "critical" && !c.checkResult.passed,
    ).length;
    const high = standardCheckpoints.filter(
      (c) => c.severity === "high" && !c.checkResult.passed,
    ).length;

    complianceByStandard.push({
      standard,
      checkpointsTotal: standardCheckpoints.length,
      checkpointsPassed: passed,
      complianceScore: score,
      criticalIssues: critical,
      highIssues: high,
      status,
    });
  });

  return complianceByStandard.sort((a, b) =>
    a.complianceScore === b.complianceScore
      ? a.standard.localeCompare(b.standard)
      : b.complianceScore - a.complianceScore,
  );
}

function calculateCoveragePercentage(
  auditResults: AuditExecutionResult,
): number {
  // Calculate what percentage of the organization was audited
  // This is a simplified calculation
  const basePercentage =
    (auditResults.evidenceCollected.communicationsReviewed / 1000) * 100; // Assuming typical org has ~1000 communications
  return Math.min(basePercentage, 100);
}

function generateAttestationStatement(
  auditResults: AuditExecutionResult,
): string {
  const score = auditResults.overallComplianceScore;

  if (score >= 95) {
    return `The organization demonstrates full compliance with all evaluated regulatory standards. 
The control environment is effective and the risk of non-compliance is minimal.`;
  } else if (score >= 80) {
    return `The organization demonstrates substantial compliance with evaluated regulatory standards. 
Minor remediation is required in areas identified in this report.`;
  } else if (score >= 60) {
    return `The organization demonstrates partial compliance with evaluated regulatory standards. 
Significant remediation efforts are required to achieve full compliance.`;
  } else {
    return `The organization does not demonstrate adequate compliance with evaluated regulatory standards. 
Immediate and comprehensive remediation is required.`;
  }
}

function getRiskLevel(
  severity: "critical" | "high" | "medium" | "low",
): string {
  const riskMap = {
    critical: "EXTREME - Immediate regulatory action possible",
    high: "HIGH - Patient safety or legal risk",
    medium: "MEDIUM - Operational or quality risk",
    low: "LOW - Minor process improvement needed",
  };
  return riskMap[severity];
}

function generateComplianceGap(standard: string, finding: string): string {
  const gaps: { [key: string]: string } = {
    NICE: "Deviation from NICE clinical best practice guidelines",
    GPHC: "Non-compliance with GPHC pharmacy standards",
    GDPR: "Violation of GDPR data protection requirements",
    CLINICAL_SAFETY: "Breach of clinical safety standards",
  };
  return gaps[standard] || `Non-compliance with ${standard} standards`;
}

// ============================================================================
// PDF GENERATION (Returns HTML that can be converted to PDF)
// ============================================================================

export function generateReportHTML(report: AuditReport): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
      line-height: 1.6;
    }
    .header {
      border-bottom: 3px solid #003d7a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #003d7a;
    }
    .header .meta {
      color: #666;
      font-size: 14px;
      margin-top: 10px;
    }
    .score-box {
      background: #f0f7ff;
      border-left: 4px solid #003d7a;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .score-value {
      font-size: 36px;
      font-weight: bold;
      color: ${report.overallComplianceScore >= 80 ? "#28a745" : report.overallComplianceScore >= 60 ? "#ffc107" : "#dc3545"};
    }
    .section {
      margin: 40px 0;
      page-break-inside: avoid;
    }
    .section h2 {
      color: #003d7a;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .finding {
      border-left: 4px solid #dc3545;
      padding: 15px;
      margin: 15px 0;
      background: #fff5f5;
      page-break-inside: avoid;
    }
    .finding.high {
      border-left-color: #ffc107;
      background: #fffbf0;
    }
    .finding.medium {
      border-left-color: #17a2b8;
      background: #f0f8fb;
    }
    .finding.low {
      border-left-color: #28a745;
      background: #f0fdf4;
    }
    .finding-id {
      font-weight: bold;
      color: #666;
    }
    .finding-severity {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
    .finding-severity.critical {
      background: #dc3545;
      color: white;
    }
    .finding-severity.high {
      background: #ffc107;
      color: black;
    }
    .finding-severity.medium {
      background: #17a2b8;
      color: white;
    }
    .finding-severity.low {
      background: #28a745;
      color: white;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table th {
      background: #f8f9fa;
      color: #003d7a;
      padding: 12px;
      text-align: left;
      border-bottom: 2px solid #dee2e6;
    }
    table td {
      padding: 10px 12px;
      border-bottom: 1px solid #dee2e6;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-badge.compliant {
      background: #d4edda;
      color: #155724;
    }
    .status-badge.substantially-compliant {
      background: #fff3cd;
      color: #856404;
    }
    .status-badge.non-compliant {
      background: #f8d7da;
      color: #721c24;
    }
    .recommendation {
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 15px 0;
      background: #f0fdf4;
      page-break-inside: avoid;
    }
    .attestation {
      background: #e7f3ff;
      border: 1px solid #003d7a;
      padding: 20px;
      border-radius: 4px;
      margin: 30px 0;
      font-style: italic;
    }
    .footer {
      border-top: 1px solid #ccc;
      padding-top: 20px;
      margin-top: 40px;
      font-size: 12px;
      color: #666;
    }
    @media print {
      .no-print { display: none; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${report.title}</h1>
    <div class="meta">
      <p>Organization: <strong>${report.organizationName}</strong></p>
      <p>Audit ID: ${report.auditId}</p>
      <p>Report Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
      <p>Audit Period: ${new Date(report.auditPeriod.start).toLocaleDateString()} to ${new Date(report.auditPeriod.end).toLocaleDateString()}</p>
    </div>
  </div>

  <div class="section">
    <div class="score-box">
      <h3>Overall Compliance Score</h3>
      <div class="score-value">${report.overallComplianceScore}%</div>
      <p>Evaluated Standards: ${report.standards.join(", ")}</p>
    </div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.executiveSummary}</p>
  </div>

  <div class="section">
    <h2>Compliance by Standard</h2>
    <table>
      <thead>
        <tr>
          <th>Standard</th>
          <th>Checkpoints Passed</th>
          <th>Score</th>
          <th>Critical Issues</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${report.complianceByStandard
          .map(
            (sc) => `
          <tr>
            <td><strong>${sc.standard}</strong></td>
            <td>${sc.checkpointsPassed}/${sc.checkpointsTotal}</td>
            <td>${sc.complianceScore}%</td>
            <td>${sc.criticalIssues}</td>
            <td><span class="status-badge ${sc.status}">${sc.status.replace("-", " ").toUpperCase()}</span></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Audit Findings (${report.findings.length})</h2>
    ${report.findings
      .map(
        (finding) => `
      <div class="finding ${finding.severity}">
        <div>
          <span class="finding-id">${finding.id}</span>
          <span class="finding-severity ${finding.severity}">${finding.severity.toUpperCase()}</span>
        </div>
        <p><strong>${finding.standard}</strong></p>
        <p>${finding.description}</p>
        <p><em>Affected Records: ${finding.affectedRecords}</em></p>
        <p><strong>Risk Level:</strong> ${finding.riskLevel}</p>
      </div>
    `,
      )
      .join("")}
  </div>

  <div class="section">
    <h2>Recommendations (${report.recommendations.length})</h2>
    ${report.recommendations
      .map(
        (rec) => `
      <div class="recommendation">
        <h4>${rec.action}</h4>
        <p><strong>Priority:</strong> ${rec.priority.replace("-", " ").toUpperCase()}</p>
        <p><strong>Rationale:</strong> ${rec.rationale}</p>
        <p><strong>Expected Outcome:</strong> ${rec.expectedOutcome}</p>
        <p><strong>Estimated Days to Complete:</strong> ${rec.estimatedDaysToComplete}</p>
      </div>
    `,
      )
      .join("")}
  </div>

  <div class="section">
    <h2>Evidence Summary</h2>
    <table>
      <tr>
        <td><strong>Patients Audited:</strong></td>
        <td>${report.evidenceSummary.patientsAudited}</td>
      </tr>
      <tr>
        <td><strong>Communications Reviewed:</strong></td>
        <td>${report.evidenceSummary.communicationsReviewed}</td>
      </tr>
      <tr>
        <td><strong>Data Points Analyzed:</strong></td>
        <td>${report.evidenceSummary.dataPointsAnalyzed}</td>
      </tr>
      <tr>
        <td><strong>Coverage Percentage:</strong></td>
        <td>${report.evidenceSummary.coveragePercentage.toFixed(1)}%</td>
      </tr>
    </table>
  </div>

  <div class="attestation">
    <h3>Auditor Attestation</h3>
    <p>${report.attestation}</p>
  </div>

  <div class="footer">
    <p>Generated by: ${report.generatedBy}</p>
    <p>Report ID: ${report.reportId}</p>
    <p>This report is confidential and intended only for the organization audited and regulatory bodies.</p>
  </div>
</body>
</html>
  `.trim();
}

interface EvicenceSummary {
  patientsAudited: number;
  communicationsReviewed: number;
  dataPointsAnalyzed: number;
  auditSampleSize: number;
  coveragePercentage: number;
}

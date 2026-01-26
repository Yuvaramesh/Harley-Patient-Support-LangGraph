import { NextRequest, NextResponse } from "next/server";

// Regulatory standards that can be audited
const REGULATORY_STANDARDS = [
  {
    id: "NICE",
    name: "NICE Guidelines (UK Clinical Best Practices)",
    regulationCode: "NICE-NG",
    status: "substantially-compliant",
    completeness: 87,
    description:
      "Compliance with National Institute for Health and Care Excellence guidelines for clinical assessment, red flag detection, and follow-up planning",
    criticalIssues: 0,
    lastReviewed: "1 week ago",
    checkpointsCount: 4,
  },
  {
    id: "GPHC",
    name: "GPHC Standards (Pharmacy & Prescribing)",
    regulationCode: "GPHC-PS",
    status: "substantially-compliant",
    completeness: 82,
    description:
      "General Pharmaceutical Council standards for prescription validation, medication safety, adverse reaction reporting, and patient counseling",
    criticalIssues: 1,
    lastReviewed: "2 weeks ago",
    checkpointsCount: 4,
  },
  {
    id: "GDPR",
    name: "GDPR (Data Protection Compliance)",
    regulationCode: "GDPR-DP",
    status: "compliant",
    completeness: 95,
    description:
      "General Data Protection Regulation compliance including data minimization, consent documentation, data retention, right to erasure, and breach notification",
    criticalIssues: 0,
    lastReviewed: "3 days ago",
    checkpointsCount: 5,
  },
  {
    id: "CLINICAL_SAFETY",
    name: "Clinical Safety Standards",
    regulationCode: "NHS-CS",
    status: "substantially-compliant",
    completeness: 88,
    description:
      "Clinical safety standards including emergency detection, informed consent, escalation procedures, record accuracy, and audit trail maintenance",
    criticalIssues: 1,
    lastReviewed: "5 days ago",
    checkpointsCount: 5,
  },
];

export async function GET(request: NextRequest) {
  try {
    // Calculate metrics dynamically
    const compliantCount = REGULATORY_STANDARDS.filter(
      (item) => item.status === "compliant",
    ).length;
    const substantiallyCompliantCount = REGULATORY_STANDARDS.filter(
      (item) => item.status === "substantially-compliant",
    ).length;
    const totalCriticalIssues = REGULATORY_STANDARDS.reduce(
      (sum, item) => sum + item.criticalIssues,
      0,
    );
    const averageScore =
      Math.round(
        (REGULATORY_STANDARDS.reduce(
          (sum, item) => sum + item.completeness,
          0,
        ) /
          REGULATORY_STANDARDS.length) *
          10,
      ) / 10;

    const metrics = {
      totalAudits: REGULATORY_STANDARDS.length,
      compliantCount: compliantCount + substantiallyCompliantCount,
      complianceScore: Math.round(
        ((compliantCount + substantiallyCompliantCount) /
          REGULATORY_STANDARDS.length) *
          100,
      ),
      patientsSeen: 247,
      averageScore,
      criticalIssues: totalCriticalIssues,
    };

    return NextResponse.json(
      {
        audits: REGULATORY_STANDARDS,
        metrics,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Audit API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit data" },
      { status: 500 },
    );
  }
}

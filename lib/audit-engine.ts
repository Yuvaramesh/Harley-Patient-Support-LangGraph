/**
 * Dynamic Audit Engine
 * Analyzes actual patient communications against regulatory guidelines
 * Returns compliance scores and detailed findings
 */

import {
  ALL_CHECKPOINTS,
  ALL_REGULATORY_GUIDELINES,
  NICE_GUIDELINES,
  GPHC_GUIDELINES,
  GDPR_GUIDELINES,
  CLINICAL_SAFETY_GUIDELINES,
  ComplianceCheckpoint,
  CheckResult,
} from "./regulator-guideliness";
import { ChatHistory, Patient } from "./types";
import { getCollection } from "./mongodb";

export interface AuditExecutionResult {
  auditId: string;
  timestamp: Date;
  auditedStandards: string[];
  totalCheckpoints: number;
  passedCheckpoints: number;
  failedCheckpoints: number;
  overallComplianceScore: number;
  checkpoints: ComplianceCheckpoint[];
  summary: {
    criticalIssues: string[];
    highPriorityIssues: string[];
    recommendations: string[];
  };
  evidenceCollected: {
    patientsAudited: number;
    communicationsReviewed: number;
    dataPointsAnalyzed: number;
  };
}

export interface AuditHistory {
  _id?: string;
  auditId: string;
  timestamp: Date;
  auditedStandards: string[];
  overallComplianceScore: number;
  criticalIssuesCount: number;
  checkpoints: ComplianceCheckpoint[];
  evidenceCollected: {
    patientsAudited: number;
    communicationsReviewed: number;
    dataPointsAnalyzed: number;
  };
}

// ============================================================================
// MAIN AUDIT ENGINE
// ============================================================================

export async function runDynamicAudit(
  standards: string[] = ["NICE", "GPHC", "GDPR", "CLINICAL_SAFETY"],
): Promise<AuditExecutionResult> {
  console.log(
    `[Audit] Starting dynamic audit for standards: ${standards.join(", ")}`,
  );

  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // Collect all patient data
  const { patients, communications, dataPoints } = await collectAuditEvidence();

  // Run compliance checks
  const checkpoints = await runComplianceChecks(
    patients,
    communications,
    standards,
  );

  // Calculate scores
  const results = calculateAuditResults(checkpoints, auditId);

  // Store in database
  await storeAuditHistory(results);

  console.log(
    `[Audit] Completed in ${Date.now() - startTime}ms. Score: ${results.overallComplianceScore}%`,
  );

  return {
    ...results,
    evidenceCollected: {
      patientsAudited: patients.length,
      communicationsReviewed: communications.length,
      dataPointsAnalyzed: dataPoints,
    },
  };
}

// ============================================================================
// EVIDENCE COLLECTION
// ============================================================================

async function collectAuditEvidence(): Promise<{
  patients: Patient[];
  communications: ChatHistory[];
  dataPoints: number;
}> {
  const patientsCollection = await getCollection<Patient>("patients");
  const chatHistoryCollection =
    await getCollection<ChatHistory>("chat_history");

  // Get all patients
  const patients = await patientsCollection.find({}).toArray();

  // Get all communications
  const communications = await chatHistoryCollection
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  // Count data points
  let dataPoints = 0;
  patients.forEach((patient) => {
    dataPoints += Object.keys(patient).length;
  });
  communications.forEach((comm) => {
    if (comm.messages) {
      dataPoints += comm.messages.length;
    }
  });

  console.log(
    `[Audit] Collected evidence: ${patients.length} patients, ${communications.length} communications`,
  );

  return { patients, communications, dataPoints };
}

// ============================================================================
// COMPLIANCE CHECKS EXECUTION
// ============================================================================

async function runComplianceChecks(
  patients: Patient[],
  communications: ChatHistory[],
  standards: string[],
): Promise<ComplianceCheckpoint[]> {
  const checkpoints: ComplianceCheckpoint[] = [];

  // NICE GUIDELINES
  if (standards.includes("NICE")) {
    checkpoints.push(
      ...runNiceChecks(communications),
      ...runRedFlagChecks(communications),
    );
  }

  // GPHC GUIDELINES
  if (standards.includes("GPHC")) {
    checkpoints.push(...runGPHCChecks(communications));
  }

  // GDPR GUIDELINES
  if (standards.includes("GDPR")) {
    checkpoints.push(...runGDPRChecks(patients));
  }

  // CLINICAL SAFETY
  if (standards.includes("CLINICAL_SAFETY")) {
    checkpoints.push(...runClinicalSafetyChecks(communications, patients));
  }

  console.log(`[Audit] Executed ${checkpoints.length} compliance checkpoints`);
  return checkpoints;
}

// ============================================================================
// NICE GUIDELINES CHECKS
// ============================================================================

function runNiceChecks(communications: ChatHistory[]): ComplianceCheckpoint[] {
  const checkpoints: ComplianceCheckpoint[] = [];

  // CHECKPOINT 1: Clinical Assessment
  const clinicalResults = communications.map((comm) => {
    const result = NICE_GUIDELINES.clinical_assessment.checkFunction(
      comm.summary || "",
    );
    return {
      passed: result.passed,
      score: result.score,
      findings: result.findings,
      recommendations: result.recommendations,
      affectedRecords: result.passed ? 0 : 1,
    };
  });

  const avgClinicalScore =
    clinicalResults.reduce((sum, r) => sum + r.score, 0) /
    clinicalResults.length;

  checkpoints.push({
    id: NICE_GUIDELINES.clinical_assessment.id,
    standard: "NICE",
    guideline: NICE_GUIDELINES.clinical_assessment.guideline,
    description: NICE_GUIDELINES.clinical_assessment.description,
    severity: "critical",
    checkResult: {
      passed: avgClinicalScore >= 80,
      score: Math.round(avgClinicalScore),
      findings: clinicalResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        clinicalResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: clinicalResults.filter((r) => !r.passed).length,
    },
  });

  // CHECKPOINT 2: Follow-up Plans
  const followUpResults = communications.map((comm) => {
    const result = NICE_GUIDELINES.follow_up_plan.checkFunction(
      comm.summary || "",
    );
    return result;
  });

  const avgFollowUpScore =
    followUpResults.reduce((sum, r) => sum + r.score, 0) /
    followUpResults.length;

  checkpoints.push({
    id: NICE_GUIDELINES.follow_up_plan.id,
    standard: "NICE",
    guideline: NICE_GUIDELINES.follow_up_plan.guideline,
    description: NICE_GUIDELINES.follow_up_plan.description,
    severity: "high",
    checkResult: {
      passed: avgFollowUpScore >= 80,
      score: Math.round(avgFollowUpScore),
      findings: followUpResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        followUpResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: followUpResults.filter((r) => !r.passed).length,
    },
  });

  return checkpoints;
}

function runRedFlagChecks(
  communications: ChatHistory[],
): ComplianceCheckpoint[] {
  const checkpoints: ComplianceCheckpoint[] = [];

  const redFlagResults = communications.map((comm) => {
    const result = NICE_GUIDELINES.red_flag_assessment.checkFunction(
      comm.summary || "",
      comm.severity || "low",
    );
    return result;
  });

  const passedRedFlags = redFlagResults.filter((r) => r.passed).length;
  const passRate = (passedRedFlags / redFlagResults.length) * 100;

  checkpoints.push({
    id: NICE_GUIDELINES.red_flag_assessment.id,
    standard: "NICE",
    guideline: NICE_GUIDELINES.red_flag_assessment.guideline,
    description: NICE_GUIDELINES.red_flag_assessment.description,
    severity: "critical",
    checkResult: {
      passed: passRate >= 95,
      score: Math.round(passRate),
      findings: redFlagResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        redFlagResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: redFlagResults.filter((r) => !r.passed).length,
    },
  });

  return checkpoints;
}

// ============================================================================
// GPHC GUIDELINES CHECKS
// ============================================================================

function runGPHCChecks(communications: ChatHistory[]): ComplianceCheckpoint[] {
  const checkpoints: ComplianceCheckpoint[] = [];

  // CHECKPOINT: Prescription Validation
  const prescriptionResults = communications.map((comm) => {
    const result = GPHC_GUIDELINES.prescription_validation.checkFunction(
      comm.summary || "",
    );
    return result;
  });

  const prescriptionScore =
    (prescriptionResults.filter((r) => r.passed).length /
      prescriptionResults.length) *
    100;

  checkpoints.push({
    id: GPHC_GUIDELINES.prescription_validation.id,
    standard: "GPHC",
    guideline: GPHC_GUIDELINES.prescription_validation.guideline,
    description: GPHC_GUIDELINES.prescription_validation.description,
    severity: "critical",
    checkResult: {
      passed: prescriptionScore >= 90,
      score: Math.round(prescriptionScore),
      findings: prescriptionResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        prescriptionResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: prescriptionResults.filter((r) => !r.passed).length,
    },
  });

  // CHECKPOINT: Patient Counseling
  const counselingResults = communications.map((comm) => {
    const result = GPHC_GUIDELINES.patient_counseling.checkFunction(
      comm.summary || "",
    );
    return result;
  });

  const counselingScore =
    (counselingResults.filter((r) => r.passed).length /
      counselingResults.length) *
    100;

  checkpoints.push({
    id: GPHC_GUIDELINES.patient_counseling.id,
    standard: "GPHC",
    guideline: GPHC_GUIDELINES.patient_counseling.guideline,
    description: GPHC_GUIDELINES.patient_counseling.description,
    severity: "medium",
    checkResult: {
      passed: counselingScore >= 85,
      score: Math.round(counselingScore),
      findings: counselingResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        counselingResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: counselingResults.filter((r) => !r.passed).length,
    },
  });

  return checkpoints;
}

// ============================================================================
// GDPR GUIDELINES CHECKS
// ============================================================================

function runGDPRChecks(patients: Patient[]): ComplianceCheckpoint[] {
  const checkpoints: ComplianceCheckpoint[] = [];

  // CHECKPOINT: Data Minimization
  const minimizationResults = patients.map((patient) => {
    const result = GDPR_GUIDELINES.data_minimization.checkFunction(
      patient as any,
    );
    return result;
  });

  const minimizationScore =
    (minimizationResults.filter((r) => r.passed).length /
      minimizationResults.length) *
    100;

  checkpoints.push({
    id: GDPR_GUIDELINES.data_minimization.id,
    standard: "GDPR",
    guideline: GDPR_GUIDELINES.data_minimization.guideline,
    description: GDPR_GUIDELINES.data_minimization.description,
    severity: "high",
    checkResult: {
      passed: minimizationScore === 100,
      score: Math.round(minimizationScore),
      findings: minimizationResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        minimizationResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: minimizationResults.filter((r) => !r.passed).length,
    },
  });

  // CHECKPOINT: Consent Documentation
  const consentResults = patients.map((patient) => {
    const result = GDPR_GUIDELINES.consent_documentation.checkFunction(
      patient as any,
    );
    return result;
  });

  const consentScore =
    (consentResults.filter((r) => r.passed).length / consentResults.length) *
    100;

  checkpoints.push({
    id: GDPR_GUIDELINES.consent_documentation.id,
    standard: "GDPR",
    guideline: GDPR_GUIDELINES.consent_documentation.guideline,
    description: GDPR_GUIDELINES.consent_documentation.description,
    severity: "critical",
    checkResult: {
      passed: consentScore === 100,
      score: Math.round(consentScore),
      findings: consentResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        consentResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: consentResults.filter((r) => !r.passed).length,
    },
  });

  return checkpoints;
}

// ============================================================================
// CLINICAL SAFETY CHECKS
// ============================================================================

function runClinicalSafetyChecks(
  communications: ChatHistory[],
  patients: Patient[],
): ComplianceCheckpoint[] {
  const checkpoints: ComplianceCheckpoint[] = [];

  // CHECKPOINT: Emergency Detection
  const emergencyResults = communications.map((comm) => {
    const result = CLINICAL_SAFETY_GUIDELINES.emergency_detection.checkFunction(
      comm.summary || "",
      comm.severity || "low",
    );
    return result;
  });

  const emergencyScore =
    (emergencyResults.filter((r) => r.passed).length /
      emergencyResults.length) *
    100;

  checkpoints.push({
    id: CLINICAL_SAFETY_GUIDELINES.emergency_detection.id,
    standard: "CLINICAL_SAFETY",
    guideline: CLINICAL_SAFETY_GUIDELINES.emergency_detection.guideline,
    description: CLINICAL_SAFETY_GUIDELINES.emergency_detection.description,
    severity: "critical",
    checkResult: {
      passed: emergencyScore >= 95,
      score: Math.round(emergencyScore),
      findings: emergencyResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        emergencyResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: emergencyResults.filter((r) => !r.passed).length,
    },
  });

  // CHECKPOINT: Informed Consent
  const consentResults = communications.map((comm) => {
    const result = CLINICAL_SAFETY_GUIDELINES.informed_consent.checkFunction(
      comm.summary || "",
    );
    return result;
  });

  const consentScore =
    (consentResults.filter((r) => r.passed).length / consentResults.length) *
    100;

  checkpoints.push({
    id: CLINICAL_SAFETY_GUIDELINES.informed_consent.id,
    standard: "CLINICAL_SAFETY",
    guideline: CLINICAL_SAFETY_GUIDELINES.informed_consent.guideline,
    description: CLINICAL_SAFETY_GUIDELINES.informed_consent.description,
    severity: "high",
    checkResult: {
      passed: consentScore >= 85,
      score: Math.round(consentScore),
      findings: consentResults
        .filter((r) => !r.passed)
        .flatMap((r) => r.findings),
      recommendations: deduplicateArray(
        consentResults.flatMap((r) => r.recommendations),
      ),
      affectedRecords: consentResults.filter((r) => !r.passed).length,
    },
  });

  return checkpoints;
}

// ============================================================================
// RESULT CALCULATION
// ============================================================================

function calculateAuditResults(
  checkpoints: ComplianceCheckpoint[],
  auditId: string,
): AuditExecutionResult {
  const passedCheckpoints = checkpoints.filter(
    (c) => c.checkResult.passed,
  ).length;
  const failedCheckpoints = checkpoints.length - passedCheckpoints;

  const overallScore = Math.round(
    checkpoints.reduce((sum, c) => sum + c.checkResult.score, 0) /
      checkpoints.length,
  );

  const criticalIssues = checkpoints
    .filter((c) => c.severity === "critical" && !c.checkResult.passed)
    .flatMap((c) => c.checkResult.findings);

  const highPriorityIssues = checkpoints
    .filter((c) => c.severity === "high" && !c.checkResult.passed)
    .flatMap((c) => c.checkResult.findings);

  const allRecommendations = deduplicateArray(
    checkpoints.flatMap((c) => c.checkResult.recommendations),
  );

  return {
    auditId,
    timestamp: new Date(),
    auditedStandards: [...new Set(checkpoints.map((c) => c.standard))],
    totalCheckpoints: checkpoints.length,
    passedCheckpoints,
    failedCheckpoints,
    overallComplianceScore: overallScore,
    checkpoints,
    summary: {
      criticalIssues: deduplicateArray(criticalIssues),
      highPriorityIssues: deduplicateArray(highPriorityIssues),
      recommendations: allRecommendations,
    },
    evidenceCollected: {
      patientsAudited: 0,
      communicationsReviewed: 0,
      dataPointsAnalyzed: 0,
    },
  };
}

// ============================================================================
// STORAGE & HISTORY
// ============================================================================

async function storeAuditHistory(results: AuditExecutionResult): Promise<void> {
  try {
    const auditHistoryCollection =
      await getCollection<AuditHistory>("audit_history");

    await auditHistoryCollection.insertOne({
      auditId: results.auditId,
      timestamp: results.timestamp,
      auditedStandards: results.auditedStandards,
      overallComplianceScore: results.overallComplianceScore,
      criticalIssuesCount: results.summary.criticalIssues.length,
      checkpoints: results.checkpoints,
      evidenceCollected: results.evidenceCollected,
    } as any);

    console.log(`[Audit] Stored audit history: ${results.auditId}`);
  } catch (error) {
    console.error("[Audit] Failed to store audit history:", error);
  }
}

export async function getAuditHistory(
  limit: number = 10,
): Promise<AuditHistory[]> {
  try {
    const auditHistoryCollection =
      await getCollection<AuditHistory>("audit_history");
    return await auditHistoryCollection
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error("[Audit] Failed to retrieve audit history:", error);
    return [];
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function deduplicateArray(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

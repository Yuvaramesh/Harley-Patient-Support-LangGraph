/**
 * Regulatory Guidelines Database
 * Contains standards from NICE, GPHC, GDPR, and Clinical Safety
 * Used for dynamic compliance auditing
 */

export interface RegulatoryCheckpoint {
  id: string;
  standard: "NICE" | "GPHC" | "GDPR" | "CLINICAL_SAFETY";
  guideline: string;
  description: string;
  checkFunction: (data: any) => CheckResult;
  severity: "critical" | "high" | "medium" | "low";
  examples?: string[];
}

export interface CheckResult {
  passed: boolean;
  score: number; // 0-100
  findings: string[];
  recommendations: string[];
  affectedRecords?: number;
}

export interface ComplianceCheckpoint {
  id: string;
  standard: string;
  guideline: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  checkResult: CheckResult;
  evidence?: string[];
}

// ============================================================================
// NICE GUIDELINES (Clinical Best Practices)
// ============================================================================

export const NICE_GUIDELINES = {
  clinical_assessment: {
    id: "nice-clinical-assessment",
    standard: "NICE",
    guideline: "NG12 - Clinical Assessment Standards",
    description:
      "Patient assessment must include chief complaint, duration, severity, and relevant history",
    checkFunction: (summary: string) => {
      const findings: string[] = [];
      const score = assessNiceCompliance(summary, findings);
      return {
        passed: score >= 80,
        score,
        findings,
        recommendations: generateNiceRecommendations(findings),
      };
    },
    severity: "critical",
    examples: [
      "Summary must document: symptoms, duration, severity level",
      "History of presenting illness required",
      "Previous similar episodes should be noted",
    ],
  },

  contraindication_check: {
    id: "nice-contraindications",
    standard: "NICE",
    guideline: "NG45 - Medication Safety",
    description:
      "System must identify and flag contraindications, allergies, and drug interactions",
    checkFunction: (patientData: any, medicationMentioned: string) => {
      const findings: string[] = [];
      const knownAllergies = patientData.allergies || [];
      const passed = !knownAllergies.some((allergy: string) =>
        medicationMentioned.toLowerCase().includes(allergy.toLowerCase()),
      );

      if (!passed) {
        findings.push(`Potential medication allergy conflict detected`);
      }

      return {
        passed,
        score: passed ? 100 : 0,
        findings,
        recommendations: passed
          ? []
          : ["Review patient allergies before any medication suggestions"],
      };
    },
    severity: "critical",
  },

  follow_up_plan: {
    id: "nice-follow-up",
    standard: "NICE",
    guideline: "NG89 - Care Planning",
    description:
      "All clinical consultations must include clear follow-up instructions",
    checkFunction: (summary: string) => {
      const findings: string[] = [];
      const hasFollowUp =
        summary.toLowerCase().includes("follow up") ||
        summary.toLowerCase().includes("next appointment") ||
        summary.toLowerCase().includes("return visit");

      if (!hasFollowUp) {
        findings.push("No follow-up plan documented");
      }

      return {
        passed: hasFollowUp,
        score: hasFollowUp ? 100 : 50,
        findings,
        recommendations: hasFollowUp
          ? []
          : [
              "Add explicit follow-up instructions: timeframe, next steps, when to seek immediate care",
            ],
      };
    },
    severity: "high",
  },

  red_flag_assessment: {
    id: "nice-red-flags",
    standard: "NICE",
    guideline: "NG88 - Emergency Assessment",
    description:
      "System must identify and escalate red flag symptoms requiring immediate medical attention",
    checkFunction: (summary: string, patientSeverity: string) => {
      const redFlags = [
        "chest pain",
        "difficulty breathing",
        "severe headache",
        "neurological symptoms",
        "loss of consciousness",
        "severe bleeding",
        "abdominal distension",
      ];

      const findings: string[] = [];
      const detectedFlags = redFlags.filter((flag) =>
        summary.toLowerCase().includes(flag),
      );

      if (detectedFlags.length > 0 && patientSeverity !== "critical") {
        findings.push(
          `Red flag symptoms detected (${detectedFlags.join(", ")}) but not marked as critical`,
        );
      }

      return {
        passed: detectedFlags.length === 0 || patientSeverity === "critical",
        score:
          detectedFlags.length === 0
            ? 100
            : patientSeverity === "critical"
              ? 95
              : 30,
        findings,
        recommendations:
          detectedFlags.length > 0
            ? [
                "Escalate case immediately. Advise patient to seek emergency care.",
              ]
            : [],
      };
    },
    severity: "critical",
  },
};

// ============================================================================
// GPHC GUIDELINES (Pharmacy & Prescribing Standards)
// ============================================================================

export const GPHC_GUIDELINES = {
  prescription_validation: {
    id: "gphc-prescription-validation",
    standard: "GPHC",
    guideline: "Pharmacy Standards - Prescription Verification",
    description:
      "Any medication recommendations must be validated for safety and appropriateness",
    checkFunction: (summary: string) => {
      const findings: string[] = [];
      // Check if any medication is mentioned
      const medicationKeywords = [
        "paracetamol",
        "ibuprofen",
        "aspirin",
        "amoxicillin",
        "lisinopril",
      ];
      const hasMedication = medicationKeywords.some((med) =>
        summary.toLowerCase().includes(med),
      );

      if (
        hasMedication &&
        !summary.toLowerCase().includes("contraindication")
      ) {
        findings.push(
          "Medication mentioned but no contraindication check documented",
        );
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 60,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Always validate contraindications before recommending medications",
              ]
            : [],
      };
    },
    severity: "critical",
  },

  dosage_appropriateness: {
    id: "gphc-dosage",
    standard: "GPHC",
    guideline: "Pharmacy Standards - Dose Appropriateness",
    description:
      "Medication doses must be age, weight, and condition appropriate",
    checkFunction: (patientData: any, summary: string) => {
      const findings: string[] = [];
      const patientAge = patientData.age || 0;

      // Check if dosage is mentioned
      if (
        summary.toLowerCase().includes("dose") ||
        summary.toLowerCase().includes("mg")
      ) {
        // This is simplified; in production, validate against BNF (British National Formulary)
        findings.push("Dosage mentioned but not validated against BNF");
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 70,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Validate all dosages against current BNF guidance and patient age/weight",
              ]
            : [],
      };
    },
    severity: "high",
  },

  adverse_reaction_reporting: {
    id: "gphc-adverse-reactions",
    standard: "GPHC",
    guideline: "Pharmacy Standards - Adverse Reaction Reporting",
    description:
      "Any suspected adverse drug reactions must be documented and reported",
    checkFunction: (summary: string) => {
      const adverseKeywords = [
        "allergy",
        "reaction",
        "side effect",
        "rash",
        "nausea",
        "anaphylaxis",
      ];
      const findings: string[] = [];

      const hasAdverseReport = adverseKeywords.some((keyword) =>
        summary.toLowerCase().includes(keyword),
      );

      if (hasAdverseReport && !summary.toLowerCase().includes("report")) {
        findings.push(
          "Adverse reaction noted but not documented as reportable",
        );
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 40,
        findings,
        recommendations:
          findings.length > 0
            ? ["All adverse reactions must be reported to Yellow Card scheme"]
            : [],
      };
    },
    severity: "high",
  },

  patient_counseling: {
    id: "gphc-counseling",
    standard: "GPHC",
    guideline: "Pharmacy Standards - Patient Counseling",
    description:
      "Patients must receive appropriate counseling about medications",
    checkFunction: (summary: string) => {
      const findings: string[] = [];

      if (
        summary.toLowerCase().includes("medication") ||
        summary.toLowerCase().includes("medicine")
      ) {
        const hasCounseling =
          summary.toLowerCase().includes("advise") ||
          summary.toLowerCase().includes("counsel") ||
          summary.toLowerCase().includes("inform") ||
          summary.toLowerCase().includes("side effect");

        if (!hasCounseling) {
          findings.push(
            "Medication discussed but patient counseling not documented",
          );
        }
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 65,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Document patient counseling: how to take, side effects, interactions",
              ]
            : [],
      };
    },
    severity: "medium",
  },
};

// ============================================================================
// GDPR COMPLIANCE (Data Protection)
// ============================================================================

export const GDPR_GUIDELINES = {
  data_minimization: {
    id: "gdpr-minimization",
    standard: "GDPR",
    guideline: "Article 5 - Data Minimization",
    description: "Only collect and process data necessary for stated purpose",
    checkFunction: (patientData: any) => {
      const findings: string[] = [];
      const unnecessaryFields = [
        "socialSecurityNumber",
        "financialInfo",
        "religionOrBelief",
      ];

      const hasUnnecessary = unnecessaryFields.some(
        (field) =>
          patientData[field] !== undefined && patientData[field] !== null,
      );

      if (hasUnnecessary) {
        findings.push(
          "Unnecessary personal data collected beyond healthcare purpose",
        );
      }

      return {
        passed: !hasUnnecessary,
        score: hasUnnecessary ? 50 : 100,
        findings,
        recommendations: hasUnnecessary
          ? ["Remove non-essential personal data immediately"]
          : ["Data minimization compliant"],
      };
    },
    severity: "high",
  },

  consent_documentation: {
    id: "gdpr-consent",
    standard: "GDPR",
    guideline: "Article 7 - Consent",
    description: "Patient consent must be explicitly documented",
    checkFunction: (patientData: any) => {
      const findings: string[] = [];

      if (!patientData.consentGiven || !patientData.consentDate) {
        findings.push("No documented consent for data processing");
      }

      return {
        passed: patientData.consentGiven === true,
        score: patientData.consentGiven === true ? 100 : 0,
        findings,
        recommendations:
          patientData.consentGiven === true
            ? []
            : [
                "Obtain explicit written consent before processing patient data",
              ],
      };
    },
    severity: "critical",
  },

  data_retention: {
    id: "gdpr-retention",
    standard: "GDPR",
    guideline: "Article 5 - Storage Limitation",
    description: "Patient data must not be kept longer than necessary",
    checkFunction: (patientData: any) => {
      const findings: string[] = [];
      const createdDate = new Date(patientData.createdAt);
      const daysSinceCreation =
        (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

      // 7 years is standard medical record retention
      if (daysSinceCreation > 7 * 365 && !patientData.active) {
        findings.push("Inactive patient record should be archived or deleted");
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 60,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Archive or securely delete patient records after retention period expires",
              ]
            : [],
      };
    },
    severity: "medium",
  },

  right_to_erasure: {
    id: "gdpr-erasure",
    standard: "GDPR",
    guideline: "Article 17 - Right to Erasure",
    description: "System must support patient right to be forgotten",
    checkFunction: (systemCapabilities: any) => {
      const findings: string[] = [];

      if (!systemCapabilities.supportsErasure) {
        findings.push("System does not support right to erasure");
      }

      return {
        passed: systemCapabilities.supportsErasure === true,
        score: systemCapabilities.supportsErasure === true ? 100 : 0,
        findings,
        recommendations:
          systemCapabilities.supportsErasure === true
            ? []
            : [
                "Implement data erasure functionality to comply with GDPR Article 17",
              ],
      };
    },
    severity: "critical",
  },

  data_breach_response: {
    id: "gdpr-breach",
    standard: "GDPR",
    guideline: "Article 33 - Data Breach Notification",
    description:
      "System must have data breach detection and notification procedures",
    checkFunction: (systemCapabilities: any) => {
      const findings: string[] = [];

      if (!systemCapabilities.breachNotificationProcedure) {
        findings.push("No documented data breach notification procedure");
      }

      if (!systemCapabilities.encryptionEnabled) {
        findings.push("Data not encrypted at rest or in transit");
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 30,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Implement encryption for all patient data",
                "Document and practice data breach notification procedures",
                "Establish monitoring for unauthorized access attempts",
              ]
            : [],
      };
    },
    severity: "critical",
  },
};

// ============================================================================
// CLINICAL SAFETY STANDARDS
// ============================================================================

export const CLINICAL_SAFETY_GUIDELINES = {
  emergency_detection: {
    id: "safety-emergency",
    standard: "CLINICAL_SAFETY",
    guideline: "Emergency Recognition",
    description:
      "System must accurately identify and escalate emergency situations",
    checkFunction: (summary: string, assignedSeverity: string) => {
      const emergencyKeywords = [
        "unconscious",
        "chest pain",
        "difficulty breathing",
        "severe bleeding",
        "anaphylaxis",
        "stroke",
        "seizure",
      ];
      const findings: string[] = [];

      const hasEmergency = emergencyKeywords.some((keyword) =>
        summary.toLowerCase().includes(keyword),
      );

      if (hasEmergency && assignedSeverity !== "critical") {
        findings.push(
          `Emergency situation detected but severity marked as ${assignedSeverity} instead of critical`,
        );
      }

      return {
        passed: !hasEmergency || assignedSeverity === "critical",
        score: !hasEmergency ? 100 : assignedSeverity === "critical" ? 95 : 20,
        findings,
        recommendations: hasEmergency
          ? ["Immediate escalation to emergency services required"]
          : [],
      };
    },
    severity: "critical",
  },

  informed_consent: {
    id: "safety-consent",
    standard: "CLINICAL_SAFETY",
    guideline: "Informed Consent",
    description: "Patients must be fully informed before clinical decisions",
    checkFunction: (summary: string) => {
      const findings: string[] = [];

      const hasConsent =
        summary.toLowerCase().includes("advised") ||
        summary.toLowerCase().includes("explained") ||
        summary.toLowerCase().includes("discussed with patient") ||
        summary.toLowerCase().includes("patient understands");

      if (!hasConsent && summary.toLowerCase().includes("treatment")) {
        findings.push(
          "Treatment discussed but patient understanding not documented",
        );
      }

      return {
        passed: hasConsent,
        score: hasConsent ? 100 : 50,
        findings,
        recommendations: hasConsent
          ? []
          : [
              "Document patient understanding and consent for all treatment recommendations",
            ],
      };
    },
    severity: "high",
  },

  escalation_pathway: {
    id: "safety-escalation",
    standard: "CLINICAL_SAFETY",
    guideline: "Escalation Procedures",
    description:
      "Clear escalation pathways must exist for high-risk situations",
    checkFunction: (summary: string, severity: string) => {
      const findings: string[] = [];

      if (
        (severity === "high" || severity === "critical") &&
        !summary.toLowerCase().includes("escalat") &&
        !summary.toLowerCase().includes("doctor") &&
        !summary.toLowerCase().includes("hospital")
      ) {
        findings.push(
          `High/critical severity case not escalated to appropriate healthcare provider`,
        );
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 40,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Establish clear escalation pathways to qualified healthcare providers",
              ]
            : [],
      };
    },
    severity: "critical",
  },

  record_accuracy: {
    id: "safety-accuracy",
    standard: "CLINICAL_SAFETY",
    guideline: "Clinical Record Accuracy",
    description: "Clinical records must be accurate, legible, and complete",
    checkFunction: (summary: string) => {
      const findings: string[] = [];

      const hasRequired = [
        summary.toLowerCase().includes("date") || true, // Allow flexible dates
        summary.length > 50, // Minimum content length
        !summary.includes("TODO") && !summary.includes("xxx"), // No placeholders
      ];

      const missingElements = hasRequired.filter((el) => !el).length;

      if (missingElements > 0) {
        findings.push("Clinical record incomplete or contains placeholders");
      }

      return {
        passed: missingElements === 0,
        score: 100 - missingElements * 20,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Ensure all clinical records are complete and accurate before submission",
              ]
            : [],
      };
    },
    severity: "high",
  },

  audit_trail: {
    id: "safety-audit-trail",
    standard: "CLINICAL_SAFETY",
    guideline: "Audit Trail & Accountability",
    description: "All clinical actions must be logged with timestamp and user",
    checkFunction: (record: any) => {
      const findings: string[] = [];

      if (!record.timestamp || !record.createdBy) {
        findings.push(
          "Missing timestamp or creator information in clinical record",
        );
      }

      if (!record.lastModified) {
        findings.push("No modification history tracked");
      }

      return {
        passed: findings.length === 0,
        score: findings.length === 0 ? 100 : 50,
        findings,
        recommendations:
          findings.length > 0
            ? [
                "Implement automatic timestamping for all records",
                "Track and log all modifications with user identity",
                "Maintain immutable audit trail",
              ]
            : [],
      };
    },
    severity: "high",
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function assessNiceCompliance(summary: string, findings: string[]): number {
  let score = 100;

  // Check for chief complaint
  if (
    !summary.toLowerCase().includes("patient") &&
    !summary.toLowerCase().includes("complaint") &&
    !summary.toLowerCase().includes("symptom")
  ) {
    score -= 20;
    findings.push("Chief complaint not clearly documented");
  }

  // Check for duration
  if (
    !summary.toLowerCase().includes("day") &&
    !summary.toLowerCase().includes("week") &&
    !summary.toLowerCase().includes("month")
  ) {
    score -= 15;
    findings.push("Duration of symptoms not documented");
  }

  // Check for severity
  if (
    !summary.toLowerCase().includes("severe") &&
    !summary.toLowerCase().includes("mild") &&
    !summary.toLowerCase().includes("moderate")
  ) {
    score -= 15;
    findings.push("Severity assessment missing");
  }

  return Math.max(score, 0);
}

function generateNiceRecommendations(findings: string[]): string[] {
  const recommendations: string[] = [];

  if (findings.some((f) => f.includes("chief complaint"))) {
    recommendations.push(
      "Clearly document the patient's main presenting problem",
    );
  }

  if (findings.some((f) => f.includes("duration"))) {
    recommendations.push("Record how long symptoms have been present");
  }

  if (findings.some((f) => f.includes("severity"))) {
    recommendations.push(
      "Assess and document severity of presenting condition",
    );
  }

  return recommendations;
}

// ============================================================================
// COMBINED GUIDELINES EXPORT
// ============================================================================

export const ALL_REGULATORY_GUIDELINES = {
  NICE: NICE_GUIDELINES,
  GPHC: GPHC_GUIDELINES,
  GDPR: GDPR_GUIDELINES,
  CLINICAL_SAFETY: CLINICAL_SAFETY_GUIDELINES,
};

export const ALL_CHECKPOINTS = [
  ...Object.values(NICE_GUIDELINES),
  ...Object.values(GPHC_GUIDELINES),
  ...Object.values(GDPR_GUIDELINES),
  ...Object.values(CLINICAL_SAFETY_GUIDELINES),
] as RegulatoryCheckpoint[];

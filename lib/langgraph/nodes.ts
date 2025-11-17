// lib/langgraph/nodes.ts
import type { HealthcareGraphStateType } from "../langgraph/state";
import {
  supervisorAgent,
  extractSeverity,
  clinicalAgent,
  emergencyProtocol,
  personalAgent,
  faqAgent,
} from "../agents";
import { getCollection } from "../mongodb";
import { sendCommunicationEmail, sendEmergencyAlert } from "../email-service";
import type { Communication, ClinicalNote } from "../types";
import { ObjectId } from "mongodb";

/**
 * Node 1: Supervisor routes the query to appropriate agent
 */
export async function supervisorNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing supervisor node");

  const agentType = await supervisorAgent({
    patientId: state.patientId,
    query: state.query,
    chat_history: state.chat_history,
    user_email: state.user_email,
  });

  console.log(`[Graph] Supervisor routed to: ${agentType}`);

  return {
    agent_type: agentType,
  };
}

/**
 * Node 2: Extract severity level
 */
export async function severityNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing severity extraction node");

  const severity = await extractSeverity({
    patientId: state.patientId,
    query: state.query,
    chat_history: state.chat_history,
  });

  console.log(`[Graph] Severity level: ${severity}`);

  return {
    severity,
  };
}

/**
 * Node 3: Clinical Agent
 */
export async function clinicalNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing clinical agent node");

  const clinical = await clinicalAgent({
    patientId: state.patientId,
    query: state.query,
    chat_history: state.chat_history,
  });

  return {
    answer: clinical.answer,
    followUpQuestions: clinical.followUpQuestions,
    severity: clinical.severity,
  };
}

/**
 * Node 4: Emergency Protocol
 */
export async function emergencyNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing emergency protocol node");

  const emergency = await emergencyProtocol({
    patientId: state.patientId,
    query: state.query,
    chat_history: state.chat_history,
  });

  return {
    answer: emergency.message,
    emergencyMessage: emergency.message,
    emergencyNumber: emergency.emergencyNumber,
    nearbyClinicLocations: emergency.nearbyClinicLocations,
    severity: "critical",
  };
}

/**
 * Node 5: Personal Agent
 */
export async function personalNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing personal agent node");

  const personal = await personalAgent({
    patientId: state.patientId,
    query: state.query,
    chat_history: state.chat_history,
    user_email: state.user_email,
  });

  return {
    answer: personal.answer,
    needsEmail: personal.needsEmail,
    conversationHistory: personal.conversationHistory,
  };
}

/**
 * Node 6: FAQ Agent
 */
export async function faqNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing FAQ agent node");

  const answer = await faqAgent({
    patientId: state.patientId,
    query: state.query,
    chat_history: state.chat_history,
  });

  return {
    answer,
  };
}

/**
 * Node 7: Save to Database
 */
export async function saveToDatabaseNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing save to database node");

  try {
    const commsCollection = await getCollection<Communication>(
      "communications"
    );

    // Prepare communication record
    const communicationRecord: Partial<Communication> = {
      patientId: state.patientId,
      type: state.agent_type as any,
      question: state.query,
      answer: state.answer || "",
      severity: state.severity,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
      emailSent: false,
    };

    // Insert into database
    const result = await commsCollection.insertOne(communicationRecord as any);
    const commId = result.insertedId.toString();

    console.log(`[Graph] Saved communication with ID: ${commId}`);

    // Save clinical note if clinical agent
    if (state.agent_type === "clinical") {
      const clinicalCollection = await getCollection<ClinicalNote>(
        "clinical_notes"
      );

      await clinicalCollection.insertOne({
        patientId: state.patientId,
        questionnaireResponses: { query: state.query },
        summary: state.answer || "",
        severity: state.severity || "medium",
        recommendedAction: "Follow up with doctor if symptoms persist",
        createdAt: new Date(),
      } as any);
    }

    return {
      communicationId: commId,
    };
  } catch (error) {
    console.error("[Graph] Database save error:", error);
    return {};
  }
}

/**
 * Node 8: Send Email Notifications
 */
export async function emailNotificationNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing email notification node");

  if (!state.user_email) {
    console.log("[Graph] No email provided, skipping notification");
    return { emailSent: false };
  }

  try {
    // Emergency alert
    if (state.agent_type === "emergency") {
      await sendEmergencyAlert(
        state.user_email,
        state.emergencyMessage ||
          "Emergency detected. Please seek immediate medical attention."
      );

      console.log("[Graph] Emergency alert sent");
      return { emailSent: true };
    }

    // High severity clinical
    if (state.agent_type === "clinical" && state.severity === "high") {
      await sendCommunicationEmail({
        to: state.user_email,
        subject: "Clinical Response - Harley Health Portal",
        htmlContent: state.answer || "",
        questions: [{ q: state.query, a: state.answer || "" }],
      });

      // Update database
      if (state.communicationId) {
        const commsCollection = await getCollection<Communication>(
          "communications"
        );
        await commsCollection.updateOne(
          { _id: new ObjectId(state.communicationId) },
          { $set: { emailSent: true } }
        );
      }

      console.log("[Graph] Clinical email sent");
      return { emailSent: true };
    }

    return { emailSent: false };
  } catch (error) {
    console.error("[Graph] Email notification error:", error);
    return { emailSent: false };
  }
}

/**
 * Node 9: Update Chat History
 */
export async function updateHistoryNode(
  state: HealthcareGraphStateType
): Promise<Partial<HealthcareGraphStateType>> {
  console.log("[Graph] Executing update history node");

  const updatedHistory = [
    ...state.chat_history,
    {
      role: "user" as const,
      content: state.query,
      timestamp: new Date(),
    },
    {
      role: "assistant" as const,
      content: state.answer || "",
      timestamp: new Date(),
    },
  ];

  return {
    chat_history: updatedHistory,
  };
}

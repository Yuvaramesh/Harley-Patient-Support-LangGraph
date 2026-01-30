import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  sendEmergencySummaryToDoctor,
  sendEmergencyAlert,
} from "@/lib/email-service";

const genai = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

/**
 * Generate summary with patient info - UPDATED
 */
async function generateSummaryWithRetry(
  conversationText: string,
  patientId: string,
  patientEmail?: string,
  patientName?: string,
  maxRetries = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[v0] Generating summary - Attempt ${attempt}/${maxRetries}`);

      // Build patient identifier line
      let patientInfo = `**Patient:** ${patientId}`;
      if (patientName) {
        patientInfo = `**Patient:** ${patientName} (ID: ${patientId})`;
      } else if (patientEmail) {
        patientInfo = `**Patient:** ${patientId} (${patientEmail})`;
      }

      const response = await model.generateContent(
        `Please create a concise medical summary of this patient conversation.

IMPORTANT: Start the summary with this exact line:
${patientInfo}

Then structure the rest as follows:
**Presenting Complaint:** [Main reason for visit]
**Key Symptoms:** [Detailed symptom description including severity, timing, location]
**Underlying Conditions:** [Any mentioned chronic conditions or diagnoses]
**Assessment:** [Clinical evaluation and severity assessment]

Focus on key symptoms, concerns, and assessment. Keep it professional, structured, and factual. Do NOT provide treatment recommendations.

Conversation:
${conversationText}`,
      );

      const summary = response.response.text();
      console.log("[v0] Summary generated successfully");
      return summary;
    } catch (error: any) {
      console.error(`[v0] Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`[v0] Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Failed to generate summary after all retries");
}

function isRetryableError(error: any): boolean {
  const errorMessage = error.message?.toLowerCase() || "";
  const retryableErrors = [
    "503",
    "service unavailable",
    "overloaded",
    "timeout",
    "429",
    "too many requests",
  ];
  return retryableErrors.some((err) => errorMessage.includes(err));
}

/**
 * Create fallback summary with patient info - UPDATED
 */
function createFallbackSummary(
  messages: any[],
  patientId: string,
  patientEmail?: string,
  patientName?: string,
): string {
  if (messages.length === 0) return "No conversation data available.";

  // Build patient identifier line
  let patientInfo = `**Patient:** ${patientId}`;
  if (patientName) {
    patientInfo = `**Patient:** ${patientName} (ID: ${patientId})`;
  } else if (patientEmail) {
    patientInfo = `**Patient:** ${patientId} (${patientEmail})`;
  }

  let summary = `${patientInfo}\n\n**Conversation Summary**\n\n`;
  summary += `Total exchanges: ${Math.ceil(messages.length / 2)}\n\n`;

  const userMessages = messages.filter((m: any) => m.role === "user");
  const assistantMessages = messages.filter((m: any) => m.role === "assistant");

  if (userMessages.length > 0) {
    summary += "**Key Topics Discussed:**\n";
    userMessages.slice(0, 3).forEach((msg: any, idx: number) => {
      const preview = msg.content.substring(0, 100);
      summary += `${idx + 1}. ${preview}${
        msg.content.length > 100 ? "..." : ""
      }\n`;
    });
  }

  if (assistantMessages.length > 0) {
    summary += "\n**Assessment Summary:**\n";
    const lastResponse =
      assistantMessages[assistantMessages.length - 1].content;
    const preview = lastResponse.substring(0, 150);
    summary += `${preview}${lastResponse.length > 150 ? "..." : ""}`;
  }

  summary +=
    "\n\n*Note: Summary created from conversation data. Generated at: " +
    new Date().toLocaleString() +
    "*";

  return summary;
}

async function getDoctorEmailForPatient(
  patientId: string,
): Promise<string | null> {
  try {
    const patientsCollection = await getCollection("patients");
    const patient = await patientsCollection.findOne({ patientId });

    if (patient && (patient as any).assignedDoctorEmail) {
      return (patient as any).assignedDoctorEmail;
    }

    // Fallback: check if there's a default doctor email in environment
    return process.env.DEFAULT_DOCTOR_EMAIL || null;
  } catch (error) {
    console.error("[v0] Error fetching doctor email:", error);
    return null;
  }
}

/**
 * Fetch patient name from database
 */
async function getPatientName(
  patientId: string,
  email?: string,
): Promise<string | undefined> {
  try {
    const patientsCollection = await getCollection("patients");
    const patient = await patientsCollection.findOne({
      $or: [{ patientId }, ...(email ? [{ email }] : [])],
    });
    return patient?.name;
  } catch (error) {
    console.error("[v0] Error fetching patient name:", error);
    return undefined;
  }
}

async function shouldSendToPatient(
  messages: any[],
  communicationType: string,
): Promise<boolean> {
  if (communicationType === "emergency") {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const {
      patientId,
      email,
      messages,
      severity,
      communicationType,
      sessionId,
      qaPairCount,
      isConversationComplete,
    } = await request.json();

    if (!patientId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: patientId and email are required" },
        { status: 400 },
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing required field: messages array is required" },
        { status: 400 },
      );
    }

    console.log(
      `[v0] Creating ${
        communicationType || "clinical"
      } summary for patient ${patientId} with ${messages.length} messages`,
    );

    const conversationText = messages
      .map(
        (msg: any) =>
          `${msg.role === "user" ? "Patient" : "Assistant"}: ${msg.content}`,
      )
      .join("\n\n");

    // Fetch patient name for summary
    const patientName = await getPatientName(patientId, email);

    let summary: string;
    let summarySource = "ai_generated";

    try {
      summary = await generateSummaryWithRetry(
        conversationText,
        patientId,
        email,
        patientName,
      );
    } catch (aiError: any) {
      console.error("[v0] AI summary generation failed:", aiError.message);
      console.log("[v0] Using fallback summary generation");
      summary = createFallbackSummary(messages, patientId, email, patientName);
      summarySource = "fallback";
    }

    const timestamp = new Date();
    const chatHistoryCollection = await getCollection("chat_history");
    const commType = communicationType || "clinical";
    const sentToPatient = await shouldSendToPatient(messages, commType);

    const summaryRecord = {
      sessionId,
      patientId,
      patientEmail: email,
      type: "summary",
      summary,
      severity: severity || "medium",
      timestamp,
      createdAt: timestamp,
      status: "completed",
      emailSent: false,
      messageCount: messages.length,
      summarySource,
      sentToPatient,
      sentToDoctor: true,
      communicationType: commType,
      qaPairCount,
      isConversationComplete: isConversationComplete || true,
      isConversationSummary: true,
    };

    const chatHistoryResult = await chatHistoryCollection.insertOne(
      summaryRecord as any,
    );

    console.log(
      `[v0] ✓ Summary stored ONLY in CHAT_HISTORY collection (ID: ${chatHistoryResult.insertedId})`,
      {
        sessionId,
        qaPairCount,
        communicationType: commType,
        severity,
        sentToPatient,
        collection: "chat_history",
        NOT_saved_to: "clinical_notes or communications",
      },
    );

    let emailSent = false;
    if (severity === "high" || severity === "critical") {
      console.log(
        `[v0] Emergency severity detected (${severity}), sending emergency emails`,
      );

      const doctorEmail = await getDoctorEmailForPatient(patientId);

      // Send alert to patient
      const patientAlertSent = await sendEmergencyAlert(
        email,
        `Based on your recent conversation, our system has detected a potentially serious health concern. Please seek immediate medical attention or contact emergency services if necessary.`,
      );

      // Send detailed summary to doctor
      let doctorEmailSent = false;
      if (doctorEmail) {
        const patientsCollection = await getCollection("patients");
        const patient = await patientsCollection.findOne({ patientId });

        doctorEmailSent = await sendEmergencySummaryToDoctor(
          doctorEmail,
          (patient as any)?.name || "Unknown Patient",
          (patient as any)?.contact || email,
          `Patient reported symptoms that may require urgent attention. Severity level: ${severity}`,
          summary,
        );
      } else {
        console.warn(
          "[v0] No doctor email found for patient, skipping doctor notification",
        );
      }

      emailSent = patientAlertSent && doctorEmailSent;
      console.log(
        `[v0] Emergency emails sent - Patient: ${patientAlertSent}, Doctor: ${doctorEmailSent}`,
      );

      // Update chat_history record to mark emails as sent
      if (emailSent) {
        await chatHistoryCollection.updateOne(
          { _id: chatHistoryResult.insertedId },
          {
            $set: {
              emailSent: true,
              emergencyEmailsSent: { doctor: true, patient: true },
            },
          },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Summary created and stored in chat_history collection only",
      summarySource,
      sentToPatient,
      communicationType: commType,
      emergencyEmailsSent:
        severity === "high" || severity === "critical" ? emailSent : undefined,
      data: {
        chatHistoryId: chatHistoryResult.insertedId,
        ...summaryRecord,
      },
    });
  } catch (error) {
    console.error("[v0] Error in summary route:", error);
    return NextResponse.json(
      {
        error: "Failed to create summary",
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}

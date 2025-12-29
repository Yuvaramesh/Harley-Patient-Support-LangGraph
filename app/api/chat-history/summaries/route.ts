import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// Field tracking interface
interface ProfileField {
  field: string;
  label: string;
  status: "present" | "updated" | "appended";
  value?: any;
  previousValue?: any;
  updatedAt?: Date;
}

interface ProfileChecklist {
  patientId: string;
  sessionId: string;
  fields: ProfileField[];
  completionPercentage: number;
  lastUpdated: Date;
}

// Define all possible profile fields
const PROFILE_FIELDS = [
  { field: "name", label: "Name", category: "personal" },
  { field: "patientId", label: "Patient ID", category: "personal" },
  { field: "email", label: "Email", category: "personal" },
  { field: "contact", label: "Contact", category: "personal" },
  { field: "age", label: "Age", category: "personal" },
  { field: "ethnicity", label: "Ethnicity", category: "personal" },
  { field: "height", label: "Height", category: "physical" },
  { field: "weight", label: "Weight", category: "physical" },
  { field: "currentWeight", label: "Current Weight", category: "physical" },
  { field: "startingWeight", label: "Starting Weight", category: "physical" },
  { field: "goalWeight", label: "Goal Weight", category: "physical" },
  { field: "bmi", label: "BMI", category: "physical" },
  {
    field: "weightLossDuration",
    label: "Weight Loss Duration",
    category: "physical",
  },
  { field: "diabetesStatus", label: "Diabetes Status", category: "medical" },
  { field: "allergies", label: "Allergies", category: "medical" },
  { field: "otherConditions", label: "Other Conditions", category: "medical" },
  {
    field: "medicalConditions",
    label: "Medical Conditions",
    category: "medical",
  },
  {
    field: "medicationHistory",
    label: "Medication History",
    category: "medical",
  },
  {
    field: "currentMedications",
    label: "Current Medications",
    category: "medical",
  },
  { field: "orderHistory", label: "Order History", category: "orders" },
  { field: "totalOrders", label: "Total Orders", category: "orders" },
  {
    field: "currentTreatmentStatus",
    label: "Treatment Status",
    category: "treatment",
  },
  { field: "feelingRating", label: "Feeling Rating", category: "treatment" },
  { field: "sideEffects", label: "Side Effects", category: "treatment" },
  {
    field: "sideEffectsDetails",
    label: "Side Effects Details",
    category: "treatment",
  },
  {
    field: "takingAsPrescribed",
    label: "Taking As Prescribed",
    category: "treatment",
  },
  {
    field: "medicationChanges",
    label: "Medication Changes",
    category: "treatment",
  },
];

/**
 * GET endpoint - Retrieve conversation summaries with profile checklist
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");
    const userRole = searchParams.get("userRole");
    const communicationType = searchParams.get("type");

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required" },
        { status: 400 }
      );
    }

    const chatHistoryCollection = await getCollection("chat_history");
    const patientsCollection = await getCollection("patients");

    const query: any = {
      patientId,
      isConversationSummary: true,
    };

    if (communicationType && communicationType !== "all") {
      query.communicationType = communicationType;
    }

    const summaries = await chatHistoryCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    // Get patient profile data
    const patientProfile = await patientsCollection.findOne({ patientId });

    // Generate profile checklist based on available data
    const checklist = generateProfileChecklist(patientProfile, summaries);

    const communications = summaries.map((record: any) => ({
      _id: record._id?.toString() || "",
      patientId: record.patientId,
      patientEmail: record.patientEmail,
      type: record.communicationType || "clinical",
      summary: record.summary || "",
      status: record.status || "completed",
      createdAt: record.createdAt,
      timestamp: record.createdAt,
      messageCount: record.messageCount || 0,
      severity: record.severity || "medium",
      sentToDoctor: record.sentToDoctor !== false,
      sentToPatient: record.sentToPatient !== false,
      sessionId: record.sessionId,
      qaPairCount: record.qaPairCount,
      profileFields: record.profileFields || [],
    }));

    console.log(
      `[v0 API] Retrieved ${communications.length} conversation summaries for patient ${patientId} from CHAT_HISTORY collection`,
      {
        userRole,
        communicationType,
        collection: "chat_history",
        checklistGenerated: true,
      }
    );

    return NextResponse.json({
      communications,
      profileChecklist: checklist,
      totalFields: PROFILE_FIELDS.length,
      completedFields: checklist.fields.filter((f) => f.status !== "missing")
        .length,
    });
  } catch (error) {
    console.error("Chat History Summaries API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history summaries" },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint - Append new conversation summary
 */
export async function POST(request: NextRequest) {
  try {
    const {
      patientId,
      patientEmail,
      sessionId,
      summary,
      messages,
      communicationType,
      severity,
      qaPairCount,
      profileUpdates,
    } = await request.json();

    if (!patientId || !summary || !sessionId) {
      return NextResponse.json(
        {
          error: "Missing required fields: patientId, summary, and sessionId",
        },
        { status: 400 }
      );
    }

    const chatHistoryCollection = await getCollection("chat_history");
    const patientsCollection = await getCollection("patients");

    // Get existing patient profile
    const existingProfile = await patientsCollection.findOne({ patientId });

    // Detect field changes
    const fieldChanges = detectFieldChanges(
      existingProfile,
      profileUpdates || {}
    );

    // Create new summary record
    const timestamp = new Date();
    const summaryRecord = {
      sessionId,
      patientId,
      patientEmail: patientEmail || existingProfile?.email,
      type: "summary",
      summary,
      severity: severity || "medium",
      timestamp,
      createdAt: timestamp,
      status: "completed",
      emailSent: false,
      messageCount: messages?.length || 0,
      summarySource: "ai_generated",
      sentToPatient: true,
      sentToDoctor: true,
      communicationType: communicationType || "clinical",
      qaPairCount: qaPairCount || 0,
      isConversationComplete: true,
      isConversationSummary: true,
      profileFields: fieldChanges,
      profileUpdates: profileUpdates || {},
    };

    const result = await chatHistoryCollection.insertOne(summaryRecord as any);

    // Update patient profile if there are updates
    if (profileUpdates && Object.keys(profileUpdates).length > 0) {
      await patientsCollection.updateOne(
        { patientId },
        {
          $set: {
            ...profileUpdates,
            updatedAt: timestamp,
          },
        }
      );
    }

    // Generate updated checklist
    const updatedProfile = await patientsCollection.findOne({ patientId });
    const allSummaries = await chatHistoryCollection
      .find({ patientId, isConversationSummary: true })
      .sort({ createdAt: -1 })
      .toArray();

    const checklist = generateProfileChecklist(updatedProfile, allSummaries);

    console.log(
      `[v0 API] ✓ Appended conversation summary to CHAT_HISTORY collection (ID: ${result.insertedId})`,
      {
        sessionId,
        patientId,
        fieldChanges: fieldChanges.length,
        collection: "chat_history",
      }
    );

    return NextResponse.json({
      success: true,
      message: "Conversation summary appended successfully",
      summaryId: result.insertedId.toString(),
      fieldChanges,
      profileChecklist: checklist,
      data: {
        ...summaryRecord,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("POST Chat History Summaries API error:", error);
    return NextResponse.json(
      {
        error: "Failed to append conversation summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Detect changes between existing profile and new updates
 */
function detectFieldChanges(
  existingProfile: any,
  newUpdates: any
): ProfileField[] {
  const changes: ProfileField[] = [];

  PROFILE_FIELDS.forEach(({ field, label, category }) => {
    const existingValue = existingProfile?.[field];
    const newValue = newUpdates[field];

    if (newValue !== undefined && newValue !== null) {
      if (existingValue === undefined || existingValue === null) {
        // Field was appended (newly added)
        changes.push({
          field,
          label,
          status: "appended",
          value: newValue,
          updatedAt: new Date(),
        });
      } else if (existingValue !== newValue) {
        // Field was updated (value changed)
        changes.push({
          field,
          label,
          status: "updated",
          value: newValue,
          previousValue: existingValue,
          updatedAt: new Date(),
        });
      } else {
        // Field is present (no change)
        changes.push({
          field,
          label,
          status: "present",
          value: existingValue,
        });
      }
    } else if (existingValue !== undefined && existingValue !== null) {
      // Field exists but not in update
      changes.push({
        field,
        label,
        status: "present",
        value: existingValue,
      });
    }
  });

  return changes;
}

/**
 * Generate profile checklist with status indicators
 */
function generateProfileChecklist(
  patientProfile: any,
  summaries: any[]
): ProfileChecklist {
  const fields: ProfileField[] = [];

  // Track all field updates across summaries
  const fieldHistory = new Map<
    string,
    { status: string; value: any; date: Date }
  >();

  summaries.forEach((summary) => {
    if (summary.profileFields && Array.isArray(summary.profileFields)) {
      summary.profileFields.forEach((field: ProfileField) => {
        const existing = fieldHistory.get(field.field);
        if (
          !existing ||
          new Date(summary.createdAt) > existing.date ||
          field.status === "updated"
        ) {
          fieldHistory.set(field.field, {
            status: field.status,
            value: field.value,
            date: new Date(summary.createdAt),
          });
        }
      });
    }
  });

  // Generate checklist for all fields
  PROFILE_FIELDS.forEach(({ field, label, category }) => {
    const profileValue = patientProfile?.[field];
    const historyEntry = fieldHistory.get(field);

    if (historyEntry) {
      fields.push({
        field,
        label,
        status: historyEntry.status as any,
        value: historyEntry.value,
        updatedAt: historyEntry.date,
      });
    } else if (profileValue !== undefined && profileValue !== null) {
      fields.push({
        field,
        label,
        status: "present",
        value: profileValue,
      });
    }
  });

  // Calculate completion percentage
  const totalFields = PROFILE_FIELDS.length;
  const completedFields = fields.length;
  const completionPercentage = Math.round(
    (completedFields / totalFields) * 100
  );

  return {
    patientId: patientProfile?.patientId || "",
    sessionId: summaries[0]?.sessionId || "",
    fields,
    completionPercentage,
    lastUpdated: new Date(),
  };
}

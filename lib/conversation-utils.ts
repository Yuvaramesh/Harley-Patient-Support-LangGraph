// Utility functions for appending conversations and updating profile

/**
 * Append a conversation summary with profile updates
 */
export async function appendConversationSummary(data: {
  patientId: string;
  patientEmail: string;
  sessionId: string;
  summary: string;
  messages: Array<{ role: string; content: string }>;
  communicationType?: "clinical" | "faq" | "personal" | "emergency";
  severity?: "low" | "medium" | "high" | "critical";
  qaPairCount?: number;
  profileUpdates?: Record<string, any>;
}) {
  try {
    const response = await fetch(
      "/api/chat-history/summaries?patientId=" +
        data.patientId +
        "&userRole=patient&type=all",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Failed to append conversation:", error);
    throw error;
  }
}

/**
 * Extract profile updates from conversation messages
 */
export function extractProfileUpdates(
  messages: Array<{
    role: string;
    content: string;
  }>
): Record<string, any> {
  const updates: Record<string, any> = {};

  // This is a simplified example - in production, you'd use NLP or LLM to extract structured data
  messages.forEach((msg) => {
    const content = msg.content.toLowerCase();

    // Age
    const ageMatch = content.match(
      /(?:i am|i'm|age is?)\s*(\d+)\s*(?:years old)?/i
    );
    if (ageMatch) {
      updates.age = parseInt(ageMatch[1]);
    }

    // Weight
    const weightMatch = content.match(
      /(?:weigh|weight is?)\s*(\d+)\s*(?:kg|pounds)?/i
    );
    if (weightMatch) {
      updates.currentWeight = `${weightMatch[1]} kg`;
    }

    // Height
    const heightMatch = content.match(
      /(?:height is?|i am)\s*(\d+)\s*(?:cm|feet)?/i
    );
    if (heightMatch) {
      updates.height = `${heightMatch[1]} cm`;
    }

    // Medications
    if (content.includes("taking") || content.includes("medication")) {
      const medMatch = content.match(/taking\s+([a-zA-Z]+)/i);
      if (medMatch) {
        if (!updates.currentMedications) {
          updates.currentMedications = [];
        }
        updates.currentMedications.push(medMatch[1]);
      }
    }

    // Diabetes
    if (content.includes("diabetes")) {
      if (content.includes("no") || content.includes("not")) {
        updates.diabetesStatus =
          "No, but there is a history of diabetes in my family";
      } else {
        updates.diabetesStatus = "Yes";
      }
    }

    // Allergies
    if (content.includes("allergic") || content.includes("allergy")) {
      const allergyMatch = content.match(/allergic to\s+([a-zA-Z\s,]+)/i);
      if (allergyMatch) {
        updates.allergies = allergyMatch[1].split(",").map((a) => a.trim());
      }
    }
  });

  return updates;
}

/**
 * Example usage in chat interface
 */
export async function handleConversationEnd(
  patientId: string,
  patientEmail: string,
  sessionId: string,
  messages: Array<{ role: string; content: string; timestamp: Date }>,
  summary: string
) {
  try {
    // Extract profile updates from conversation
    const profileUpdates = extractProfileUpdates(messages);

    // Append conversation with updates
    const result = await appendConversationSummary({
      patientId,
      patientEmail,
      sessionId,
      summary,
      messages,
      communicationType: "clinical",
      severity: "medium",
      qaPairCount: Math.floor(messages.length / 2),
      profileUpdates,
    });

    console.log("Conversation appended successfully:", {
      summaryId: result.summaryId,
      fieldChanges: result.fieldChanges,
      completionPercentage: result.profileChecklist.completionPercentage,
    });

    return result;
  } catch (error) {
    console.error("Failed to handle conversation end:", error);
    throw error;
  }
}

/**
 * Manual profile update function
 */
export async function updatePatientProfile(
  patientId: string,
  patientEmail: string,
  updates: Record<string, any>
) {
  try {
    // Create a synthetic conversation for manual updates
    const sessionId = `manual_${Date.now()}`;
    const summary = `Manual profile update: ${Object.keys(updates).join(", ")}`;

    const result = await appendConversationSummary({
      patientId,
      patientEmail,
      sessionId,
      summary,
      messages: [],
      communicationType: "personal",
      profileUpdates: updates,
    });

    return result;
  } catch (error) {
    console.error("Failed to update profile:", error);
    throw error;
  }
}

// Example usage patterns:

/*
// Example 1: End conversation with automatic profile extraction
await handleConversationEnd(
  "yuvasri1102003gmailcom",
  "yuvasri1102003@gmail.com",
  "session_123456",
  [
    { role: "user", content: "I am 22 years old", timestamp: new Date() },
    { role: "assistant", content: "Thank you for sharing...", timestamp: new Date() },
    { role: "user", content: "I weigh 78 kg", timestamp: new Date() },
    { role: "assistant", content: "I've recorded that...", timestamp: new Date() },
  ],
  "Patient discussed age and weight during health assessment."
);

// Example 2: Manual profile update
await updatePatientProfile(
  "yuvasri1102003gmailcom",
  "yuvasri1102003@gmail.com",
  {
    age: 22,
    currentWeight: "78 kg",
    height: "171 cm",
    bmi: 27.7,
    allergies: [],
  }
);

// Example 3: Append order information
await appendConversationSummary({
  patientId: "yuvasri1102003gmailcom",
  patientEmail: "yuvasri1102003@gmail.com",
  sessionId: "order_session_789",
  summary: "Patient placed order for Mounjaro 2.5mg",
  messages: [],
  communicationType: "personal",
  profileUpdates: {
    orderHistory: [
      {
        id: "111",
        medication: "Mounjaro",
        dosage: "2.5mg",
        date: "06/11/2025",
        status: "clinicalCheck",
      },
    ],
    totalOrders: 2,
  },
});
*/

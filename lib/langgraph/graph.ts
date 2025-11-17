// lib/langgraph/graph.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import {
  HealthcareGraphState,
  type HealthcareGraphStateType,
} from "../langgraph/state";
import {
  supervisorNode,
  severityNode,
  clinicalNode,
  emergencyNode,
  personalNode,
  faqNode,
  saveToDatabaseNode,
  emailNotificationNode,
  updateHistoryNode,
} from "../langgraph/nodes";
import { routeAgent, shouldSendEmail } from "../langgraph/edges";

/**
 * Build the healthcare multi-agent graph
 */
export function buildHealthcareGraph() {
  // Create the graph builder with our state schema
  const graphBuilder = new StateGraph(HealthcareGraphState);

  // Add all nodes
  graphBuilder.addNode("supervisor", supervisorNode);
  graphBuilder.addNode("extract_severity", severityNode);
  graphBuilder.addNode("clinical_agent", clinicalNode);
  graphBuilder.addNode("emergency_agent", emergencyNode);
  graphBuilder.addNode("personal_agent", personalNode);
  graphBuilder.addNode("faq_agent", faqNode);
  graphBuilder.addNode("save_to_database", saveToDatabaseNode);
  graphBuilder.addNode("send_email", emailNotificationNode);
  graphBuilder.addNode("update_history", updateHistoryNode);

  // Define the graph flow
  // START -> supervisor -> extract_severity -> [route to agent]
  graphBuilder.addEdge(START, "supervisor");
  graphBuilder.addEdge("supervisor", "extract_severity");

  // Conditional routing from extract_severity to appropriate agent
  graphBuilder.addConditionalEdges("extract_severity", routeAgent, {
    emergency_agent: "emergency_agent",
    clinical_agent: "clinical_agent",
    personal_agent: "personal_agent",
    faq_agent: "faq_agent",
  });

  // All agents -> save_to_database
  graphBuilder.addEdge("emergency_agent", "save_to_database");
  graphBuilder.addEdge("clinical_agent", "save_to_database");
  graphBuilder.addEdge("personal_agent", "save_to_database");
  graphBuilder.addEdge("faq_agent", "save_to_database");

  // Conditional email notification
  graphBuilder.addConditionalEdges("save_to_database", shouldSendEmail, {
    send_email: "send_email",
    update_history: "update_history",
  });

  // send_email -> update_history
  graphBuilder.addEdge("send_email", "update_history");

  // update_history -> END
  graphBuilder.addEdge("update_history", END);

  // Compile the graph
  const graph = graphBuilder.compile();

  console.log("[Graph] Healthcare multi-agent graph compiled successfully");

  return graph;
}

/**
 * Execute the healthcare graph with input state
 */
export async function runHealthcareGraph(
  input: Partial<HealthcareGraphStateType>
): Promise<HealthcareGraphStateType> {
  console.log("[Graph] Starting graph execution");
  console.log("[Graph] Input state:", {
    patientId: input.patientId,
    query: input.query,
    user_email: input.user_email,
  });

  const graph = buildHealthcareGraph();

  try {
    // Invoke the graph with the input state
    const result = await graph.invoke(input);

    console.log("[Graph] Graph execution completed");
    console.log("[Graph] Output state:", {
      agent_type: result.agent_type,
      severity: result.severity,
      emailSent: result.emailSent,
    });

    return result;
  } catch (error) {
    console.error("[Graph] Graph execution error:", error);
    throw error;
  }
}

/**
 * Stream the graph execution (useful for real-time updates)
 */
export async function streamHealthcareGraph(
  input: Partial<HealthcareGraphStateType>
): Promise<AsyncGenerator<HealthcareGraphStateType>> {
  console.log("[Graph] Starting graph streaming");

  const graph = buildHealthcareGraph();

  try {
    const stream = await graph.stream(input);
    return stream as AsyncGenerator<HealthcareGraphStateType>;
  } catch (error) {
    console.error("[Graph] Graph streaming error:", error);
    throw error;
  }
}

// Export a singleton instance
let graphInstance: ReturnType<typeof buildHealthcareGraph> | null = null;

export function getHealthcareGraph() {
  if (!graphInstance) {
    graphInstance = buildHealthcareGraph();
  }
  return graphInstance;
}

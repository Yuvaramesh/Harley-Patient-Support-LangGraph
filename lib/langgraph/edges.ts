// lib/langgraph/edges.ts
import type { HealthcareGraphStateType } from "../langgraph/state";

/**
 * Router function that determines which agent node to execute
 * Based on the agent_type set by the supervisor
 */
export function routeAgent(state: HealthcareGraphStateType): string {
  const agentType = state.agent_type;

  console.log(`[Graph] Routing to agent: ${agentType}`);

  switch (agentType) {
    case "emergency":
      return "emergency_agent";
    case "clinical":
      return "clinical_agent";
    case "personal":
      return "personal_agent";
    case "generic_faq":
      return "faq_agent";
    default:
      // Default to clinical agent
      return "clinical_agent";
  }
}

/**
 * Determine if email notification should be sent
 */
export function shouldSendEmail(state: HealthcareGraphStateType): string {
  // Send email for emergency or high severity clinical cases
  if (state.agent_type === "emergency") {
    return "send_email";
  }

  if (state.agent_type === "clinical" && state.severity === "high") {
    return "send_email";
  }

  // Skip email notification
  return "update_history";
}

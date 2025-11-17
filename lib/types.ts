// lib/types.ts
import type { ObjectId } from "mongodb";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatState {
  patientId: string;
  query: string;
  chat_history: ChatMessage[];
  agent_type?: string;
  answer?: string;
  context_chunks?: string[];
  severity?: "low" | "medium" | "high" | "critical";
  selected_file?: string;
  user_email?: string;
}

export interface Patient {
  _id?: ObjectId;
  email: string;
  name: string;
  age: number;
  medicalHistory?: string[];
  geneticHistory?: string[];
  emergencyContact?: string;
  emergencyNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Communication {
  _id?: ObjectId;
  patientId: string;
  type: "clinical" | "personal" | "generic_faq" | "emergency";
  question: string;
  answer: string;
  severity?: string;
  assignedTo?: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
  emailSent: boolean;
}

export interface ClinicalNote {
  _id?: ObjectId;
  patientId: string;
  questionnaireResponses: Record<string, string>;
  summary: string;
  severity: string;
  recommendedAction: string;
  createdAt: Date;
}

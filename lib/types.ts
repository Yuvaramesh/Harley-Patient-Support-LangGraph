import type { ObjectId } from "mongodb";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
export interface Doctor {
  dr_email?: string;
}

export interface ChatState {
  query: string;
  chat_history: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp?: Date;
  }>;
  patientId?: string;
  email?: string;
}

export interface Patient {
  _id?: ObjectId;
  email: string;
  name: string;
  contact: string;
  age?: number;
  medicalHistory?: string[];
  geneticHistory?: string[];
  emergencyContact?: string;
  emergencyNumber?: string;
  patientId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Communication {
  _id?: string;
  patientId: string;
  patientEmail?: string;
  type: "clinical" | "faq" | "personal" | "emergency"; // Added communication type enum
  question?: string;
  answer?: string;
  summary?: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp?: Date;
  createdAt: Date;
  status: "read" | "unread" | "pending" | "completed";
  emailSent?: boolean;
  messageCount?: number;
  updatedAt?: Date;
  readBy?: string[];
  notes?: string;
  followUpRequired?: boolean;
  sentToPatient?: boolean; // Track if summary sent to patient (false for emergency)
  sentToDoctor?: boolean; // Track if summary sent to doctor
}

export interface ChatHistory {
  _id?: ObjectId;
  patientId: string;
  patientEmail: string;
  conversationId: string;
  messages: ChatMessage[];
  summary?: string;
  summaryId?: ObjectId;
  createdAt: Date;
  status: "active" | "completed" | "archived";
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

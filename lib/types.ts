// lib/types.ts (Enhanced Patient Interface)
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
  answer?: string;
  sessionId?: string;
  qaPairCount?: number;
}

// Enhanced Medication History Interface
export interface MedicationHistory {
  name: string;
  dosage?: string;
  startingWeight?: number;
  currentlyTaking: boolean;
  lastDoseDate?: string;
  sideEffects?: string[];
}

// Order Details Interface
export interface OrderDetails {
  orderId: number;
  product: string;
  productPlan: string;
  dosage: string;
  orderDate: string;
  orderState: string;
}

// Current Order Information
export interface CurrentOrderInfo {
  feelingRating?: string;
  sideEffects?: string;
  sideEffectsDetails?: string;
  severityRating?: string;
  takingAsPrescribed?: string;
  medicationChanges?: string;
}

// Enhanced Patient Interface
export interface Patient {
  _id?: ObjectId;
  email: string;
  name: string;
  contact: string;
  patientId?: string;

  // Basic Demographics
  age?: string;
  ethnicity?: string;
  sex?: string;

  // Physical Measurements
  height?: number; // in cm
  weight?: number; // in kg
  bmi?: number;
  currentWeight?: number;
  goalWeight?: number;

  // Weight Management
  weightLossDuration?: string;
  weightLossApproaches?: string;

  // Medical History
  diabetesStatus?: string;
  medicalConditions?: string[];
  otherMedicalConditions?: string;

  // Medications
  medicationHistory?: MedicationHistory[];
  currentMedications?: string;

  // Allergies
  allergies?: string[];

  // GP Information
  gpNotification?: boolean;
  gpEmail?: string;
  assignedDoctorEmail?: string;

  // Order Information
  currentOrderInfo?: CurrentOrderInfo;
  orderHistory?: OrderDetails[];
  totalOrders?: number;

  // Legacy fields
  medicalHistory?: string[];
  geneticHistory?: string[];
  emergencyContact?: string;
  emergencyNumber?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface Communication {
  _id?: ObjectId;
  patientId: string;
  patientEmail?: string;
  type: "clinical" | "faq" | "personal" | "emergency";
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
  sentToPatient?: boolean;
  sentToDoctor?: boolean;
  sessionId?: string;
  qaPairCount?: number;
}

export interface ChatHistory {
  _id?: ObjectId;
  patientId: string;
  patientEmail: string;
  conversationId: string;
  messages: ChatMessage[];
  summary?: string;
  summaryId?: ObjectId;
  communicationType?: "clinical" | "faq" | "personal" | "emergency";
  severity?: "low" | "medium" | "high" | "critical";
  initialMessage?: string;
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

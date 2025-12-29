"use client";

import { CheckCircle, Info, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProfileField {
  field: string;
  label: string;
  status: "present" | "updated" | "appended";
  value?: any;
  previousValue?: any;
  updatedAt?: Date;
}

interface ProfileChecklistProps {
  fields: ProfileField[];
  completionPercentage: number;
  lastUpdated: Date;
}

export function ProfileChecklist({
  fields,
  completionPercentage,
  lastUpdated,
}: ProfileChecklistProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "updated":
        return <Sparkles className="w-4 h-4 text-blue-600" />;
      case "appended":
        return <Info className="w-4 h-4 text-purple-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "present":
        return "✓";
      case "updated":
        return "💡";
      case "appended":
        return "ⓘ";
      default:
        return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-50 text-green-700 border-green-200";
      case "updated":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "appended":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  // Group fields by category
  const groupedFields = fields.reduce((acc, field) => {
    // Determine category from field definitions
    const category = getFieldCategory(field.field);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {} as Record<string, ProfileField[]>);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">
            Profile Information Checklist
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Completion:</span>
            <Badge variant="default" className="text-base font-semibold">
              {completionPercentage}%
            </Badge>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm">✓ Present</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm">💡 Updated</span>
          </div>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-purple-600" />
            <span className="text-sm">ⓘ Appended</span>
          </div>
        </div>

        {/* Grouped Fields */}
        {Object.entries(groupedFields).map(([category, categoryFields]) => (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              {category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryFields.map((field) => (
                <div
                  key={field.field}
                  className={`p-3 rounded-lg border ${getStatusColor(
                    field.status
                  )}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(field.status)}
                        <span className="text-sm font-medium">
                          {getStatusLabel(field.status)} {field.label}
                        </span>
                      </div>

                      {field.value !== undefined && (
                        <div className="text-xs mt-1">
                          <span className="text-gray-600">Value: </span>
                          <span className="font-medium">
                            {formatValue(field.value)}
                          </span>
                        </div>
                      )}

                      {field.status === "updated" && field.previousValue && (
                        <div className="text-xs mt-1 text-gray-500">
                          <span>Previous: </span>
                          <span className="line-through">
                            {formatValue(field.previousValue)}
                          </span>
                        </div>
                      )}

                      {field.updatedAt && (
                        <div className="text-xs mt-1 text-gray-500">
                          {new Date(field.updatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Missing Fields Summary */}
        {fields.length < getTotalFieldCount() && (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>{getTotalFieldCount() - fields.length}</strong> fields are
              still missing. Continue conversations to complete your profile.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper functions
function getFieldCategory(fieldName: string): string {
  const categories: Record<string, string[]> = {
    Personal: ["name", "patientId", "email", "contact", "age", "ethnicity"],
    Physical: [
      "height",
      "weight",
      "currentWeight",
      "startingWeight",
      "goalWeight",
      "bmi",
      "weightLossDuration",
    ],
    Medical: [
      "diabetesStatus",
      "allergies",
      "otherConditions",
      "medicalConditions",
      "medicationHistory",
      "currentMedications",
    ],
    Orders: ["orderHistory", "totalOrders"],
    Treatment: [
      "currentTreatmentStatus",
      "feelingRating",
      "sideEffects",
      "sideEffectsDetails",
      "takingAsPrescribed",
      "medicationChanges",
    ],
  };

  for (const [category, fields] of Object.entries(categories)) {
    if (fields.includes(fieldName)) {
      return category;
    }
  }
  return "Other";
}

function formatValue(value: any): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "None";
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function getTotalFieldCount(): number {
  return 25; // Total number of tracked fields
}

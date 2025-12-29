"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileChecklist } from "./patient-checklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Activity, FileText } from "lucide-react";

interface PatientProfileViewerProps {
  patientId: string;
  patientEmail: string;
}

export function PatientProfileViewer({
  patientId,
  patientEmail,
}: PatientProfileViewerProps) {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [communications, setCommunications] = useState<any[]>([]);

  useEffect(() => {
    fetchProfileData();
  }, [patientId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);

      // Fetch communications with checklist
      const response = await fetch(
        `/api/chat-history/summaries?patientId=${patientId}&userRole=patient&type=all`
      );
      const data = await response.json();

      setCommunications(data.communications || []);
      setChecklist(data.profileChecklist);

      // Fetch patient profile
      const profileResponse = await fetch(
        `/api/patient/profile?email=${encodeURIComponent(patientEmail)}`
      );
      const profileData = await profileResponse.json();

      setProfileData(profileData.data);
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="checklist" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="checklist">
            <Activity className="w-4 h-4 mr-2" />
            Profile Checklist
          </TabsTrigger>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile Details
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileText className="w-4 h-4 mr-2" />
            Conversation History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="mt-6">
          {checklist && (
            <ProfileChecklist
              fields={checklist.fields}
              completionPercentage={checklist.completionPercentage}
              lastUpdated={checklist.lastUpdated}
            />
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {profileData ? (
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Name" value={profileData.name} />
                      <InfoField
                        label="Patient ID"
                        value={profileData.patientId}
                      />
                      <InfoField label="Email" value={profileData.email} />
                      <InfoField label="Contact" value={profileData.contact} />
                      <InfoField label="Age" value={profileData.age} />
                      <InfoField
                        label="Ethnicity"
                        value={profileData.ethnicity}
                      />
                    </div>
                  </div>

                  {/* Physical Measurements */}
                  {(profileData.height ||
                    profileData.weight ||
                    profileData.bmi) && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Physical Measurements
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoField label="Height" value={profileData.height} />
                        <InfoField
                          label="Current Weight"
                          value={profileData.currentWeight}
                        />
                        <InfoField
                          label="Starting Weight"
                          value={profileData.startingWeight}
                        />
                        <InfoField
                          label="Goal Weight"
                          value={profileData.goalWeight}
                        />
                        <InfoField label="BMI" value={profileData.bmi} />
                        <InfoField
                          label="Weight Loss Duration"
                          value={profileData.weightLossDuration}
                        />
                      </div>
                    </div>
                  )}

                  {/* Medical Information */}
                  {(profileData.diabetesStatus ||
                    profileData.allergies ||
                    profileData.medicalConditions) && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Medical Information
                      </h3>
                      <div className="space-y-3">
                        <InfoField
                          label="Diabetes Status"
                          value={profileData.diabetesStatus}
                        />
                        <InfoField
                          label="Allergies"
                          value={
                            Array.isArray(profileData.allergies)
                              ? profileData.allergies.join(", ")
                              : profileData.allergies
                          }
                        />
                        <InfoField
                          label="Other Conditions"
                          value={profileData.otherConditions}
                        />
                        <InfoField
                          label="Medical Conditions"
                          value={
                            Array.isArray(profileData.medicalConditions)
                              ? profileData.medicalConditions.join(", ")
                              : profileData.medicalConditions
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Medications */}
                  {(profileData.medicationHistory ||
                    profileData.currentMedications) && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Medications
                      </h3>
                      <div className="space-y-3">
                        <InfoField
                          label="Medication History"
                          value={
                            Array.isArray(profileData.medicationHistory)
                              ? profileData.medicationHistory
                                  .map((med: any) => med.name || med)
                                  .join(", ")
                              : profileData.medicationHistory
                          }
                        />
                        <InfoField
                          label="Current Medications"
                          value={profileData.currentMedications}
                        />
                      </div>
                    </div>
                  )}

                  {/* Treatment Status */}
                  {profileData.currentTreatmentStatus && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Treatment Status
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoField
                          label="Status"
                          value={profileData.currentTreatmentStatus}
                        />
                        <InfoField
                          label="Feeling Rating"
                          value={profileData.feelingRating}
                        />
                        <InfoField
                          label="Side Effects"
                          value={profileData.sideEffects}
                        />
                        <InfoField
                          label="Taking As Prescribed"
                          value={profileData.takingAsPrescribed}
                        />
                      </div>
                    </div>
                  )}

                  {/* Order History */}
                  {profileData.orderHistory && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">
                        Order History
                      </h3>
                      <InfoField
                        label="Total Orders"
                        value={profileData.totalOrders}
                      />
                      {Array.isArray(profileData.orderHistory) && (
                        <div className="mt-3 space-y-2">
                          {profileData.orderHistory.map(
                            (order: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3 bg-gray-50 rounded border"
                              >
                                <p className="text-sm">
                                  <strong>Order #{order.id || idx + 1}:</strong>{" "}
                                  {order.details || JSON.stringify(order)}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No profile data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
            </CardHeader>
            <CardContent>
              {communications.length > 0 ? (
                <div className="space-y-4">
                  {communications.map((comm) => (
                    <div
                      key={comm._id}
                      className="p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-semibold text-blue-600">
                          {comm.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comm.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comm.summary}</p>
                      {comm.profileFields && comm.profileFields.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {comm.profileFields.map((field: any) => (
                            <span
                              key={field.field}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                            >
                              {getFieldStatusIcon(field.status)} {field.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No conversation history yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper component for displaying field information
function InfoField({ label, value }: { label: string; value: any }) {
  if (!value) return null;

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-base text-gray-900">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
      </p>
    </div>
  );
}

function getFieldStatusIcon(status: string): string {
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
}

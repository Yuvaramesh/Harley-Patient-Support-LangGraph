// components/enhanced-patient-registration.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, FileText } from "lucide-react";

interface EnhancedPatientRegistrationProps {
  onComplete: (patientData: any) => void;
}

export function EnhancedPatientRegistration({
  onComplete,
}: EnhancedPatientRegistrationProps) {
  const [step, setStep] = useState<"basic" | "detailed">("basic");
  const [isLoading, setIsLoading] = useState(false);

  // Basic Information
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");

  // Detailed Profile (Optional)
  const [jsonData, setJsonData] = useState("");
  const [skipDetailed, setSkipDetailed] = useState(false);

  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !contact.trim()) {
      alert("Please fill in all basic information");
      return;
    }

    setStep("detailed");
  };

  const handleDetailedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let detailedProfile = null;

      if (!skipDetailed && jsonData.trim()) {
        try {
          detailedProfile = JSON.parse(jsonData);
        } catch (error) {
          alert("Invalid JSON format. Please check your data.");
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch("/api/patient/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          contact,
          detailedProfile,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create patient profile");
      }

      const data = await response.json();
      onComplete(data.data);
    } catch (error) {
      console.error("Registration error:", error);
      alert("Failed to create patient profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipDetailed = () => {
    setSkipDetailed(true);
    handleDetailedSubmit(new Event("submit") as any);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {step === "basic" ? (
            <>
              <User className="w-5 h-5" />
              Basic Information
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              Detailed Medical Profile (Optional)
            </>
          )}
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          {step === "basic"
            ? "Enter your basic contact information"
            : "Provide comprehensive medical information from your questionnaire data"}
        </p>
      </CardHeader>

      <CardContent>
        {step === "basic" ? (
          <form onSubmit={handleBasicSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <Label htmlFor="contact">Contact Number *</Label>
              <Input
                id="contact"
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="+1234567890"
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Continue to Detailed Profile
            </Button>
          </form>
        ) : (
          <form onSubmit={handleDetailedSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">
                Optional: Import Comprehensive Medical Data
              </h4>
              <p className="text-sm text-blue-800">
                If you have completed a medical questionnaire, you can paste the
                JSON data below. This will include:
              </p>
              <ul className="text-sm text-blue-800 mt-2 ml-4 space-y-1">
                <li>• Age, ethnicity, sex, and physical measurements</li>
                <li>• Weight management history and goals</li>
                <li>• Medical conditions and diabetes status</li>
                <li>• Medication history (Wegovy, Saxenda, Mounjaro)</li>
                <li>• Allergies and current medications</li>
                <li>• Order history and current treatment status</li>
              </ul>
              <p className="text-sm text-blue-800 mt-2">
                You can skip this step and complete your profile later.
              </p>
            </div>

            <div>
              <Label htmlFor="jsonData">
                Questionnaire JSON Data (Optional)
              </Label>
              <textarea
                id="jsonData"
                value={jsonData}
                onChange={(e) => setJsonData(e.target.value)}
                placeholder="Paste your questionnaire JSON data here..."
                className="w-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Expected format: Complete JSON with main_quiz, order_quiz, and
                order_history
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkipDetailed}
                disabled={isLoading}
                className="flex-1"
              >
                Skip for Now
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  "Complete Registration"
                )}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("basic")}
              className="w-full text-sm"
              disabled={isLoading}
            >
              ← Back to Basic Information
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

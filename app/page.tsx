// app/page.tsx (Updated with enhanced registration)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat-interface";
import { CommunicationsDashboard } from "@/components/communications-dashboard";
import { EnhancedPatientRegistration } from "@/components/patient-registration";
import { PatientProfileViewer } from "@/components/patient-profile-viewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Stethoscope } from "lucide-react";

export default function Home() {
  const [patientId, setPatientId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPortalSelection, setShowPortalSelection] = useState(true);
  const router = useRouter();

  const handleRegistrationComplete = (patientData: any) => {
    setEmail(patientData.email);
    setName(patientData.name);
    setContact(patientData.contact);
    setPatientId(patientData.patientId);
    setIsLoggedIn(true);

    console.log("[Patient Portal] Registration completed:", {
      patientId: patientData.patientId,
      hasDetailedProfile: !!patientData.profileData,
    });
  };

  const handleDoctorPortal = () => {
    router.push("/doctor");
  };

  if (showPortalSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Harley Health Portal
            </h1>
            <p className="text-xl text-gray-600">
              Select your portal to continue
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Patient Portal */}
            <div
              onClick={() => setShowPortalSelection(false)}
              className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all cursor-pointer transform hover:scale-105 border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <User className="h-10 w-10 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Patient Portal
                </h2>
                <p className="text-gray-600 mb-6">
                  Access your health records, chat with AI assistant, and manage
                  your healthcare
                </p>
                <div className="w-full">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition">
                    Enter as Patient
                  </button>
                </div>
              </div>
            </div>

            {/* Doctor Portal */}
            <div
              onClick={handleDoctorPortal}
              className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all cursor-pointer transform hover:scale-105 border-2 border-transparent hover:border-green-500"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <Stethoscope className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Doctor Portal
                </h2>
                <p className="text-gray-600 mb-6">
                  Access patient communications, review cases, and manage
                  healthcare delivery
                </p>
                <div className="w-full">
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition">
                    Enter as Doctor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <button
            onClick={() => setShowPortalSelection(true)}
            className="text-sm text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back to portal selection
          </button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome to Harley Health
            </h1>
            <p className="text-gray-600">Your intelligent healthcare portal</p>
          </div>

          <EnhancedPatientRegistration
            onComplete={handleRegistrationComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              setIsLoggedIn(false);
              setShowPortalSelection(true);
            }}
            className="text-sm text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back to portal selection
          </button>
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome, {name || email}
          </h1>
          <p className="text-gray-600 mt-2">
            Your healthcare assistant is ready to help
          </p>
        </div>

        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="chat">Chat Assistant</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="profile">My Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <ChatInterface
              patientId={patientId}
              email={email}
              name={name}
              contact={contact}
            />
          </TabsContent>

          <TabsContent value="communications" className="space-y-4">
            <CommunicationsDashboard patientId={patientId} />
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <PatientProfileViewer email={email} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react";

interface Communication {
  _id: string;
  type: "clinical" | "personal" | "generic_faq" | "emergency";
  question: string;
  answer: string;
  severity?: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
}

interface CommunicationsDashboardProps {
  patientId: string;
}

export function CommunicationsDashboard({
  patientId,
}: CommunicationsDashboardProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchCommunications = async () => {
      try {
        const response = await fetch(
          `/api/communications?patientId=${patientId}`
        );
        const data = await response.json();
        setCommunications(data.communications || []);
      } catch (error) {
        console.error("Failed to fetch communications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunications();
  }, [patientId]);

  const filteredCommunications =
    filter === "all"
      ? communications
      : communications.filter((comm) =>
          filter === "emergency"
            ? comm.type === "emergency"
            : filter === "pending"
            ? comm.status === "pending" || comm.status === "in_progress"
            : comm.type === filter
        );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "emergency":
        return "destructive";
      case "clinical":
        return "default";
      case "generic_faq":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Patient Communications
        </CardTitle>
        <div className="flex gap-2 mt-4">
          {[
            "all",
            "emergency",
            "clinical",
            "generic_faq",
            "personal",
            "pending",
          ].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-center text-gray-500">Loading communications...</p>
        ) : filteredCommunications.length === 0 ? (
          <p className="text-center text-gray-500">No communications found</p>
        ) : (
          <div className="space-y-4">
            {filteredCommunications.map((comm) => (
              <div
                key={comm._id}
                className="border rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(comm.status)}
                    <Badge variant={getTypeColor(comm.type)}>{comm.type}</Badge>
                    {comm.severity && (
                      <Badge
                        variant={
                          comm.severity === "critical"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {comm.severity}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(comm.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {comm.type === "emergency" && (
                  <div className="bg-red-50 border-l-2 border-red-600 p-2 mb-2 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">
                      Emergency assistance requested
                    </p>
                  </div>
                )}

                <p className="font-medium text-sm mb-2">Q: {comm.question}</p>
                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  A: {comm.answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

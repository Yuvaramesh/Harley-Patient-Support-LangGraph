"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, MessageSquare, Calendar } from "lucide-react";

interface Communication {
  _id: string;
  type: "clinical" | "faq" | "personal" | "emergency";
  summary: string;
  severity?: string;
  status: "read" | "unread" | "pending" | "completed";
  createdAt: string;
  timestamp?: string;
  messageCount?: number;
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
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    const fetchCommunications = async () => {
      try {
        const response = await fetch(
          `/api/chat-history/summaries?patientId=${patientId}&userRole=patient&type=${
            typeFilter === "all" ? "all" : typeFilter
          }`
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
  }, [patientId, typeFilter]);

  const filteredCommunications =
    filter === "all"
      ? communications
      : communications.filter((comm) => comm.severity === filter);

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

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "secondary";
      case "medium":
        return "default";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "emergency":
        return "destructive";
      case "clinical":
        return "default";
      case "faq":
        return "outline";
      case "personal":
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
          Conversation Summaries
        </CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Your saved conversation summaries with timestamps
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <div className="flex gap-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            {["all", "clinical", "faq", "personal"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  typeFilter === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label className="text-sm font-medium text-gray-700">
              Severity:
            </label>
            {["all", "low", "medium", "high", "critical"].map((f) => (
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
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-center text-gray-500">Loading summaries...</p>
        ) : filteredCommunications.length === 0 ? (
          <p className="text-center text-gray-500">
            No conversation summaries yet. Complete a chat and create a summary
            to see it here.
          </p>
        ) : (
          <div className="space-y-4">
            {filteredCommunications.map((comm) => (
              <div
                key={comm._id}
                className="border rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(comm.status)}
                    <Badge variant={getTypeColor(comm.type)}>
                      {comm.type.toUpperCase()}
                    </Badge>
                    <Badge variant={getSeverityColor(comm.severity)}>
                      {comm.severity || "medium"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(
                      comm.timestamp || comm.createdAt
                    ).toLocaleString()}
                  </div>
                </div>

                {comm.messageCount && (
                  <p className="text-xs text-gray-500 mb-2">
                    Conversation: {comm.messageCount} messages
                  </p>
                )}

                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    Summary:
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                    {comm.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

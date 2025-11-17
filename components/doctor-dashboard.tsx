// components/doctor-dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Mail, Calendar, AlertCircle } from "lucide-react";

interface Communication {
  _id: string;
  patientId: string;
  type: string;
  question: string;
  answer: string;
  severity?: string;
  status: string;
  createdAt: string;
  emailSent: boolean;
}

interface DoctorDashboardProps {
  doctorEmail: string;
}

export function DoctorDashboard({ doctorEmail }: DoctorDashboardProps) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [filteredComms, setFilteredComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  useEffect(() => {
    fetchCommunications();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [communications, emailFilter, typeFilter, severityFilter]);

  const fetchCommunications = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/doctor/communications");
      const data = await response.json();

      if (data.success) {
        setCommunications(data.communications);
      }
    } catch (error) {
      console.error("Failed to fetch communications:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...communications];

    // Email filter
    if (emailFilter.trim()) {
      filtered = filtered.filter((comm) =>
        comm.patientId
          .toLowerCase()
          .includes(emailFilter.toLowerCase().replace(/[^a-zA-Z0-9]/g, ""))
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((comm) => comm.type === typeFilter);
    }

    // Severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter((comm) => comm.severity === severityFilter);
    }

    setFilteredComms(filtered);
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "emergency":
        return "bg-red-600 text-white";
      case "clinical":
        return "bg-blue-600 text-white";
      case "personal":
        return "bg-purple-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  const uniquePatients = [...new Set(communications.map((c) => c.patientId))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading communications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Communications</p>
              <p className="text-2xl font-bold text-gray-900">
                {communications.length}
              </p>
            </div>
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">
                {uniquePatients.length}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Emergency Cases</p>
              <p className="text-2xl font-bold text-red-600">
                {communications.filter((c) => c.type === "emergency").length}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Filtered Results</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredComms.length}
              </p>
            </div>
            <Filter className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient Email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                placeholder="Search by email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Communication Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="emergency">Emergency</option>
              <option value="clinical">Clinical</option>
              <option value="personal">Personal</option>
              <option value="generic_faq">Generic_FAQ</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {(emailFilter || typeFilter !== "all" || severityFilter !== "all") && (
          <button
            onClick={() => {
              setEmailFilter("");
              setTypeFilter("all");
              setSeverityFilter("all");
            }}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Communications List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Patient Communications ({filteredComms.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {filteredComms.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No communications found matching your filters.
            </div>
          ) : (
            filteredComms.map((comm) => (
              <div key={comm._id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(
                        comm.type
                      )}`}
                    >
                      {comm.type.toUpperCase()}
                    </span>
                    {comm.severity && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(
                          comm.severity
                        )}`}
                      >
                        {comm.severity.toUpperCase()}
                      </span>
                    )}
                    {comm.emailSent && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        ✓ Email Sent
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    {new Date(comm.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Patient ID: {comm.patientId}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Question:
                  </p>
                  <p className="text-sm text-gray-900">{comm.question}</p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Answer:
                  </p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {comm.answer}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span
                    className={`px-2 py-1 rounded ${
                      comm.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : comm.status === "in_progress"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    Status: {comm.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

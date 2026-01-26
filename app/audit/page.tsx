"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditFindings } from "@/components/audit-findings";
import {
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Clock,
  FileText,
  ArrowLeft,
  Filter,
  Download,
  Info,
} from "lucide-react";
import Link from "next/link";

interface AuditItem {
  id: string;
  name: string;
  regulationCode: string;
  status: "compliant" | "non-compliant" | "partial" | "pending";
  completeness: number;
  lastReviewed?: string;
  criticalIssues: number;
  description: string;
}

interface AuditMetrics {
  totalAudits: number;
  compliantCount: number;
  complianceScore: number;
  patientsSeen: number;
  averageScore: number;
  criticalIssues: number;
}

export default function AuditPage() {
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [metrics, setMetrics] = useState<AuditMetrics>({
    totalAudits: 0,
    compliantCount: 0,
    complianceScore: 0,
    patientsSeen: 0,
    averageScore: 0,
    criticalIssues: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedAudits, setSelectedAudits] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState("all");
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditResults, setAuditResults] = useState<{
    timestamp: string;
    findings: {
      auditItem: string;
      finding: string;
      severity: string;
      affectedRecords: number;
    }[];
    recommendations: string[];
    summary: {
      totalPatientRecords: number;
      recordsAnalyzed: number;
      complianceScore: number;
      criticalFindings: number;
      recommendations: number;
    };
  } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/audit/data");
      if (response.ok) {
        const data = await response.json();
        setAuditItems(data.audits);
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Failed to fetch audit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAudit = (id: string) => {
    const newSelected = new Set(selectedAudits);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAudits(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAudits.size === auditItems.length) {
      setSelectedAudits(new Set());
    } else {
      setSelectedAudits(new Set(auditItems.map((item) => item.id)));
    }
  };

  const handleRunAudit = async () => {
    if (selectedAudits.size === 0) {
      alert("Please select at least one audit item");
      return;
    }

    try {
      setRunningAudit(true);
      const response = await fetch("/api/audit/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAudits: Array.from(selectedAudits),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("[v0] Audit results received:", result.results);
        setAuditResults(result.results);
        fetchAuditData();
      }
    } catch (error) {
      console.error("Failed to run audit:", error);
      alert("Failed to run audit");
    } finally {
      setRunningAudit(false);
    }
  };

  const handleExportReport = async () => {
    if (!auditResults) {
      alert("No audit results to export");
      return;
    }

    try {
      setExportLoading(true);
      const response = await fetch("/api/audit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditResults,
          metrics,
          selectedAudits: Array.from(selectedAudits),
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-report-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export report:", error);
      alert("Failed to export report");
    } finally {
      setExportLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "compliant":
        return "bg-green-100 text-green-800 border-green-300";
      case "non-compliant":
        return "bg-red-100 text-red-800 border-red-300";
      case "partial":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "pending":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "compliant":
        return <CheckCircle2 className="w-4 h-4" />;
      case "non-compliant":
        return <AlertCircle className="w-4 h-4" />;
      case "partial":
        return <AlertCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const filteredAudits =
    filterStatus === "all"
      ? auditItems
      : auditItems.filter((item) => item.status === filterStatus);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading audit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/doctor"
            className="flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Patient Support Audit
              </h1>
              <p className="text-gray-600 mt-2">
                Comprehensive compliance assessment across all patient support
                areas
              </p>
            </div>
            <button
              onClick={handleExportReport}
              disabled={!auditResults || exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition"
            >
              <Download className="w-4 h-4" />
              {exportLoading ? "Exporting..." : "Export Report"}
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-teal-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Compliance Score</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.complianceScore}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-teal-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Compliant Items</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.compliantCount}/{metrics.totalAudits}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Critical Issues</p>
                <p className="text-3xl font-bold text-red-600">
                  {metrics.criticalIssues}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Patients Audited</p>
                <p className="text-3xl font-bold text-gray-900">
                  {metrics.patientsSeen}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="select" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="select">Select Audit Items</TabsTrigger>
            <TabsTrigger value="results">Recent Audit Results</TabsTrigger>
          </TabsList>

          {/* Select Audits Tab */}
          <TabsContent value="select" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Choose Audit Items to Assess
              </h3>

              {/* Filter and Actions */}
              <div className="mb-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selectedAudits.size === auditItems.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-teal-600 rounded cursor-pointer"
                    />
                    <label
                      htmlFor="select-all"
                      className="text-sm font-medium text-gray-700 cursor-pointer"
                    >
                      Select All ({filteredAudits.length})
                    </label>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-600 outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="compliant">Compliant</option>
                      <option value="partial">Partial</option>
                      <option value="non-compliant">Non-Compliant</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Audit Items List */}
              <div className="space-y-3 mb-6">
                {filteredAudits.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        id={item.id}
                        checked={selectedAudits.has(item.id)}
                        onChange={() => handleToggleAudit(item.id)}
                        className="w-4 h-4 text-teal-600 rounded cursor-pointer mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {item.name}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {item.regulationCode}
                            </p>
                          </div>
                          <span
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getStatusColor(
                              item.status,
                            )}`}
                          >
                            {getStatusIcon(item.status)}
                            {item.status.toUpperCase()}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-3">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Completeness: {item.completeness}%</span>
                          {item.criticalIssues > 0 && (
                            <span className="flex items-center gap-1 text-red-600 font-medium">
                              <AlertCircle className="w-3 h-3" />
                              {item.criticalIssues} critical issue
                              {item.criticalIssues > 1 ? "s" : ""}
                            </span>
                          )}
                          {item.lastReviewed && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Last reviewed: {item.lastReviewed}
                            </span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              item.completeness === 100
                                ? "bg-green-600"
                                : item.completeness >= 75
                                  ? "bg-blue-600"
                                  : item.completeness >= 50
                                    ? "bg-yellow-600"
                                    : "bg-red-600"
                            }`}
                            style={{ width: `${item.completeness}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Run Audit Button */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {selectedAudits.size > 0
                    ? `${selectedAudits.size} item${selectedAudits.size > 1 ? "s" : ""} selected`
                    : "No items selected"}
                </p>
                <button
                  onClick={handleRunAudit}
                  disabled={selectedAudits.size === 0 || runningAudit}
                  className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium"
                >
                  {runningAudit ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Running Audit...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Run Selected Audits
                    </>
                  )}
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            {auditResults && (
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <Info className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Latest Audit Results
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                      Audit completed on{" "}
                      {new Date(auditResults.timestamp).toLocaleDateString()}{" "}
                      with {auditResults.findings.length} findings and{" "}
                      {auditResults.recommendations.length} recommendations
                    </p>
                  </div>
                </div>
              </div>
            )}

            <AuditFindings
              findings={auditResults?.findings || []}
              recommendations={auditResults?.recommendations || []}
            />

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-600" />
                Audit History
              </h3>

              <div className="space-y-3">
                {auditItems
                  .filter((item) => item.status !== "pending")
                  .map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {item.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {item.regulationCode}
                          </p>
                        </div>
                        <span
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getStatusColor(
                            item.status,
                          )}`}
                        >
                          {getStatusIcon(item.status)}
                          {item.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Compliance:</span>
                          <span className="font-medium text-gray-900">
                            {item.completeness}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              item.completeness === 100
                                ? "bg-green-600"
                                : item.completeness >= 75
                                  ? "bg-blue-600"
                                  : item.completeness >= 50
                                    ? "bg-yellow-600"
                                    : "bg-red-600"
                            }`}
                            style={{ width: `${item.completeness}%` }}
                          ></div>
                        </div>
                      </div>

                      {item.criticalIssues > 0 && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded p-3">
                          <p className="text-sm text-red-800 font-medium">
                            {item.criticalIssues} critical issue
                            {item.criticalIssues > 1 ? "s" : ""} requiring
                            attention
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

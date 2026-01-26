"use client";

import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
} from "lucide-react";

interface Finding {
  auditItem: string;
  finding: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedRecords: number;
}

interface AuditFindingsProps {
  findings: Finding[];
  recommendations: string[];
}

export function AuditFindings({
  findings,
  recommendations,
}: AuditFindingsProps) {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "high":
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case "medium":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "low":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-50 border-red-200";
      case "high":
        return "bg-orange-50 border-orange-200";
      case "medium":
        return "bg-yellow-50 border-yellow-200";
      case "low":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Critical Findings */}
      {findings.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Audit Findings ({findings.length})
            </h3>
          </div>

          <div className="divide-y divide-gray-200">
            {findings.map((finding, index) => (
              <div
                key={index}
                className={`p-6 border-l-4 border-transparent ${getSeverityColor(
                  finding.severity,
                )}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(finding.severity)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm text-gray-600 font-medium mb-1">
                          {finding.auditItem.replace(/-/g, " ").toUpperCase()}
                        </p>
                        <p className="text-gray-900 font-medium">
                          {finding.finding}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ml-4 ${getSeverityBadgeColor(
                          finding.severity,
                        )}`}
                      >
                        {finding.severity.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-2">
                      Affected records:{" "}
                      <strong>{finding.affectedRecords}</strong>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-blue-600" />
              Recommendations ({recommendations.length})
            </h3>
          </div>

          <div className="p-6 space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold mt-0.5">
                  {index + 1}
                </div>
                <p className="text-gray-700 text-sm pt-0.5">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

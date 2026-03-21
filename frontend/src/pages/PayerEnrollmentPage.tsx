import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Enrollment {
  id: string;
  clinician_name: string;
  clinician_npi: string;
  payer_id: string;
  payer_name: string;
  status: "pending" | "submitted" | "active" | "rejected" | "inactive";
  submitted_at: string | null;
  updated_at: string;
}

interface EnrollmentsResponse {
  enrollments: Enrollment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Pending" },
  submitted: { bg: "bg-blue-50", text: "text-blue-700", label: "Submitted" },
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
  rejected: { bg: "bg-red-50", text: "text-red-700", label: "Rejected" },
  inactive: { bg: "bg-gray-100", text: "text-gray-600", label: "Inactive" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PayerEnrollmentPage() {
  const api = useApi();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Form state
  const [clinicianName, setClinicianName] = useState("");
  const [clinicianNpi, setClinicianNpi] = useState("");
  const [payerId, setPayerId] = useState("");
  const [payerName, setPayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadEnrollments = useCallback(async () => {
    try {
      const data = await api.get<EnrollmentsResponse>("/api/billing/enrollments");
      setEnrollments(data.enrollments || []);
    } catch (err) {
      console.error("Failed to load enrollments:", err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  async function handleSubmit() {
    if (!clinicianName.trim() || !clinicianNpi.trim() || !payerId.trim() || !payerName.trim()) {
      setFormError("All fields are required.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await api.post("/api/billing/enrollments", {
        clinician_name: clinicianName.trim(),
        clinician_npi: clinicianNpi.trim(),
        payer_id: payerId.trim(),
        payer_name: payerName.trim(),
      });
      // Reset form and close modal
      setClinicianName("");
      setClinicianNpi("");
      setPayerId("");
      setPayerName("");
      setShowModal(false);
      await loadEnrollments();
    } catch (err: any) {
      setFormError(err.message || "Failed to submit enrollment request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh(enrollmentId: string) {
    setRefreshingId(enrollmentId);
    try {
      const updated = await api.get<Enrollment>(
        `/api/billing/enrollments/${enrollmentId}`,
      );
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? updated : e)),
      );
    } catch (err) {
      console.error("Failed to refresh enrollment:", err);
    } finally {
      setRefreshingId(null);
    }
  }

  if (loading) {
    return (
      <div className="px-8 py-8 max-w-5xl">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-warm-800">
              Payer Enrollment
            </h1>
            <p className="text-sm text-warm-500 mt-1">
              Manage clearinghouse enrollment for electronic claim submission.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Request Enrollment
          </button>
        </div>

        {/* Settings sub-nav */}
        <div className="flex gap-4 mt-4 border-b border-warm-100 pb-px">
          <Link
            to="/settings/practice"
            className="text-sm font-medium text-warm-400 hover:text-warm-600 pb-2 px-1 transition-colors"
          >
            Profile
          </Link>
          <Link
            to="/settings/credentialing"
            className="text-sm font-medium text-warm-400 hover:text-warm-600 pb-2 px-1 transition-colors"
          >
            Credentialing
          </Link>
          <span className="text-sm font-medium text-teal-700 border-b-2 border-teal-600 pb-2 px-1">
            Payer Enrollment
          </span>
          <Link
            to="/settings/audit-log"
            className="text-sm font-medium text-warm-400 hover:text-warm-600 pb-2 px-1 transition-colors"
          >
            Audit Log
          </Link>
        </div>
      </div>

      {/* Enrollments Table */}
      <div className="bg-white rounded-2xl border border-warm-100 shadow-sm">
        {enrollments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-semibold text-warm-400 uppercase tracking-wide border-b border-warm-100">
                  <th className="px-6 py-3 text-left">Payer</th>
                  <th className="px-6 py-3 text-left">Clinician</th>
                  <th className="px-6 py-3 text-left">NPI</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-left">Submitted</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {enrollments.map((enrollment) => {
                  const statusStyle = STATUS_STYLES[enrollment.status] || { bg: "bg-gray-100", text: "text-gray-600", label: enrollment.status };
                  return (
                    <tr key={enrollment.id} className="hover:bg-warm-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-warm-700">
                          {enrollment.payer_name}
                        </p>
                        <p className="text-xs text-warm-400 font-mono">
                          ID: {enrollment.payer_id}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-warm-700">
                        {enrollment.clinician_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-warm-600 font-mono">
                        {enrollment.clinician_npi}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-warm-500">
                        {formatDate(enrollment.submitted_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRefresh(enrollment.id)}
                          disabled={refreshingId === enrollment.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-warm-200 text-warm-600 hover:bg-warm-50 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {refreshingId === enrollment.id ? (
                            <span className="w-3 h-3 block border-2 border-warm-200 border-t-warm-600 rounded-full animate-spin" />
                          ) : (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path
                                fillRule="evenodd"
                                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.342a7 7 0 0011.712-3.138.75.75 0 00-1.06-.21zm-1.414-7.837a.75.75 0 00-1.06.21A5.5 5.5 0 014.688 8.576l.312.311H2.567a.75.75 0 000 1.5H6.2a.75.75 0 00.75-.75V5.004a.75.75 0 00-1.5 0v2.033l-.312-.342A7 7 0 0016.85 9.833a.75.75 0 00-1.06.21l.107-6.456z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          Refresh Status
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-warm-50 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-warm-300">
                <path
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-warm-500 text-sm">
              No payer enrollments yet. Request an enrollment to start submitting claims electronically.
            </p>
          </div>
        )}
      </div>

      {/* Request Enrollment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="font-display text-lg font-bold text-warm-800 mb-1">
              Request Payer Enrollment
            </h3>
            <p className="text-sm text-warm-500 mb-6">
              Submit a clearinghouse enrollment request for a specific payer.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  Clinician Name
                </label>
                <input
                  type="text"
                  value={clinicianName}
                  onChange={(e) => setClinicianName(e.target.value)}
                  placeholder="e.g. Jane Smith, LCSW"
                  className="w-full px-4 py-2.5 rounded-xl border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  Clinician NPI
                </label>
                <input
                  type="text"
                  value={clinicianNpi}
                  onChange={(e) => setClinicianNpi(e.target.value)}
                  placeholder="10-digit NPI number"
                  maxLength={10}
                  className="w-full px-4 py-2.5 rounded-xl border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  Payer ID
                </label>
                <input
                  type="text"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  placeholder="e.g. 12345"
                  className="w-full px-4 py-2.5 rounded-xl border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  Payer Name
                </label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="e.g. Blue Cross Blue Shield"
                  className="w-full px-4 py-2.5 rounded-xl border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-3 text-sm text-red-600">{formError}</p>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-warm-100">
              <button
                onClick={() => {
                  setShowModal(false);
                  setFormError("");
                }}
                className="px-4 py-2 text-sm font-medium text-warm-600 hover:text-warm-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && (
                  <span className="w-3.5 h-3.5 block border-2 border-teal-200 border-t-white rounded-full animate-spin" />
                )}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

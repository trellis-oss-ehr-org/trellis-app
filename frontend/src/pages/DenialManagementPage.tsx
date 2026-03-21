import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import DenialCard, { Denial } from "../components/billing/DenialCard";
import AppealDraftModal from "../components/billing/AppealDraftModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DenialsResponse {
  denials: Denial[];
  count: number;
  total: number;
  summary?: {
    total_denials: number;
    appealable: number;
    in_progress_appeals: number;
    won_appeals: number;
    total_denied_amount: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "eligibility", label: "Eligibility" },
  { value: "coding", label: "Coding" },
  { value: "authorization", label: "Authorization" },
  { value: "timely_filing", label: "Timely Filing" },
  { value: "duplicate", label: "Duplicate" },
  { value: "medical_necessity", label: "Medical Necessity" },
  { value: "contractual", label: "Contractual" },
  { value: "other", label: "Other" },
];

const APPEAL_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "none", label: "No Appeal" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready to Submit" },
  { value: "submitted", label: "Submitted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  color = "text-warm-700",
  subtitle,
}: {
  label: string;
  value: string;
  color?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-medium text-warm-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="text-xs text-warm-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DenialManagementPage() {
  const api = useApi();
  const [denials, setDenials] = useState<Denial[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<DenialsResponse["summary"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState("all");
  const [appealStatus, setAppealStatus] = useState("all");
  const [offset, setOffset] = useState(0);

  // Modal
  const [appealModalDenialId, setAppealModalDenialId] = useState<string | null>(null);

  const loadDenials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (appealStatus !== "all") params.set("appeal_status", appealStatus);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      const qs = params.toString() ? `?${params.toString()}` : "";

      const data = await api.get<DenialsResponse>(`/api/billing/denials${qs}`);
      setDenials(data.denials || []);
      setTotal(data.total ?? data.count ?? 0);
      if (data.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error("Failed to load denials:", err);
      setError(err.message || "Failed to load denials");
    } finally {
      setLoading(false);
    }
  }, [api, category, appealStatus, offset]);

  useEffect(() => {
    loadDenials();
  }, [loadDenials]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [category, appealStatus]);

  function handleGenerateAppeal(denialId: string) {
    setAppealModalDenialId(denialId);
  }

  function handleViewAppeal(denialId: string) {
    setAppealModalDenialId(denialId);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Link
            to="/billing"
            className="text-warm-400 hover:text-warm-600 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-warm-800">Denial Management</h1>
        </div>
        <p className="text-sm text-warm-500">
          Track denied claims, generate AI appeal letters, and manage the appeal workflow.
        </p>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Denials"
            value={String(summary.total_denials)}
            color="text-red-600"
          />
          <StatCard
            label="Appealable"
            value={String(summary.appealable)}
            color="text-amber-600"
          />
          <StatCard
            label="Appeals In Progress"
            value={String(summary.in_progress_appeals)}
            color="text-blue-600"
          />
          <StatCard
            label="Appeals Won"
            value={String(summary.won_appeals)}
            color="text-green-600"
            subtitle={
              summary.total_denied_amount
                ? `$${summary.total_denied_amount.toFixed(2)} denied`
                : undefined
            }
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-warm-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={appealStatus}
          onChange={(e) => setAppealStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-warm-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
        >
          {APPEAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <span className="text-sm text-warm-400">
          {total} denial{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : denials.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-12 h-12 mx-auto mb-4 text-warm-300"
          >
            <path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-warm-500 text-sm">No denials found matching your filters.</p>
          {(category !== "all" || appealStatus !== "all") && (
            <button
              onClick={() => {
                setCategory("all");
                setAppealStatus("all");
              }}
              className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        /* Denial cards */
        <div className="space-y-3">
          {denials.map((denial) => (
            <DenialCard
              key={denial.id}
              denial={denial}
              onGenerateAppeal={handleGenerateAppeal}
              onViewAppeal={handleViewAppeal}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-warm-200 text-warm-600 hover:bg-warm-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-warm-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={currentPage >= totalPages}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-warm-200 text-warm-600 hover:bg-warm-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Appeal Modal */}
      {appealModalDenialId && (
        <AppealDraftModal
          denialId={appealModalDenialId}
          isOpen={true}
          onClose={() => setAppealModalDenialId(null)}
          onUpdate={loadDenials}
        />
      )}
    </div>
  );
}

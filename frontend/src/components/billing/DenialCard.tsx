import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Denial {
  id: string;
  superbill_id: string;
  denial_code: string;
  denial_reason: string;
  category: string;
  denied_amount: number | null;
  appeal_status: string;
  appeal_letter: string | null;
  is_appealable: boolean;
  date_denied: string | null;
  date_appeal_submitted: string | null;
  client_name: string | null;
  cpt_code: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  eligibility: "bg-blue-50 text-blue-700 border-blue-200",
  coding: "bg-purple-50 text-purple-700 border-purple-200",
  authorization: "bg-amber-50 text-amber-700 border-amber-200",
  timely_filing: "bg-red-50 text-red-700 border-red-200",
  duplicate: "bg-gray-50 text-gray-600 border-gray-200",
  medical_necessity: "bg-orange-50 text-orange-700 border-orange-200",
  contractual: "bg-slate-50 text-slate-700 border-slate-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  eligibility: "Eligibility",
  coding: "Coding",
  authorization: "Authorization",
  timely_filing: "Timely Filing",
  duplicate: "Duplicate",
  medical_necessity: "Medical Necessity",
  contractual: "Contractual",
  other: "Other",
};

const APPEAL_STYLES: Record<string, string> = {
  none: "bg-gray-50 text-gray-600 border-gray-200",
  draft: "bg-yellow-50 text-yellow-700 border-yellow-200",
  ready: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-teal-50 text-teal-700 border-teal-200",
  won: "bg-green-50 text-green-700 border-green-200",
  lost: "bg-red-50 text-red-700 border-red-200",
};

const APPEAL_LABELS: Record<string, string> = {
  none: "No Appeal",
  draft: "Draft",
  ready: "Ready to Submit",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "\u2014";
  return `$${amount.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DenialCardProps {
  denial: Denial;
  onGenerateAppeal: (id: string) => void;
  onViewAppeal: (id: string) => void;
}

export default function DenialCard({ denial, onGenerateAppeal, onViewAppeal }: DenialCardProps) {
  const categoryStyle = CATEGORY_STYLES[denial.category] || CATEGORY_STYLES.other;
  const categoryLabel = CATEGORY_LABELS[denial.category] || denial.category;
  const appealStyle = APPEAL_STYLES[denial.appeal_status] || APPEAL_STYLES.none;
  const appealLabel = APPEAL_LABELS[denial.appeal_status] || denial.appeal_status;

  const hasAppeal = denial.appeal_status !== "none" && denial.appeal_letter;
  const canGenerateAppeal = denial.is_appealable && !hasAppeal && denial.appeal_status === "none";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Left: details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {denial.denial_code && (
              <span className="font-mono text-sm font-semibold text-warm-700 bg-warm-50 px-2 py-0.5 rounded">
                {denial.denial_code}
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${categoryStyle}`}>
              {categoryLabel}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${appealStyle}`}>
              {appealLabel}
            </span>
          </div>

          <p className="text-sm text-warm-700 mb-1.5 line-clamp-2">
            {denial.denial_reason || "No reason provided"}
          </p>

          <div className="flex items-center gap-4 text-xs text-warm-400">
            {denial.client_name && <span>{denial.client_name}</span>}
            {denial.cpt_code && <span className="font-mono">{denial.cpt_code}</span>}
            <span>{formatDate(denial.date_denied || denial.created_at)}</span>
          </div>
        </div>

        {/* Right: amount + actions */}
        <div className="shrink-0 text-right flex flex-col items-end gap-2">
          <p className="text-lg font-semibold text-red-600">
            {formatCurrency(denial.denied_amount)}
          </p>

          <div className="flex items-center gap-2">
            {canGenerateAppeal && (
              <button
                onClick={() => onGenerateAppeal(denial.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
              >
                Generate Appeal
              </button>
            )}
            {hasAppeal && (
              <button
                onClick={() => onViewAppeal(denial.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors"
              >
                View Appeal
              </button>
            )}
            {denial.superbill_id && (
              <Link
                to={`/billing/claims/${denial.superbill_id}/review`}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-warm-200 text-warm-700 hover:bg-warm-50 transition-colors"
              >
                View Claim
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

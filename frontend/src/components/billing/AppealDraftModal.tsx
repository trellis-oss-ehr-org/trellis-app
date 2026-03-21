import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DenialDetail {
  id: string;
  denial_code: string;
  denial_reason: string;
  category: string;
  denied_amount: number | null;
  appeal_status: string;
  appeal_letter: string | null;
  is_appealable: boolean;
  client_name: string | null;
  cpt_code: string | null;
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

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

const STATUS_FLOW: { label: string; status: string; style: string; show: (s: string) => boolean }[] = [
  {
    label: "Save Draft",
    status: "draft",
    style: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-300",
    show: (s) => s === "none" || s === "draft",
  },
  {
    label: "Mark Ready",
    status: "ready",
    style: "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-300",
    show: (s) => s === "draft" || s === "ready",
  },
  {
    label: "Mark Submitted",
    status: "submitted",
    style: "bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-300",
    show: (s) => s === "ready" || s === "submitted",
  },
  {
    label: "Won",
    status: "won",
    style: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300",
    show: (s) => s === "submitted",
  },
  {
    label: "Lost",
    status: "lost",
    style: "bg-red-100 text-red-800 hover:bg-red-200 border border-red-300",
    show: (s) => s === "submitted",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AppealDraftModalProps {
  denialId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AppealDraftModal({ denialId, isOpen, onClose, onUpdate }: AppealDraftModalProps) {
  const api = useApi();
  const [denial, setDenial] = useState<DenialDetail | null>(null);
  const [letterText, setLetterText] = useState("");
  const [appealStatus, setAppealStatus] = useState("none");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDenial = useCallback(async () => {
    if (!denialId || !isOpen) return;
    setError(null);
    try {
      // The list_denials endpoint returns full denial objects.
      // We can re-fetch from the PATCH or generate-appeal responses too.
      // For now, if we already have the denial loaded from the page, we
      // mostly need the appeal letter. Try to generate if none exists.
      const result = await api.get<any>(`/api/billing/denials?limit=200`);
      const denials: DenialDetail[] = result.denials || result.items || [];
      const found = denials.find((d: any) => d.id === denialId);
      if (found) {
        setDenial(found);
        setLetterText(found.appeal_letter || "");
        setAppealStatus(found.appeal_status || "none");
        // Auto-generate if no appeal letter yet
        if (!found.appeal_letter && found.is_appealable && found.appeal_status === "none") {
          await handleGenerate();
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load denial details");
    }
  }, [denialId, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      loadDenial();
    }
    return () => {
      setDenial(null);
      setLetterText("");
      setAppealStatus("none");
      setError(null);
      setSuccessMsg(null);
    };
  }, [isOpen, loadDenial]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.post<any>(`/api/billing/denials/${denialId}/generate-appeal`, {});
      setLetterText(result.appeal_letter || result.letter || "");
      setAppealStatus(result.appeal_status || "draft");
      if (result.appeal_letter || result.letter) {
        setDenial((prev) =>
          prev
            ? { ...prev, appeal_letter: result.appeal_letter || result.letter, appeal_status: result.appeal_status || "draft" }
            : prev
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate appeal letter");
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusUpdate(newStatus: string) {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const body: Record<string, any> = { appeal_status: newStatus };
      if (newStatus === "draft" || newStatus === "ready") {
        body.appeal_letter = letterText;
      }
      await api.patch<any>(`/api/billing/denials/${denialId}`, body);
      setAppealStatus(newStatus);
      setDenial((prev) => (prev ? { ...prev, appeal_status: newStatus, appeal_letter: letterText } : prev));
      setSuccessMsg(`Status updated to "${newStatus}"`);
      onUpdate();
      // Auto-close on terminal statuses
      if (newStatus === "won" || newStatus === "lost") {
        setTimeout(() => onClose(), 1200);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update denial");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-100">
          <div>
            <h2 className="text-lg font-semibold text-warm-800">Appeal Letter</h2>
            {denial && (
              <p className="text-sm text-warm-500 mt-0.5">
                {denial.denial_code && <span className="font-mono font-medium mr-2">{denial.denial_code}</span>}
                {CATEGORY_LABELS[denial.category] || denial.category}
                {denial.denied_amount !== null && (
                  <span className="ml-2 text-red-600 font-medium">${denial.denied_amount.toFixed(2)}</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-warm-400 hover:text-warm-600 transition-colors rounded-lg hover:bg-warm-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Denial info summary */}
        {denial && (
          <div className="px-6 py-3 bg-warm-50 border-b border-warm-100">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-warm-400 text-xs">Reason</span>
                <p className="text-warm-700">{denial.denial_reason || "Not specified"}</p>
              </div>
              {denial.client_name && (
                <div>
                  <span className="text-warm-400 text-xs">Client</span>
                  <p className="text-warm-700">{denial.client_name}</p>
                </div>
              )}
              {denial.cpt_code && (
                <div>
                  <span className="text-warm-400 text-xs">CPT</span>
                  <p className="text-warm-700 font-mono">{denial.cpt_code}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {error && (
            <div className="mb-4 px-4 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 px-4 py-2 rounded-lg text-sm bg-teal-50 text-teal-700 border border-teal-200">
              {successMsg}
            </div>
          )}

          {generating ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4" />
              <p className="text-sm text-warm-500">Generating appeal letter with AI...</p>
              <p className="text-xs text-warm-400 mt-1">This may take a moment</p>
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-warm-600 mb-2">
                Appeal Letter
              </label>
              <textarea
                value={letterText}
                onChange={(e) => setLetterText(e.target.value)}
                rows={16}
                placeholder="Appeal letter content will appear here after generation..."
                className="w-full px-4 py-3 text-sm border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-y font-mono leading-relaxed"
              />
              {!letterText && denial?.is_appealable && (
                <button
                  onClick={handleGenerate}
                  className="mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  Generate Appeal with AI
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer — status workflow buttons */}
        <div className="px-6 py-4 border-t border-warm-100 bg-warm-50">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-warm-600 hover:text-warm-800 transition-colors"
            >
              Close
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FLOW.filter((sf) => sf.show(appealStatus)).map((sf) => (
                <button
                  key={sf.status}
                  onClick={() => handleStatusUpdate(sf.status)}
                  disabled={saving || generating}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${sf.style}`}
                >
                  {saving ? "Saving..." : sf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

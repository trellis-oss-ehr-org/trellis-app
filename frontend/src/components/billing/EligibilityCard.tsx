import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EligibilityResult {
  status: "active" | "inactive" | "unknown";
  plan_name: string | null;
  copay: number | null;
  coinsurance_pct: number | null;
  deductible_total: number | null;
  deductible_remaining: number | null;
  oop_max_total: number | null;
  oop_max_remaining: number | null;
  checked_at: string | null;
  payer_name: string | null;
  member_id: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return `$${amount.toFixed(2)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EligibilityCardProps {
  clientId: string;
}

export default function EligibilityCard({ clientId }: EligibilityCardProps) {
  const api = useApi();
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<EligibilityResult>(`/api/billing/eligibility/${clientId}`)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        // No cached eligibility data — normal for new clients
        if (!cancelled) setResult(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, clientId]);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    try {
      const data = await api.post<EligibilityResult>(
        `/api/billing/eligibility/${clientId}`,
        {},
      );
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Eligibility check failed");
    } finally {
      setChecking(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-warm-100 shadow-sm p-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <span className="text-sm text-warm-400">Loading eligibility...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-warm-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-teal-600">
            <path
              fillRule="evenodd"
              d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.75zm4.196 5.954a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-sm font-semibold text-warm-700">Eligibility</h3>
          {result && (
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                result.status === "active"
                  ? "bg-green-50 text-green-700"
                  : result.status === "inactive"
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {result.status === "active"
                ? "Active"
                : result.status === "inactive"
                ? "Inactive"
                : "Unknown"}
            </span>
          )}
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {checking ? (
            <span className="w-3 h-3 block border-2 border-teal-200 border-t-white rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path
                fillRule="evenodd"
                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.342a7 7 0 0011.712-3.138.75.75 0 00-1.06-.21zm-1.414-7.837a.75.75 0 00-1.06.21 5.5 5.5 0 019.201-2.466l.312.311H10.233a.75.75 0 000 1.5h3.634a.75.75 0 00.75-.75V-1.24a.75.75 0 00-1.5 0v2.033l-.312-.342a7 7 0 00-11.712 3.138.75.75 0 001.06.21z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {checking ? "Checking..." : "Check Eligibility"}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {result ? (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {result.plan_name && (
              <div className="col-span-2 md:col-span-3">
                <p className="text-xs text-warm-400">Plan</p>
                <p className="text-sm font-medium text-warm-700">{result.plan_name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-warm-400">Copay</p>
              <p className="text-sm font-medium text-warm-700">
                {formatCurrency(result.copay)}
              </p>
            </div>
            <div>
              <p className="text-xs text-warm-400">Coinsurance</p>
              <p className="text-sm font-medium text-warm-700">
                {result.coinsurance_pct !== null ? `${result.coinsurance_pct}%` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-warm-400">Deductible</p>
              <p className="text-sm font-medium text-warm-700">
                {result.deductible_remaining !== null && result.deductible_total !== null
                  ? `${formatCurrency(result.deductible_remaining)} / ${formatCurrency(result.deductible_total)}`
                  : formatCurrency(result.deductible_total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-warm-400">OOP Max</p>
              <p className="text-sm font-medium text-warm-700">
                {result.oop_max_remaining !== null && result.oop_max_total !== null
                  ? `${formatCurrency(result.oop_max_remaining)} / ${formatCurrency(result.oop_max_total)}`
                  : formatCurrency(result.oop_max_total)}
              </p>
            </div>
          </div>
          {result.checked_at && (
            <p className="text-xs text-warm-300 mt-2">
              Last checked: {formatDate(result.checked_at)}
            </p>
          )}
        </div>
      ) : !error ? (
        <div className="px-4 py-4 text-center">
          <p className="text-xs text-warm-400">
            No eligibility data yet. Click "Check Eligibility" to verify coverage.
          </p>
        </div>
      ) : null}
    </div>
  );
}

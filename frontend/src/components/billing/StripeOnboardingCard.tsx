import { useState, useEffect, useCallback } from "react";
import { useApi } from "../../hooks/useApi";

interface StripeStatus {
  configured: boolean;
  charges_enabled: boolean;
}

export default function StripeOnboardingCard() {
  const api = useApi();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<StripeStatus>("/api/billing/stripe/status");
      setStatus(data);
    } catch {
      setStatus({ configured: false, charges_enabled: false });
    }
  }, [api]);

  useEffect(() => {
    async function load() {
      await fetchStatus();
      setLoading(false);
    }
    load();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-warm-200 border-t-warm-500 rounded-full animate-spin" />
          <span className="text-sm text-warm-400">Checking payment setup...</span>
        </div>
      </div>
    );
  }

  const isReady = status?.configured && status.charges_enabled;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-semibold text-warm-800">Payment Processing</h2>
        {isReady && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            Active
          </span>
        )}
      </div>
      <p className="text-warm-400 text-xs mb-4">
        Accept client copays and self-pay fees through Stripe.
      </p>

      {isReady ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            <span className="text-sm text-warm-600">Stripe is configured and accepting payments</span>
          </div>
          <p className="text-xs text-warm-400">
            You can send payment links to clients from the billing page. Payments go directly to your Stripe account.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-warm-500">
            To accept client payments, add your Stripe secret key and webhook secret to your
            trellis-services <code className="text-xs bg-warm-100 px-1.5 py-0.5 rounded">.env</code> file:
          </p>
          <div className="bg-warm-50 rounded-lg p-3 text-xs font-mono text-warm-600 space-y-1">
            <div>STRIPE_SECRET_KEY=sk_live_...</div>
            <div>STRIPE_WEBHOOK_SECRET=whsec_...</div>
          </div>
          <p className="text-xs text-warm-400">
            Create a free Stripe account at{" "}
            <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline hover:text-teal-700">
              stripe.com
            </a>
            , then copy your API keys from the Developers section.
          </p>
        </div>
      )}
    </div>
  );
}

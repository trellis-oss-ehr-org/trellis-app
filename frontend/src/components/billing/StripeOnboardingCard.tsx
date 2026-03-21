import { useState, useEffect, useRef, useCallback } from "react";
import { useApi } from "../../hooks/useApi";

interface StripeStatus {
  account_id: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
}

export default function StripeOnboardingCard() {
  const api = useApi();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<StripeStatus>("/api/billing/stripe/status");
      setStatus(data);
      return data;
    } catch {
      // No Stripe account yet — that's fine
      setStatus({ account_id: null, charges_enabled: false, payouts_enabled: false, onboarding_complete: false });
      return null;
    }
  }, [api]);

  useEffect(() => {
    async function load() {
      await fetchStatus();
      setLoading(false);
    }
    load();
  }, [fetchStatus]);

  // Poll when onboarding is in progress (account exists but not complete)
  useEffect(() => {
    if (status?.account_id && !status.onboarding_complete) {
      pollRef.current = setInterval(async () => {
        const data = await fetchStatus();
        if (data?.onboarding_complete && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 5000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status?.account_id, status?.onboarding_complete, fetchStatus]);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      const data = await api.post<{ url: string }>("/api/billing/stripe/onboard", {
        return_url: window.location.href,
      });
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message || "Failed to start Stripe onboarding");
      setConnecting(false);
    }
  }

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

  const isConnected = status?.onboarding_complete && status.charges_enabled;
  const isInProgress = status?.account_id && !status.onboarding_complete;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="font-semibold text-warm-800">Payment Processing</h2>
        {isConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            Connected
          </span>
        )}
      </div>
      <p className="text-warm-400 text-xs mb-4">
        Accept client copays and self-pay fees through Stripe.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status!.charges_enabled ? "bg-teal-500" : "bg-warm-300"}`} />
              <span className="text-sm text-warm-600">
                Charges {status!.charges_enabled ? "enabled" : "disabled"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status!.payouts_enabled ? "bg-teal-500" : "bg-warm-300"}`} />
              <span className="text-sm text-warm-600">
                Payouts {status!.payouts_enabled ? "enabled" : "disabled"}
              </span>
            </div>
          </div>
          <p className="text-xs text-warm-400">
            Stripe is set up and ready to accept payments. You can send payment links to clients from the billing page.
          </p>
        </div>
      ) : isInProgress ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            Stripe setup is incomplete. Please continue to finish connecting your account.
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#635BFF] text-white text-sm font-semibold rounded-xl hover:bg-[#524DDB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Redirecting...
              </>
            ) : (
              "Continue Stripe Setup"
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-warm-500">
            Connect with Stripe to accept insurance copays and client self-pay fees directly. Payments go straight to your bank account.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#635BFF] text-white text-sm font-semibold rounded-xl hover:bg-[#524DDB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
                </svg>
                Connect with Stripe
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

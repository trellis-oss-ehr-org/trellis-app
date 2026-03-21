import { useState } from "react";
import { useApi } from "../../hooks/useApi";

interface ClientPaymentButtonProps {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  amountCents: number;
  onSuccess?: () => void;
  variant?: "clinician" | "client";
}

export default function ClientPaymentButton({
  clientId,
  clientName,
  clientEmail,
  amountCents,
  onSuccess,
  variant = "clinician",
}: ClientPaymentButtonProps) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    if (amountCents <= 0) return;
    setLoading(true);
    setError("");

    try {
      const successUrl = variant === "client"
        ? `${window.location.origin}/client/billing?payment=success`
        : `${window.location.href}`;
      const cancelUrl = variant === "client"
        ? `${window.location.origin}/client/billing?payment=cancelled`
        : `${window.location.href}`;

      const data = await api.post<{ checkout_url: string; session_id: string }>(
        "/api/billing/stripe/payment-link",
        {
          client_id: clientId,
          amount_cents: amountCents,
          client_name: clientName,
          client_email: clientEmail,
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      );

      if (variant === "client") {
        window.location.href = data.checkout_url;
      } else {
        window.open(data.checkout_url, "_blank", "noopener,noreferrer");
      }

      onSuccess?.();
    } catch (e: any) {
      setError(e.message || "Failed to generate payment link");
    } finally {
      setLoading(false);
    }
  }

  const buttonText = variant === "client" ? "Pay Now" : "Send Payment Link";

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || amountCents <= 0}
        className={
          variant === "client"
            ? "inline-flex items-center gap-2 px-5 py-2.5 bg-[#635BFF] text-white text-sm font-semibold rounded-xl hover:bg-[#524DDB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            : "inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 001.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" />
            </svg>
            {buttonText}
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { useApi } from "../hooks/useApi";
import type { TextingStatus } from "../types";

function normalizeStatus(value: string | null | undefined) {
  return (value || "unknown").replace(/_/g, " ");
}

function formatSyncTime(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function stepTone(done: boolean, pending: boolean) {
  if (done) return "bg-teal-50 border-teal-200 text-teal-700";
  if (pending) return "bg-amber-50 border-amber-200 text-amber-700";
  return "bg-warm-50 border-warm-200 text-warm-500";
}

function statusDot(done: boolean, pending: boolean) {
  if (done) return "bg-teal-500";
  if (pending) return "bg-amber-500";
  return "bg-warm-300";
}

function StepItem({
  label,
  value,
  done,
  pending = false,
}: {
  label: string;
  value: string;
  done: boolean;
  pending?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${stepTone(done, pending)}`}>
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${statusDot(done, pending)}`} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs capitalize opacity-80">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SetupChecklist({ status }: { status: TextingStatus | null }) {
  const baaSigned = status?.baa_status === "signed";
  const attestationAccepted = status?.shared_number_attestation_status === "accepted";
  const stripeActive = ["active", "trialing"].includes(status?.subscription_status || "");
  const stripePending = ["checkout_completed", "past_due", "incomplete"].includes(
    status?.subscription_status || "",
  );
  const telnyxReady = status?.telnyx_status === "ready" || Boolean(status?.texting_enabled);

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <StepItem
        label="Business associate agreement"
        value={baaSigned ? "signed" : "not signed"}
        done={baaSigned}
      />
      <StepItem
        label="Shared Trellis number"
        value={attestationAccepted ? "accepted" : "not accepted"}
        done={attestationAccepted}
      />
      <StepItem
        label="Stripe subscription"
        value={normalizeStatus(status?.subscription_status)}
        done={stripeActive}
        pending={stripePending}
      />
      <StepItem
        label="Telnyx delivery"
        value={normalizeStatus(status?.telnyx_status)}
        done={telnyxReady}
      />
    </div>
  );
}

export default function TextingSetupPage() {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<TextingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  const enabled = status?.texting_enabled ?? false;
  const configured = status?.configured ?? false;
  const primaryLabel = useMemo(() => {
    if (enabled) return "Manage subscription";
    if (
      status?.baa_status === "signed"
      && status?.shared_number_attestation_status === "accepted"
    ) {
      return "Continue to Stripe";
    }
    if (status?.baa_status === "signed") return "Continue setup";
    return "Start setup";
  }, [enabled, status?.baa_status, status?.shared_number_attestation_status]);

  async function loadStatus({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const data = await api.get<TextingStatus>("/api/texting/status");
      setStatus(data);
    } catch (e: any) {
      setStatus(null);
      setNotice(e.message || "Unable to load texting status");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, [api]);

  useEffect(() => {
    if (searchParams.get("texting") !== "connect") return;
    const sessionId = searchParams.get("session_id");
    const exchangeCode = searchParams.get("exchange_code");
    if (!sessionId || !exchangeCode) return;

    async function completeTextingConnection() {
      setWorking(true);
      setNotice("");
      try {
        const data = await api.post<TextingStatus>("/api/texting/onboarding/complete", {
          session_id: sessionId,
          exchange_code: exchangeCode,
        });
        setStatus(data);
        setNotice(
          data.texting_enabled
            ? "Text reminders are active."
            : "Stripe activation is still pending.",
        );
      } catch (e: any) {
        setNotice(e.message || "Unable to finish texting setup");
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete("texting");
        next.delete("session_id");
        next.delete("exchange_code");
        setSearchParams(next, { replace: true });
        setWorking(false);
      }
    }

    completeTextingConnection();
  }, [api, searchParams, setSearchParams]);

  async function handlePrimary() {
    if (!configured) return;
    setWorking(true);
    setNotice("");
    try {
      if (enabled) {
        const data = await api.post<{ url: string }>("/api/texting/billing-portal", {});
        window.location.href = data.url;
        return;
      }
      const data = await api.post<{ onboarding_url: string }>(
        "/api/texting/onboarding/start",
        {},
      );
      window.location.href = data.onboarding_url;
    } catch (e: any) {
      setNotice(e.message || "Unable to start texting setup");
      setWorking(false);
    }
  }

  async function handleRefresh() {
    setWorking(true);
    setNotice("");
    await loadStatus({ quiet: true });
    setWorking(false);
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-6">
        <Link to="/settings/practice" className="text-sm text-warm-500 hover:text-warm-700">
          Settings
        </Link>
        <h1 className="font-display text-2xl font-bold text-warm-800 mt-2">
          Text reminders
        </h1>
        <p className="text-sm text-warm-500 mt-1">
          BAA, Stripe, and Telnyx status for appointment reminder SMS.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-warm-100 shadow-sm">
        <div className="p-6 border-b border-warm-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold text-warm-800">Connection status</h2>
              <p className="mt-1 text-sm text-warm-500">
                {loading
                  ? "Checking status..."
                  : enabled
                    ? "Active"
                    : configured
                      ? "Not active"
                      : "Hosted texting service is not configured"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handlePrimary}
                disabled={!configured || loading || working}
              >
                {working ? "Working..." : primaryLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={loading || working}
              >
                Refresh
              </Button>
            </div>
          </div>

          {notice && <p className="mt-4 text-sm text-warm-600">{notice}</p>}
          {status?.last_error && (
            <p className="mt-3 text-sm text-amber-700">{status.last_error}</p>
          )}
        </div>

        <div className="p-6">
          <SetupChecklist status={status} />

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-warm-100 bg-warm-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-warm-400">Template</p>
              <p className="mt-1 text-sm text-warm-700">Minimum necessary</p>
            </div>
            <div className="rounded-lg border border-warm-100 bg-warm-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-warm-400">Client consent</p>
              <p className="mt-1 text-sm text-warm-700">Required before send</p>
            </div>
            <div className="rounded-lg border border-warm-100 bg-warm-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-warm-400">Opt-out</p>
              <p className="mt-1 text-sm text-warm-700">STOP replies synced</p>
            </div>
          </div>

          <div className="mt-6 text-xs text-warm-400">
            <p>Install ID: {status?.install_id || "Unavailable"}</p>
            <p>Last checked: {formatSyncTime(status?.last_synced_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

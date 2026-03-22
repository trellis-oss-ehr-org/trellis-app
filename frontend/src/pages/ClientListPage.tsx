import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useApi } from "../hooks/useApi";
import type { ClientListItem, Clinician } from "../types";

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-teal-50 text-teal-700",
  discharged: "bg-warm-100 text-warm-500",
  inactive: "bg-amber-50 text-amber-700",
};

export default function ClientListPage() {
  const { isOwner, practiceType } = useAuth();
  const api = useApi();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [clinicianFilter, setClinicianFilter] = useState("all");
  const [sortCol, setSortCol] = useState<string>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteIntakeMode, setInviteIntakeMode] = useState<"standard" | "iop">("standard");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isGroup = practiceType === "group";

  useEffect(() => {
    async function load() {
      try {
        const [clientData, teamData] = await Promise.all([
          api.get<{ clients: ClientListItem[] }>("/api/clients"),
          isGroup && isOwner
            ? api.get<{ clinicians: Clinician[] }>("/api/practice/team").catch(() => ({ clinicians: [] }))
            : Promise.resolve({ clinicians: [] }),
        ]);
        setClients(clientData.clients);
        setClinicians(teamData.clinicians);
      } catch (err: any) {
        setError(err.message || "Failed to load clients");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api, isGroup, isOwner]);

  const clinicianMap = new Map(clinicians.map((c) => [c.firebase_uid, c.clinician_name || c.email]));

  const STATUS_ORDER: Record<string, number> = { active: 0, inactive: 1, discharged: 2 };

  const filtered = clients.filter((c) => {
    if (clinicianFilter !== "all" && c.primary_clinician_id !== clinicianFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.full_name?.toLowerCase().includes(q)) ||
      (c.preferred_name?.toLowerCase().includes(q)) ||
      c.email.toLowerCase().includes(q) ||
      (c.payer_name?.toLowerCase().includes(q))
    );
  });

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  }

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortCol) {
      case "name":
        return dir * (a.full_name || a.email).localeCompare(b.full_name || b.email);
      case "status":
        return dir * ((STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
      case "phone":
        return dir * (a.phone || "").localeCompare(b.phone || "");
      case "insurance":
        return dir * (a.payer_name || "Self-pay").localeCompare(b.payer_name || "Self-pay");
      case "documents":
        return dir * ((a.docs_signed / Math.max(a.docs_total, 1)) - (b.docs_signed / Math.max(b.docs_total, 1)));
      case "next_appt":
        return dir * (a.next_appointment || "9999").localeCompare(b.next_appointment || "9999");
      case "last_session":
        return dir * (a.last_session || "").localeCompare(b.last_session || "");
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      await api.post("/api/clients/invite", {
        email: inviteEmail,
        client_name: inviteName || undefined,
        intake_mode: inviteIntakeMode,
      });
      setInviteMsg({ type: "success", text: `Invitation sent to ${inviteEmail}` });
      setInviteEmail("");
      setInviteName("");
      setInviteIntakeMode("standard");
    } catch (err: any) {
      setInviteMsg({ type: "error", text: err.message || "Failed to send invitation" });
    } finally {
      setInviteLoading(false);
    }
  }

  function SortHeader({ col, label, className = "" }: { col: string; label: string; className?: string }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => toggleSort(col)}
        className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none transition-colors hover:text-warm-600 ${active ? "text-teal-700" : "text-warm-400"} ${className}`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (
            <svg viewBox="0 0 12 12" fill="currentColor" className={`w-3 h-3 transition-transform ${sortDir === "desc" ? "rotate-180" : ""}`}>
              <path d="M6 2l4 5H2l4-5z" />
            </svg>
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-warm-800">Clients</h1>
          <p className="text-warm-500 text-sm mt-1">
            {loading ? "" : `${clients.length} client${clients.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => { setShowInvite(!showInvite); setInviteMsg(null); }}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
          </svg>
          Invite Client
        </button>
      </div>

      {/* Invite client form */}
      {showInvite && (
        <div className="bg-white rounded-xl border border-warm-100 shadow-sm p-5 mb-6">
          <form onSubmit={handleInvite} className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-warm-500 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-3 py-2 rounded-lg border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs font-medium text-warm-500 mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Client name"
                className="w-full px-3 py-2 rounded-lg border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm"
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-warm-500 mb-1">
                Intake Type
              </label>
              <div className="flex rounded-lg border border-warm-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setInviteIntakeMode("standard")}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    inviteIntakeMode === "standard"
                      ? "bg-teal-600 text-white"
                      : "bg-white text-warm-500 hover:bg-warm-50"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setInviteIntakeMode("iop")}
                  className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                    inviteIntakeMode === "iop"
                      ? "bg-teal-600 text-white"
                      : "bg-white text-warm-500 hover:bg-warm-50"
                  }`}
                >
                  IOP / PHP
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={inviteLoading}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {inviteLoading ? "Sending..." : "Send Invite"}
            </button>
          </form>
          {inviteMsg && (
            <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${
              inviteMsg.type === "success"
                ? "bg-teal-50 text-teal-700"
                : "bg-red-50 text-red-700"
            }`}>
              {inviteMsg.text}
            </p>
          )}
        </div>
      )}

      {/* Search + Clinician Filter */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[200px]">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-warm-400">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, email, or insurance..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm"
          />
        </div>
        {isGroup && isOwner && clinicians.length > 0 && (
          <select
            value={clinicianFilter}
            onChange={(e) => setClinicianFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-warm-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-warm-800 text-sm bg-white"
          >
            <option value="all">All Clinicians</option>
            {clinicians.filter((c) => c.status === "active").map((c) => (
              <option key={c.firebase_uid} value={c.firebase_uid}>
                {c.clinician_name || c.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-warm-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 bg-warm-50 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-warm-300">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <p className="text-warm-400 text-sm">
              {search ? "No clients match your search" : "No clients yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-100">
                  <SortHeader col="name" label="Name" className="px-6" />
                  <SortHeader col="status" label="Status" />
                  <SortHeader col="phone" label="Phone" className="hidden md:table-cell" />
                  {isGroup && isOwner && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-warm-400 uppercase tracking-wide hidden lg:table-cell">
                      Clinician
                    </th>
                  )}
                  <SortHeader col="insurance" label="Insurance" className="hidden lg:table-cell" />
                  <SortHeader col="documents" label="Documents" className="hidden lg:table-cell" />
                  <SortHeader col="next_appt" label="Next Appt" className="hidden lg:table-cell" />
                  <SortHeader col="last_session" label="Last Session" className="hidden md:table-cell" />
                </tr>
              </thead>
              <tbody>
                {paged.map((client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="contents"
                  >
                    <tr className="border-b border-warm-50 hover:bg-warm-50/50 cursor-pointer transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-warm-800">
                            {client.full_name || client.email}
                          </p>
                          {client.full_name && (
                            <p className="text-xs text-warm-400">{client.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[client.status] || ""}`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-warm-500 hidden md:table-cell">
                        {client.phone || "-"}
                      </td>
                      {isGroup && isOwner && (
                        <td className="px-4 py-4 text-warm-500 hidden lg:table-cell text-sm">
                          {client.primary_clinician_id
                            ? clinicianMap.get(client.primary_clinician_id) || "Unknown"
                            : "Unassigned"}
                        </td>
                      )}
                      <td className="px-4 py-4 text-warm-500 hidden lg:table-cell">
                        {client.payer_name || "Self-pay"}
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {client.docs_total > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              client.docs_signed === client.docs_total
                                ? "bg-teal-50 text-teal-700"
                                : client.docs_signed > 0
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-red-50 text-red-700"
                            }`}
                          >
                            {client.docs_signed === client.docs_total ? (
                              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                              </svg>
                            ) : null}
                            {client.docs_signed}/{client.docs_total} signed
                          </span>
                        ) : (
                          <span className="text-warm-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-warm-500 hidden lg:table-cell">
                        {formatDateTime(client.next_appointment)}
                      </td>
                      <td className="px-4 py-4 text-warm-500 hidden md:table-cell">
                        {formatDate(client.last_session)}
                      </td>
                    </tr>
                  </Link>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-xs text-warm-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:bg-warm-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-warm-500">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs font-medium text-warm-600 bg-white border border-warm-200 rounded-lg hover:bg-warm-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

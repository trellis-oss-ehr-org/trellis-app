import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { logOut, getFirebaseMessaging, onMessage } from "../lib/firebase";
import { SessionTimeoutWarning } from "./SessionTimeoutWarning";

const NAV_ITEMS = [
  {
    to: "/client/dashboard",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/client/appointments",
    label: "Appointments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/client/documents",
    label: "Documents",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/client/journal",
    label: "Journal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/client/billing",
    label: "Billing",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
        <path
          d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function ClientShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [banner, setBanner] = useState<string | null>(null);

  // Foreground push notification handler — show auto-dismissing banner
  useEffect(() => {
    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      const text = payload.notification?.body || payload.notification?.title || "New notification";
      setBanner(text);
      const timer = setTimeout(() => setBanner(null), 5000);
      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, []);

  async function handleSignOut() {
    await logOut();
    navigate("/");
  }

  const displayName = user?.displayName || user?.email || "Client";

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col md:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-white border-r border-warm-100 flex-col shrink-0">
        <div className="px-6 py-5 border-b border-warm-100">
          <p className="font-display text-lg font-semibold text-warm-800">
            Trellis
          </p>
          <p className="text-xs text-warm-400 mt-0.5">Client Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-700"
                    : "text-warm-500 hover:text-warm-700 hover:bg-warm-50"
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-warm-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-50 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-8 h-8 rounded-full"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : null}
              <span className={`text-sm font-semibold text-teal-600 ${user?.photoURL ? "hidden" : ""}`}>
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-warm-700 truncate">
                {displayName.split(" ")[0]}
              </p>
              <button
                onClick={handleSignOut}
                className="text-xs text-warm-400 hover:text-warm-600 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar — visible only on mobile */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-warm-100">
        <p className="font-display text-lg font-semibold text-warm-800">
          Trellis
        </p>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-teal-50 rounded-full flex items-center justify-center overflow-hidden">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-7 h-7 rounded-full"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : null}
            <span className={`text-xs font-semibold text-teal-600 ${user?.photoURL ? "hidden" : ""}`}>
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-warm-400 hover:text-warm-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {banner && (
          <div className="mx-4 mt-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-teal-600 shrink-0">
              <path
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {banner}
            <button
              onClick={() => setBanner(null)}
              className="ml-auto text-teal-500 hover:text-teal-700"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}
        <Outlet />
      </main>

      {/* Mobile bottom navigation — visible only on mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-warm-100 safe-area-pb z-30">
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors min-w-[60px] ${
                  isActive
                    ? "text-teal-700"
                    : "text-warm-400"
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* HIPAA: 15-minute inactivity timeout with 13-minute warning */}
      <SessionTimeoutWarning />
    </div>
  );
}

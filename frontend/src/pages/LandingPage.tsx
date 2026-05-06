import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { AuthModal } from "../components/AuthModal";

export default function LandingPage() {
  const { user, practiceInitialized, inviteInfo } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"client" | "clinician">("client");
  const [prefillEmail, setPrefillEmail] = useState("");

  function openAuth(mode: "client" | "clinician", email?: string) {
    if (user) return;
    setAuthMode(mode);
    setPrefillEmail(email || "");
    setAuthOpen(true);
  }

  const isNotInitialized = practiceInitialized === false;
  const isInvite = practiceInitialized === true && inviteInfo !== null;

  return (
    <div className="min-h-screen overflow-hidden">
      <section className="relative min-h-screen flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-teal-800 to-sage-800" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 py-20 text-center">
          {isInvite ? (
            <>
              <p className="text-teal-300 font-medium tracking-widest uppercase text-sm mb-6">
                You've Been Invited
              </p>
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-[1.1] mb-6">
                {inviteInfo.clinician_name || "Your provider"}
                <br />
                <span className="text-teal-300">
                  has invited you to {inviteInfo.practice_name}.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-teal-100/80 max-w-2xl mx-auto mb-10 leading-relaxed">
                Create your account to get started with your care.
              </p>
              <button
                onClick={() => openAuth("client", inviteInfo.email)}
                className="group relative px-8 py-4 bg-amber-400 text-warm-900 font-semibold text-lg rounded-xl hover:bg-amber-300 transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/25 hover:-translate-y-0.5"
              >
                Client Portal
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
                  &rarr;
                </span>
              </button>
            </>
          ) : (
            <>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.1] mb-10">
                Trellis
              </h1>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {isNotInitialized ? (
                  <button
                    onClick={() => openAuth("clinician")}
                    className="group relative px-8 py-4 bg-amber-400 text-warm-900 font-semibold text-lg rounded-xl hover:bg-amber-300 transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/25 hover:-translate-y-0.5"
                  >
                    Set Up Your Practice
                    <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openAuth("client")}
                      className="group relative px-8 py-4 bg-amber-400 text-warm-900 font-semibold text-lg rounded-xl hover:bg-amber-300 transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/25 hover:-translate-y-0.5"
                    >
                      Client Portal
                      <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
                        &rarr;
                      </span>
                    </button>
                    <button
                      onClick={() => openAuth("clinician")}
                      className="px-8 py-4 text-teal-200 font-medium text-lg rounded-xl border border-teal-400/30 hover:bg-teal-800/50 hover:border-teal-400/50 transition-all duration-200"
                    >
                      Clinician Sign In
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {authOpen && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthOpen(false)}
          prefillEmail={prefillEmail}
        />
      )}
    </div>
  );
}

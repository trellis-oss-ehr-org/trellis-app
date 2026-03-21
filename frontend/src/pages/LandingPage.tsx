import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AuthModal } from "../components/AuthModal";

/* ─── Feature data ─────────────────────────────────────────────────────── */

const coreFeatures = [
  {
    title: "Intelligent Intake",
    desc: "New clients complete intake through a natural voice conversation or a traditional form — whichever they prefer. Trellis stores a comprehensive record you can use to demonstrate medical necessity to payers.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M16 4a5 5 0 0 0-5 5v7a5 5 0 0 0 10 0V9a5 5 0 0 0-5-5z" stroke="currentColor" strokeWidth="2" />
        <path d="M24 14v2a8 8 0 0 1-16 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 24v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Smart Scheduling",
    desc: "Clients book directly from your availability with Google Calendar sync, automatic Meet links, and reminders. Or keep your current booking system — every feature is customizable and can be removed completely.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="4" y="6" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M4 13h24M10 3v6M22 3v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="20" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Session Recording & Notes",
    desc: "Record in-person or telehealth sessions with one click. Works with Google Meet out of the box and can be adapted for Zoom. AI generates SOAP, DAP, or narrative notes in seconds — or write them yourself with a traditional form editor.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M11 10h10M11 15h10M11 20h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Treatment Plans",
    desc: "AI-assisted or manually written treatment plans with goals, objectives, and interventions. Auto-populate from intake and session data, or build them from scratch with the form editor.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M8 6h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 13l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Superbills & CMS-1500",
    desc: "Superbills generate automatically when you sign a note. Export as PDF, CMS-1500, or EDI 837P — ready for any payer or clearinghouse.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M8 4h10l6 6v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" />
        <path d="M18 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M11 17h10M11 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Electronic Claims & ERA",
    desc: "Submit claims electronically, track status in real time, and receive ERA/835 remittance data automatically. No more phone calls to payers.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M4 10l12 8 12-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="4" y="8" width="24" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    title: "Denial Management & AI Appeals",
    desc: "Denied claims are flagged instantly with CARC/RARC codes. Trellis categorizes the denial and drafts an appeal letter — you review and one-click send.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2" />
        <path d="M16 10v7M16 21v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Eligibility Verification",
    desc: "Check a client's insurance coverage in seconds — copays, deductibles, coinsurance, out-of-pocket max. Run it from the billing screen or let the AI voice agent verify benefits during intake.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M16 4l10 4v8c0 6-4 10-10 12C10 26 6 22 6 16V8l10-4z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 16l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Client Portal",
    desc: "Invite clients with a personalized link. Once they sign in, they can complete intake, sign documents, view appointments, join telehealth sessions, and pay balances — all from an easy-to-use progressive web app.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <circle cx="16" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
        <path d="M6 26c0-4.4 4.5-8 10-8s10 3.6 10 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "E-Signatures & Documents",
    desc: "Consent forms, intake packets, and onboarding documents with legally-binding e-signatures. SHA-256 hashing for tamper-proof records.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M18 4H8a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V12l-8-8z" stroke="currentColor" strokeWidth="2" />
        <path d="M10 20c2-3 4-1 6-4s2-1 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Stripe Payments",
    desc: "Accept copays and client balances through Stripe. Clients pay securely from their portal — funds go directly to your bank account.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="4" y="8" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M4 14h24" stroke="currentColor" strokeWidth="2" />
        <path d="M10 20h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "HIPAA Audit Log",
    desc: "Every access, every change, every login — automatically logged in an append-only audit trail. Built for compliance from day one.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path d="M6 8h20M6 14h20M6 20h14M6 26h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M27 27l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const pricingTiers = [
  {
    name: "Core EHR",
    price: "~$10",
    period: "/mo",
    desc: "Cloud hosting for the full EHR platform",
    tag: null,
    items: [
      "Client management & portal",
      "Scheduling & Google Calendar sync",
      "E-signatures & document packets",
      "Superbills, CMS-1500, EDI 837P",
      "HIPAA audit log & encryption",
      "Cloud Run + Cloud SQL hosting",
    ],
  },
  {
    name: "With AI",
    price: "~$20\u2013$40",
    period: "/mo",
    desc: "Core hosting + Google AI token usage",
    tag: null,
    items: [
      "Everything in Core, plus:",
      "AI voice intake for new clients",
      "AI session notes (SOAP/DAP/narrative)",
      "AI treatment plan assistance",
      "In-office session recording & transcription",
      "Token costs vary with usage \u2014 billed by Google",
    ],
  },
  {
    name: "With Telehealth",
    price: "+$25",
    period: "/mo",
    desc: "Add a Google Workspace subscription",
    tag: null,
    items: [
      "Google Meet telehealth sessions",
      "Automatic session recording",
      "AI transcription of video sessions",
      "Google Workspace Business Starter",
      "Can be adapted for Zoom integration",
    ],
  },
];

const addOns = [
  {
    name: "SMS Reminders",
    price: "$10/mo",
    desc: "Automated text message appointment reminders for your clients",
  },
  {
    name: "Revenue Cycle Management",
    price: "3% of paid claims",
    desc: "Electronic claim submission, ERA processing, denial management, AI appeals \u2014 3% of insurance payments only (client copays go directly to you)",
  },
];

const comparisonData = [
  { feature: "Base EHR", trellis: "From $10/mo", others: "$60\u2013$100/mo" },
  { feature: "AI session notes", trellis: "Usage-based tokens", others: "$20\u201360/mo add-on" },
  { feature: "Electronic claims", trellis: "Available", others: "$30\u201380/mo add-on" },
  { feature: "Client portal", trellis: "Always included", others: "Often extra" },
  { feature: "Telehealth recording", trellis: "+$25/mo (Workspace)", others: "$20\u201350/mo add-on" },
  { feature: "SMS reminders", trellis: "+$10/mo", others: "$15\u201325/mo add-on" },
  { feature: "Own your data", trellis: "Yes \u2014 your database", others: "Stored on vendor servers" },
  { feature: "Own the software", trellis: "Yes \u2014 open source", others: "Subscription access" },
  { feature: "Switch or cancel", trellis: "Keep everything", others: "Export required" },
];

/* ─── Component ────────────────────────────────────────────────────────── */

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
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-teal-800 to-sage-800" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-warm-50 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
          {isInvite ? (
            <>
              <p className="text-teal-300 font-medium tracking-widest uppercase text-sm mb-6">
                You've Been Invited
              </p>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.1] mb-6">
                {inviteInfo.clinician_name || "Your provider"}
                <br />
                <span className="text-teal-300">
                  has invited you to {inviteInfo.practice_name}.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-teal-100/80 max-w-2xl mx-auto mb-10 leading-relaxed">
                Create your account to get started with your care. It only takes
                a moment.
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
              <p className="text-teal-300 font-medium tracking-widest uppercase text-sm mb-6">
                The EHR You Actually Own
              </p>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.1] mb-6">
                Your Practice.
                <br />
                <span className="text-teal-300">Your Software.</span>
              </h1>
              <p className="text-lg sm:text-xl text-teal-100/80 max-w-2xl mx-auto mb-8 leading-relaxed">
                Trellis is an open-source, AI-native EHR for behavioral health
                therapists. Intake, scheduling, notes, billing, claims, payments
                &mdash; all automated. You own the software and the data.
                Everything is fully customizable, and any features you don't need
                are a snap to remove. Just pay for HIPAA-secure cloud hosting
                and the features you actually use.
              </p>
              <p className="text-teal-300/90 text-lg font-medium mb-10">
                Starts at $10/month. No per-user fees. No contracts. Add AI, telehealth, billing management, and messaging only if you need them.
              </p>
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

      {/* ── "You Own It" Banner ─────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-warm-50">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 font-medium px-4 py-2 rounded-full text-sm mb-8">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            Open Source &middot; HIPAA Compliant &middot; Self-Hosted
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-800 mb-4">
            An EHR That's Truly Yours
          </h2>
          <p className="text-warm-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Trellis is free, open-source software that you deploy to your own
            HIPAA-secure Google Cloud account. You own every line of code and
            every byte of data. Start at $10/month for a full EHR, and add AI notes,
            telehealth, and messaging whenever you're ready. Your practice grows
            on your terms &mdash; and everything stays with you, always.
          </p>
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-sage-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-800 text-center mb-4">
            Everything a Solo Practice Needs
          </h2>
          <p className="text-warm-500 text-center max-w-2xl mx-auto mb-16 text-lg">
            From the first phone call to the last insurance payment &mdash; one platform
            handles it all. Optional add-ons for SMS reminders and revenue cycle management when you're ready.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-7 shadow-sm border border-sage-100 hover:shadow-md hover:border-teal-200 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-warm-800 mb-2">
                  {f.title}
                </h3>
                <p className="text-warm-500 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-warm-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-800 text-center mb-4">
            Automates Your Entire Workflow
          </h2>
          <p className="text-warm-500 text-center max-w-2xl mx-auto mb-16 text-lg">
            Here's what a typical day looks like with Trellis running your practice.
          </p>
          <div className="space-y-6">
            {[
              {
                step: "1",
                title: "New client calls or visits your site",
                desc: "They complete intake via voice or form in their client portal. You can allow anyone to start an intake or gate it by sending personalized invite links. Demographics, insurance, history, and consent forms are all captured. If they have insurance, the voice agent can verify benefits on the spot.",
              },
              {
                step: "2",
                title: "They book their first session",
                desc: "Trellis shows your real availability from Google Calendar. The client picks a slot, and Trellis sends confirmation emails, creates a Calendar event, and generates a Meet link if it's telehealth.",
              },
              {
                step: "3",
                title: "You see the client",
                desc: "Session recording captures the conversation (in-person mic or telehealth). When you're done, Trellis generates a clinical note in your preferred format — SOAP, DAP, or narrative.",
              },
              {
                step: "4",
                title: "You review and sign the note",
                desc: "One click to review the AI-generated note, make any edits, and sign. A superbill is automatically created with the right CPT codes, diagnosis codes, and fees.",
              },
              {
                step: "5",
                title: "The claim is submitted automatically",
                desc: "Trellis submits the claim electronically. You can track its status in real time. When the ERA comes back, payment is recorded and client balance updated automatically.",
              },
              {
                step: "6",
                title: "Client pays their balance",
                desc: "If there's a copay or remaining balance, the client sees it in their portal and pays with Stripe. You get paid directly — no middleman.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex gap-5 bg-white rounded-2xl p-6 shadow-sm border border-warm-100"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-warm-800 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-warm-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-sage-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-800 text-center mb-4">
            Pay Only for What You Use
          </h2>
          <p className="text-warm-500 text-center max-w-2xl mx-auto mb-6 text-lg">
            Trellis is free. These are your estimated cloud hosting costs &mdash;
            paid directly to Google, not to us. Start with the basics and turn on
            more as your practice grows.
          </p>
          <p className="text-warm-400 text-center max-w-xl mx-auto mb-16 text-sm">
            The only fees that come to Trellis are optional SMS reminders and
            revenue cycle management services.
          </p>

          {/* Pricing tiers */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative bg-white rounded-2xl p-7 shadow-sm border ${
                  tier.tag ? "border-teal-300 ring-1 ring-teal-200" : "border-sage-100"
                }`}
              >
                {tier.tag && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    {tier.tag}
                  </span>
                )}
                <p className="text-warm-500 text-sm font-medium uppercase tracking-wider mb-2">
                  {tier.name}
                </p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl font-bold text-teal-700">
                    {tier.price}
                  </span>
                  <span className="text-warm-400 text-sm">{tier.period}</span>
                </div>
                <p className="text-warm-400 text-sm mb-5">{tier.desc}</p>
                <ul className="space-y-2">
                  {tier.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-warm-600">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Add-ons */}
          <div className="grid sm:grid-cols-2 gap-5 mb-16">
            {addOns.map((a) => (
              <div
                key={a.name}
                className="bg-white rounded-2xl p-6 shadow-sm border border-sage-100 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-warm-800">
                    {a.name}{" "}
                    <span className="text-teal-600 font-medium text-sm ml-1">
                      {a.price}
                    </span>
                  </p>
                  <p className="text-warm-500 text-sm leading-relaxed">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-white rounded-2xl shadow-sm border border-sage-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-sage-100">
              <h3 className="text-xl font-semibold text-warm-800">
                Trellis vs. Traditional EHR Subscriptions
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-sage-50/50">
                    <th className="px-6 py-3 text-sm font-medium text-warm-500"></th>
                    <th className="px-6 py-3 text-sm font-semibold text-teal-700">
                      Trellis
                    </th>
                    <th className="px-6 py-3 text-sm font-medium text-warm-500">
                      SimplePractice, TherapyNotes, etc.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-100">
                  {comparisonData.map((row) => (
                    <tr key={row.feature} className="hover:bg-sage-50/30 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-warm-700">
                        {row.feature}
                      </td>
                      <td className="px-6 py-3 text-sm text-teal-700 font-medium">
                        {row.trellis}
                      </td>
                      <td className="px-6 py-3 text-sm text-warm-400">
                        {row.others}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Security & HIPAA ───────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-warm-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-800 text-center mb-4">
            HIPAA Compliant by Design
          </h2>
          <p className="text-warm-500 text-center max-w-2xl mx-auto mb-16 text-lg">
            Trellis runs on your own Google Cloud account with a signed Business
            Associate Agreement. Your data lives in your own cloud &mdash; fully under your control.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Encrypted Everywhere",
                desc: "AES-256 encryption at rest, TLS in transit. OAuth tokens encrypted with Fernet keys you control.",
              },
              {
                title: "Your Cloud, Your Data",
                desc: "Deployed to your own Google Cloud project. You hold the keys, the backups, and the BAA.",
              },
              {
                title: "Automatic Audit Trail",
                desc: "Every login, every record access, every change — logged to an append-only audit table. Always ready for review.",
              },
              {
                title: "Session Timeouts",
                desc: "15-minute inactivity timeout with warning. Tokens auto-refresh and expire. Role-based access controls.",
              },
              {
                title: "Daily Backups",
                desc: "Cloud SQL automated daily backups with 7-day retention and point-in-time recovery.",
              },
              {
                title: "Open Source Transparency",
                desc: "Every line of code is visible and auditable. Complete transparency into how your data is handled, stored, and protected.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-7 shadow-sm border border-warm-100"
              >
                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center mb-4">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-warm-800 mb-2">
                  {item.title}
                </h3>
                <p className="text-warm-500 leading-relaxed text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-sage-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-warm-800 text-center mb-16">
            Common Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Do I need to be technical to use this?",
                a: "Not at all. Trellis comes with a setup wizard that walks you through everything step by step. Most therapists are up and running in about 30 minutes. If you get stuck, the AI assistant can help.",
              },
              {
                q: "What do I actually pay for?",
                a: "The core EHR \u2014 scheduling, client management, billing, documents, client portal \u2014 runs on HIPAA-secure cloud hosting for about $10/month. AI features (voice intake, session notes, treatment plans) add $10\u2013$30/month in token costs depending on usage. Telehealth with session recording is $25/month for a Google Workspace subscription. SMS reminders are $10/month. Electronic claims (RCM) pricing is discussed per practice. You only pay for what you turn on.",
              },
              {
                q: "What if I want to switch to something else?",
                a: "Your data stays in your own Google Cloud database. You can export it anytime, switch to another system, or keep the database running independently. There's nothing to cancel \u2014 you own everything.",
              },
              {
                q: "Is this really HIPAA compliant?",
                a: "Yes. Trellis runs on Google Cloud with a signed BAA. Data is encrypted at rest and in transit, access is role-based and audited, and all PHI handling follows HIPAA technical safeguards. The code is open source so you can verify this yourself.",
              },
              {
                q: "Can I use this with insurance clients?",
                a: "Absolutely. Trellis generates superbills, CMS-1500 forms, and EDI 837P files out of the box. If you want to go fully electronic, the RCM add-on submits claims to payers, tracks payment status, processes ERA remittances, handles denials, and even drafts appeal letters with AI.",
              },
              {
                q: "Does this work for group practices?",
                a: "Yes. Trellis supports team management, role-based permissions, and per-clinician scheduling. Credentialing tracks each clinician's enrollment status per payer, and RCM handles claims across your entire team.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="bg-white rounded-2xl p-6 shadow-sm border border-sage-100"
              >
                <h3 className="text-lg font-semibold text-warm-800 mb-2">
                  {item.q}
                </h3>
                <p className="text-warm-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Footer ─────────────────────────────────────────────────── */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-800 via-teal-700 to-sage-700" />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
            Your Practice Deserves
            <br />
            Better Software
          </h2>
          <p className="text-teal-100/80 text-lg mb-4 max-w-xl mx-auto">
            Own your EHR. Own your data. Start at $10/month and add only what you need.
          </p>
          <p className="text-teal-300/80 text-base mb-10 max-w-lg mx-auto">
            Set up in under an hour. No credit card. No sales calls. Just you and your practice.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isNotInitialized ? (
              <button
                onClick={() => openAuth("clinician")}
                className="group px-10 py-4 bg-amber-400 text-warm-900 font-semibold text-lg rounded-xl hover:bg-amber-300 transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/20 hover:-translate-y-0.5"
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
                  className="group px-10 py-4 bg-amber-400 text-warm-900 font-semibold text-lg rounded-xl hover:bg-amber-300 transition-all duration-200 hover:shadow-lg hover:shadow-amber-400/20 hover:-translate-y-0.5"
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
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-warm-800 text-warm-400 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="font-display text-lg text-white font-semibold">
            Trellis
          </p>
          <div className="flex items-center gap-6">
            <Link
              to="/setup-wizard"
              className="text-warm-400 hover:text-teal-300 transition-colors"
            >
              Setup Wizard
            </Link>
            <p>&copy; {new Date().getFullYear()} Trellis. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── Auth Modal ─────────────────────────────────────────────────── */}
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

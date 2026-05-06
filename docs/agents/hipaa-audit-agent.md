# HIPAA-Oriented Audit Agent

Use this prompt when a Trellis installer asks Codex to review whether their
local Trellis instance is ready for HIPAA-regulated use. This is not legal
advice, does not certify compliance, and should not replace counsel,
organizational risk analysis, or practice-specific policies.

## Invocation

```text
You are the Trellis HIPAA-oriented audit agent. Review this Trellis repository
and local setup for risks to electronic protected health information. Follow
docs/agents/hipaa-audit-agent.md exactly. Do not print secrets or ask for PHI.
Return prioritized findings with evidence, likely impact, remediation, commands
run, skipped checks, and operational items the practice must confirm outside the
codebase.
```

## Source Baseline

Use the current official source material when performing a formal review. At
minimum, anchor the review to:

- HHS HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/index.html
- HHS Summary of the HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- HHS Guidance on Risk Analysis: https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html
- HHS Minimum Necessary guidance: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html
- HHS Breach Notification Rule: https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html
- NIST SP 800-66r2, Implementing the HIPAA Security Rule: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-66r2.pdf

If these sources have changed since this file was written, use the current
official versions and state the dates or versions used in the report.

## Audit Scope

Review Trellis as a self-hosted, practice-controlled EHR deployment. Cover:

- ePHI data creation, receipt, maintenance, transmission, storage, deletion, and
  logging.
- Frontend, backend API, voice relay, database migrations, shared modules, tests,
  Cloud Build/Cloud Run configuration, Firebase, Google OAuth, Google AI,
  Google Calendar/Gmail/Drive/Docs, and optional texting services.
- Configuration and deployment evidence in `README.md`, `SETUP.md`,
  `docs/hipaa-self-hosting-responsibilities.md`, `docker-compose.yml`,
  `Makefile`, `frontend`, `backend`, `db/migrations`, `docs`, and `tests`.
- Local environment files only for key names and unsafe patterns. Never print
  actual values.

Do not claim that Trellis or a practice is HIPAA compliant. Report whether the
repository and observed setup provide evidence for safeguards and where evidence
or controls are missing.

## Safety Rules

- Do not request, paste, store, or print PHI/ePHI.
- Do not print `.env` values, service account JSON, OAuth secrets, Firebase
  private keys, database passwords, tokens, or live deployment URLs.
- If inspecting `.env` files, print only variable names and redacted risk notes.
- Do not mutate cloud resources, IAM, secrets, production data, databases, or
  deployment state unless the user explicitly asks for a specific change.
- Do not edit application code in audit mode unless the user asks for
  remediation work.
- Do not run destructive commands such as `git reset`, `git checkout --`,
  database drops, migration rewrites, or production deploys.

## Recommended Workflow

1. Establish context.
   - Run `git status --short` in the repository.
   - Identify whether the review is for local development, staging, or
     production.
   - Note any dirty worktree files without reverting them.

2. Inventory ePHI flows.
   - Trace client intake, scheduling, sessions, recordings, transcripts, note
     generation, treatment plans, documents, billing, audit logs, assistant
     queries, OAuth tokens, push notifications, email, and texting.
   - Identify third parties that may create, receive, maintain, or transmit
     ePHI.

3. Review technical safeguards.
   - Authentication and token verification.
   - Role-based access control and object-level authorization.
   - Audit logging coverage, append-only behavior, and metadata redaction.
   - Encryption in transit, encryption at rest, stored credential encryption,
     key handling, and secret storage.
   - Session timeout, reauthentication, cache controls, browser security
     headers, CORS, API docs exposure, cron endpoint protection, and health
     endpoint protection.
   - Logging and error handling that could leak PHI, credentials, raw prompts,
     transcripts, email addresses, phone numbers, member IDs, or clinical text.
   - Data retention, redaction, deletion, export, backup, and recovery behavior.

4. Review administrative and operational evidence.
   - BAA coverage for Google Cloud/Firebase, Google Workspace or AI services,
     email, texting, payment, monitoring, and support vendors.
   - Security Rule risk analysis documentation and update cadence.
   - Workforce access roles, onboarding/offboarding, least privilege,
     termination process, incident response, breach notification, and access
     reviews.
   - Production runbooks for secret rotation, backup restore, log retention,
     audit log review, and vulnerability remediation.

5. Run safe automated checks when available.

```bash
git status --short
rg -n --hidden -g '!frontend/node_modules/**' -g '!tests/node_modules/**' -g '!.git/**' \
  "DEV_MODE|ALLOWED_ORIGINS|CORS|audit|log|logger|password|secret|token|private_key|service account|PHI|ePHI|email|phone|ssn|BAA|retention|delete|redact|encrypt|CRON_SECRET|HEALTH_CHECK_SECRET" .
make test-build
make test-backend
make audit-deps
```

If Docker, `pip-audit`, npm, or cloud CLIs are unavailable, skip that check and
state exactly what was skipped and why. Do not install tools globally without
approval.

6. Inspect local environment shape safely.
   - Locate `.env`, `.env.*`, and service account files.
   - Do not print values. Report only missing required variable names, unsafe
     sentinel values such as `DEV_MODE=1` in a production context, default
     secrets, wildcard origins, localhost production origins, or non-HTTPS
     production URLs.

## Finding Severity

- Critical: likely ePHI exposure, production auth bypass, hardcoded live secret,
  missing access control for PHI, destructive data risk, or known exploited
  vulnerable dependency in a reachable production path.
- High: material gap in HIPAA-oriented technical safeguards, auditability,
  encryption, deployment protection, logging safety, or vendor/BAA coverage.
- Medium: defense-in-depth weakness, incomplete evidence, test gap around ePHI
  access, retention ambiguity, or operational process gap.
- Low: documentation drift, minor hardening opportunity, or incomplete local
  automation with low immediate exposure.

## Report Format

Return the report in this order:

1. Summary: 3 to 6 bullets with the overall readiness picture and strongest
   blockers.
2. Findings: severity, area, evidence with file paths and line numbers when
   possible, impact, remediation, and verification step.
3. Evidence reviewed: files, flows, config classes, and commands.
4. Skipped checks: command or evidence not reviewed, with reason.
5. Operational checklist: items the practice must confirm outside the codebase.
6. Compliance boundary: a short statement that the review is not legal advice
   and does not certify HIPAA compliance.

Keep the report concise. Do not include raw command output unless it is short
and already redacted.

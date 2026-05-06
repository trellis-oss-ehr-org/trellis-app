# HIPAA Responsibilities When Self-Hosting Trellis

Trellis is open-source software that includes HIPAA-oriented engineering
safeguards. When a practice self-hosts Trellis, the practice is responsible for
the compliance program around that deployment. Running Trellis in your own
Google Cloud project does not, by itself, make the practice HIPAA compliant.

This guide is practical orientation, not legal advice. Confirm your obligations
with qualified counsel, your compliance lead, or a HIPAA consultant before using
Trellis with real client data.

## Start Here

Before entering real client data into a self-hosted Trellis instance, the
practice should be able to answer these questions:

1. Are we a HIPAA covered entity, business associate, or otherwise subject to
   HIPAA or stricter state privacy laws?
2. Have we completed and documented a Security Rule risk analysis for this
   deployment?
3. Have we chosen and documented safeguards to reduce identified risks to a
   reasonable and appropriate level?
4. Do we have business associate agreements for every vendor that creates,
   receives, maintains, or transmits ePHI for us?
5. Do we have written policies for access, workforce training, incident
   response, breach notification, backup, retention, device security, and
   offboarding?
6. Have we verified production configuration, backups, audit logging, and access
   controls before using real client data?

If any answer is unknown, treat it as a launch blocker for production use.

## What Trellis Provides

Trellis can help with technical safeguards, including:

- Firebase authentication outside local development mode.
- Role-based access controls and clinician/client separation.
- Audit logging for many PHI-relevant reads and writes.
- Encryption support through Google Cloud, Cloud SQL, TLS, and encrypted stored
  OAuth tokens.
- Session timeout and reauthentication UX.
- Conservative browser security headers and no-store cache headers.
- Production configuration checks for unsafe `DEV_MODE`, CORS, cron secrets,
  health checks, and API documentation exposure.
- PHI-safe logging helpers and audit metadata redaction.
- Documentation and Codex audit prompts for repeatable review.

These safeguards are only useful when the deployment is configured and operated
correctly.

## What The Practice Owns

The self-hosting practice owns:

- Its HIPAA status analysis and legal obligations.
- Google Cloud, Firebase, DNS, email, texting, payment, monitoring, and support
  vendor configuration.
- Business associate agreements and subcontractor review.
- Workforce access decisions, training, sanctions, and offboarding.
- Security policies and procedures.
- Risk analysis, risk management, and periodic review.
- Backup, disaster recovery, and restore testing.
- Device, workstation, browser, and network security.
- Incident response, breach assessment, and required notifications.
- Data retention, deletion, export, and record amendment workflows.
- Verification that any local code changes preserve privacy and security
  safeguards.

The Trellis open-source project is not operating your instance and generally
does not have access to your data. Unless you separately buy a hosted or support
service that handles ePHI, the project maintainers are not your business
associate for your self-hosted deployment.

## Covered Entity Or Business Associate Status

Many behavioral health practices are HIPAA covered entities when they provide
health care and transmit health information electronically in connection with
HIPAA-standard transactions. A practice may also be a business associate when it
handles PHI on behalf of another covered entity.

Do not assume your status from the software alone. Review your billing,
insurance, claims, clearinghouse, employer, referral, and subcontractor
relationships with counsel. Even when HIPAA does not apply, state privacy,
licensure, telehealth, consumer health data, contract, or professional ethics
rules may impose similar or stricter duties.

## Business Associate Agreements

If a vendor creates, receives, maintains, or transmits ePHI for your practice,
confirm BAA coverage before production use. For a typical Trellis deployment,
review at least:

- Google Cloud and Firebase services.
- Google Workspace services used for Calendar, Gmail, Drive, Docs, Meet, or
  related integrations.
- Google AI or speech services used with ePHI.
- Email delivery providers.
- Texting or phone vendors.
- Payment vendors, if payment records are connected to identifiable health
  services.
- Monitoring, logging, analytics, support, backup, or security vendors.
- Any contractor, managed service provider, consultant, or developer with access
  to production data or systems.

Keep copies of signed BAAs or covered service terms. A vendor's security page,
marketing claim, or encryption feature is not a substitute for a BAA when one is
required.

## Security Rule Risk Analysis

HIPAA requires a documented risk analysis and risk management process. For
Trellis, inventory where ePHI is created, received, maintained, and transmitted:

- Client intake forms and voice intake.
- Appointments, demographics, insurance, authorizations, and billing exports.
- Session recordings, transcripts, generated notes, treatment plans, and
  discharge summaries.
- Documents, signatures, uploaded files, and generated PDFs.
- OAuth tokens and connected Google account metadata.
- Audit logs, request logs, error logs, backups, and support artifacts.
- Email, reminders, texting, push notifications, and calendar events.
- Developer machines and local test environments.

For each item, document threats, vulnerabilities, existing safeguards, residual
risk, and the decision to accept, mitigate, transfer, or avoid the risk. Repeat
the analysis after material changes such as new integrations, hosted services,
staff access changes, deployment changes, or security incidents.

## Administrative Safeguards

At minimum, define and maintain:

- A named security official or responsible owner.
- Written security policies and procedures.
- Workforce onboarding, access approval, training, sanctions, and offboarding.
- Least-privilege access rules for clinicians, administrators, contractors, and
  developers.
- Periodic access review for Firebase users, Google Cloud IAM, service accounts,
  database users, support accounts, and connected Google Workspace accounts.
- Incident response and breach notification procedures.
- Contingency plan, backups, disaster recovery, and emergency access process.
- Vendor and BAA review process.
- Change management for upgrades, migrations, code changes, and configuration
  changes.
- Documentation retention for policies, risk analyses, audit reviews, incidents,
  training, and access reviews.

## Physical And Device Safeguards

Self-hosting still depends on the devices and locations used to access Trellis.
Document controls for:

- Clinician laptops, phones, tablets, and home-office workstations.
- Full-disk encryption, screen lock, password manager, and MFA.
- Browser profile separation for clinical use.
- Secure Wi-Fi, router updates, and private work areas.
- Printed records, downloaded PDFs, exported billing files, and local backups.
- Lost or stolen devices.
- Secure disposal or transfer of old devices and storage media.
- Developer machines that hold `.env` files, service account keys, test data, or
  production access.

## Technical Safeguards And Configuration

Before production use, verify:

- `DEV_MODE` is not enabled.
- Every production origin uses HTTPS and `ALLOWED_ORIGINS` has exact origins, no
  wildcards, and no localhost values.
- API docs are disabled unless intentionally protected.
- Firebase Authentication is configured with approved sign-in methods and
  authorized domains.
- Every user has a unique account. Do not share clinician or admin accounts.
- MFA is enabled where supported for Google Cloud, Firebase, Google Workspace,
  and administrative accounts.
- Service account keys are not committed, copied into images, or left on
  developer machines longer than needed.
- Production secrets are stored in Secret Manager or equivalent, not files in
  the repo.
- `CRON_SECRET`, `HEALTH_CHECK_SECRET`, `OAUTH_TOKEN_ENCRYPTION_KEY`, and
  `LOG_HASH_SECRET` are strong, unique production values.
- Cloud SQL requires TLS or private trusted connectivity appropriate to your
  deployment.
- Cloud SQL backups are enabled and restore-tested.
- Cloud Run ingress, IAM, and service accounts are least privilege.
- Audit logs are reviewed and retained according to policy.
- Application, cloud, and database logs do not include PHI, request bodies,
  transcripts, generated notes, OAuth secrets, raw tokens, or service account
  keys.
- Monitoring and alerting cover failed auth, suspicious access, cron failures,
  backup failures, error spikes, and unexpected deploys.

## Privacy Rule And Minimum Necessary Practices

Security controls are only one part of HIPAA. The practice should also define:

- Notice of Privacy Practices distribution and acknowledgement workflow.
- Client rights workflows, including access, amendment, restrictions,
  confidential communications, and accounting where applicable.
- Minimum necessary rules for internal access, exports, emails, reminders,
  billing, support, and troubleshooting.
- Authorization and consent handling for uses or disclosures that require them.
- Policies for psychotherapy notes or other specially protected records if used.
- Rules for copying data into external AI, email, documents, spreadsheets,
  support tools, or messaging apps.

Do not put PHI into third-party tools unless the disclosure is permitted and the
vendor relationship is covered appropriately.

## Email, Texting, Calendar, And AI

Connected communication and AI services are common sources of compliance drift.

- Keep client-facing reminders minimal and avoid diagnosis, clinical details, or
  sensitive treatment content unless specifically reviewed and approved.
- Treat calendar event titles, locations, descriptions, and guest lists as
  potential PHI.
- Use email carefully. Avoid PHI in subject lines, logs, previews, or templates
  unless the workflow has been reviewed.
- Confirm opt-in, opt-out, retention, and redaction behavior for texting.
- Confirm that every AI, speech, transcription, or document service used with
  ePHI is covered by appropriate terms and configured for your use case.
- Do not paste real client data into Codex or other coding assistants unless
  your organization has explicitly approved that workflow and vendor terms.

## Breach And Incident Readiness

Have a written process before launch. The practice should know:

- Who receives security reports and who can make incident decisions.
- How to preserve logs and evidence.
- How to disable accounts, rotate secrets, revoke service account keys, and stop
  integrations.
- How to assess whether PHI was compromised.
- When and how to notify affected individuals, HHS, media, state regulators,
  vendors, or other parties.
- How to document the incident, risk assessment, notifications, and corrective
  actions.

Under HHS guidance, covered entities and business associates have documentation
obligations around breach notification decisions. Do not wait for an incident to
design this process.

## Production Launch Checklist

Complete this checklist before real client data:

- Legal/compliance owner has confirmed HIPAA status and applicable state laws.
- Security Rule risk analysis is complete and documented.
- Risk management plan has assigned owners and due dates.
- BAAs or equivalent covered service terms are in place for all ePHI vendors.
- Workforce policies and training are complete.
- Incident response and breach notification procedures are documented.
- Data retention, deletion, backup, and restore procedures are documented.
- `make test-build`, `make test-backend`, and `make audit-deps` have been run
  or intentionally skipped with documented reasons.
- Codex audit prompts in `docs/agents/` have been run and findings triaged.
- Production environment variables have been reviewed without printing secrets.
- Cloud IAM, Firebase users, service accounts, and OAuth credentials have been
  reviewed for least privilege.
- Backups are enabled and a restore has been tested.
- Audit logging has been verified in the application.
- No demo accounts, default passwords, local-only URLs, or test data are present
  in production.

## Ongoing Review Cadence

Suggested minimum cadence:

- Weekly: review failed jobs, auth anomalies, error spikes, backup status, and
  unexpected deploys.
- Monthly: review audit log samples, inactive accounts, open security findings,
  and dependency updates.
- Quarterly: review IAM, Firebase users, service accounts, connected OAuth
  accounts, vendor access, and incident response contacts.
- Annually: refresh risk analysis, policies, workforce training, BAA inventory,
  disaster recovery test, and retention/deletion rules.
- After every material change: rerun the relevant Codex audit prompt and update
  the risk analysis.

## Codex Audit Prompts

Trellis includes Codex-ready review prompts:

- `docs/agents/hipaa-audit-agent.md`
- `docs/agents/code-quality-security-agent.md`

From the repository root, ask Codex:

```text
Run a full Trellis security audit using docs/agents/code-quality-security-agent.md
and docs/agents/hipaa-audit-agent.md.
```

Codex should inspect your local instance, run non-destructive checks where
available, avoid printing secrets or PHI, and return prioritized findings.

## Official References

- HHS Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/index.html
- HHS Summary of the HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- HHS Guidance on Risk Analysis: https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html
- HHS Cloud Computing Guidance: https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html
- HHS Business Associates Guidance: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html
- HHS Minimum Necessary Guidance: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html
- HHS Breach Notification Rule: https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html
- NIST SP 800-66 Rev. 2: https://csrc.nist.gov/pubs/sp/800/66/r2/final

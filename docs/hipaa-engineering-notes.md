# HIPAA Engineering Notes

This project can support HIPAA-regulated use only when it is deployed and
operated with the required administrative, physical, and technical safeguards.
The codebase does not certify compliance by itself.

Primary references:

- HHS Security Rule summary: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
- HHS minimum necessary guidance: https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html
- HHS Breach Notification Rule: https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html

## Implemented Engineering Safeguards

- Firebase ID token verification is required outside explicit local `DEV_MODE`.
- Production-like environments reject `DEV_MODE`.
- Production-like environments reject wildcard, localhost, and non-HTTPS CORS origins.
- Swagger, ReDoc, and OpenAPI are hidden in production-like environments unless `ENABLE_API_DOCS=1`.
- API and relay responses include `Cache-Control: no-store` and conservative browser security headers.
- Request logs avoid request bodies, response bodies, query strings, auth headers, and raw IPs in production-like environments.
- Backend log formatting redacts common emails, phone numbers, bearer tokens, secret key/value pairs, SSN-like identifiers, and common member identifiers.
- Audit metadata receives best-effort redaction before storage.
- Stored Google OAuth refresh tokens are encrypted.
- SMS reminder design uses explicit consent state, opt-out handling, redacted hosted-service message storage, and safe reminder templates.
- AI assistant markdown is rendered through React nodes rather than injected as HTML.

## Required Operational Controls

- Execute and document a HIPAA Security Rule risk analysis for all ePHI the practice creates, receives, maintains, or transmits.
- Confirm BAAs are in place for Google Cloud/Firebase, Google Workspace/AI services used with ePHI, Telnyx/Stripe or any hosted texting component, email providers, monitoring vendors, and any subcontractor that can access ePHI.
- Use Google Cloud service accounts through workload identity in production. Local service account key files must stay gitignored, be rotated, and be removed from developer machines when no longer needed.
- Set production secrets through Secret Manager or equivalent, not checked-in files.
- Set `APP_ENV=production`, `CRON_SECRET`, `HEALTH_CHECK_SECRET`, `LOG_HASH_SECRET`, and exact `ALLOWED_ORIGINS` for every production-like deployment.
- Restrict Cloud Run ingress and IAM where possible, and require TLS for all public endpoints.
- Define retention and deletion policy for transcripts, notes, recordings, logs, audit events, and generated billing artifacts.
- Document workforce access roles, onboarding/offboarding, incident response, breach notification, and periodic access review.
- Keep production logs out of browser developer consoles and third-party observability tools unless those tools are covered by appropriate agreements and retention controls.

## Deployment Checks

- `DEV_MODE` is unset.
- `ALLOWED_ORIGINS` contains only the deployed HTTPS frontend origins.
- `/docs`, `/redoc`, and `/openapi.json` are inaccessible unless intentionally enabled.
- `/api/health` requires `X-Health-Secret` or `X-Cron-Secret`.
- Cron endpoints reject missing or default development secrets.
- Service account JSON files are not committed and are not copied into production images.
- Test/demo accounts and demo passwords are disabled or isolated from production data.

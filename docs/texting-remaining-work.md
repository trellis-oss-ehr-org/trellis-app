# Texting Remaining Work

This document tracks what is still needed after the BAA, shared-number
attestation, Stripe checkout, HELP/STOP handling, and client SMS consent
evidence implementation.

## Immediate User Tasks

- Add the Stripe test price to the hosted service environment:
  `STRIPE_TEXTING_PRICE_ID=price_1TQrpj1gmT1cCcomAdwEOZQV`.
- Do not commit Stripe keys. Put `STRIPE_SECRET_KEY` and future webhook secrets
  in Secret Manager or the deployment secret store.
- Create a public HTTPS deployment URL for `trellis-services`.
- After the hosted URL exists, create the Stripe webhook endpoint for
  `/v1/stripe/webhook` and set `STRIPE_WEBHOOK_SECRET`.
- Configure Telnyx test/live credentials, `TELNYX_PUBLIC_KEY`, and the Telnyx
  webhook endpoint `/v1/telnyx/webhook`.
- Rotate the pasted Stripe test secret before any production-like use if you
  want clean key history.
- Replace the placeholder BAA with attorney-approved final Trellis LLC text and
  set a non-draft `TEXTING_BAA_VERSION`.

## Immediate Code Quality Sweep

- Review the large texting diffs for shared constants that should be centralized
  between frontend and backend consent text/version.
- Review the hosted onboarding HTML for accessibility, copy, and error states.
- Add tests for the signed agreement copy page and the `/stripe` continuation
  endpoint.
- Add an explicit test that local texting status is not enabled until the
  shared-number attestation status is `accepted`.
- Add test coverage for Stripe past-due/canceled subscription states blocking
  sends.
- Review test database migration setup so new migrations are applied
  automatically instead of manually updating `trellis_test`.
- Run `ruff` or the repo's formatter/linter once the broader code sweep starts.

## Deployment Work

- Deploy `trellis-services` under a Trellis LLC-controlled HTTPS domain.
- Run hosted-service migrations through `006_shared_number_attestation.sql`.
- Run practice-app migrations through
  `035_texting_attestation_and_consent_evidence.sql`.
- Set `TEXTING_ALLOWED_RETURN_ORIGINS` to explicit practice app origins only.
- Configure database backups and restore testing for the hosted service.
- Configure service monitoring without PHI in logs, labels, or alerts.
- Confirm production API docs are disabled unless explicitly enabled.

## Stripe Work

- Confirm the test price created by lookup key
  `trellis_text_reminders_monthly_test`.
- Configure Stripe customer portal settings for payment method update and
  subscription cancellation.
- Verify webhook handling for:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Confirm only `active` and `trialing` allow SMS sends.
- Decide final live price and whether launch uses a trial period.

## Telnyx Work

- Confirm the Trellis LLC shared sender/campaign is approved for appointment
  reminders.
- Attach the shared number to the approved messaging profile.
- Verify Telnyx webhook signature validation with the real public key.
- Test HELP response from the shared number.
- Test STOP opt-out propagation back to a practice instance.
- Confirm Telnyx support workflows do not include PHI.

## Legal and Operations

- Attorney review of BAA text, shared-number attestation, SMS consent language,
  Privacy Policy, and Terms.
- Keep a signed-copy retention policy for agreement records.
- Finalize the support SOP and incident response workflow.
- Document offboarding: revoke install credential, stop sends, preserve required
  records, and return/destroy PHI where feasible.
- Decide how practices receive a copy of the signed BAA: print page only,
  email, downloadable PDF, or all three.

## End-to-End Staging Test

1. Owner opens `/settings/texting`.
2. Owner signs the BAA and shared-number attestation.
3. Hosted service opens Stripe checkout.
4. Stripe redirects back to `/settings/texting`.
5. Local app exchanges the return code for a credential.
6. Local status shows BAA signed, sender accepted, Stripe active, Telnyx ready.
7. Client intake records SMS reminder consent text/version.
8. Reminder sends through the hosted service and shared Telnyx number.
9. HELP receives the generic Trellis response.
10. STOP updates the matching local client to opted out.
11. Past-due/canceled Stripe state blocks future sends.

## Next Agent Pass

- Start with this file, `docs/texting-launch-checklist.md`, and
  `docs/texting-baa-stripe-flow.md`.
- First sweep for code quality and test gaps in `trellis-services/app/texting.py`
  and `trellis-app/backend/api/routes/texting.py`.
- Then sweep frontend UX in `TextingSetupPage.tsx`, `PracticeSettingsPage.tsx`,
  `ClientDetailPage.tsx`, and `IntakeForm.tsx`.
- Keep secrets out of files and final responses.

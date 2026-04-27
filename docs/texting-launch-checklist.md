# Texting Launch Checklist

Use this before enabling the Trellis LLC shared-number texting add-on for a real
practice.

## Legal and Policy

- Replace placeholder `TEXTING_BAA_TEXT` with counsel-approved Trellis LLC BAA.
- Set a non-draft `TEXTING_BAA_VERSION`.
- Confirm the shared-number attestation language is approved.
- Update public Terms/Privacy Policy for Trellis-hosted SMS reminders.
- Confirm support SOP and incident response workflow are in place.

## Hosted Service

- Deploy `trellis-services` under a Trellis LLC-controlled HTTPS domain.
- Run all hosted-service migrations.
- Run dependency audits (`npm audit --omit=dev` and `pip-audit`) before deploy.
- Set `TEXTING_ALLOWED_RETURN_ORIGINS` to explicit practice app origins.
- Set Stripe live/test keys through Secret Manager or equivalent, not source.
- Configure Stripe webhook endpoint `/v1/stripe/webhook`.
- Configure Telnyx webhook endpoint `/v1/telnyx/webhook`.
- Configure `TELNYX_PUBLIC_KEY` and verify webhook signatures in staging.
- Configure a scheduled call to `/v1/maintenance/text-message-logs/purge`
  with `MAINTENANCE_SECRET`.
- Enable database backups and restore testing.
- Enable service logs/alerts without PHI in message bodies or raw phone numbers.

## Stripe

- Create the Trellis Text Reminders subscription product and monthly price.
- Set `STRIPE_TEXTING_PRICE_ID`.
- Enable the Stripe customer portal for subscription cancellation/payment method
  updates.
- Confirm `active` and `trialing` are the only send-enabled states.
- Confirm `past_due`, `canceled`, `unpaid`, and `incomplete` block sends.

## Telnyx

- Register/approve the Trellis LLC sender/campaign for appointment reminders.
- Confirm the shared Telnyx number is assigned to the approved campaign.
- Confirm sample messages include opt-out language.
- Confirm HELP and STOP behavior in staging.
- Confirm Telnyx support tickets do not include PHI.

## End-to-End Test

1. Owner opens `/settings/texting`.
2. Owner signs BAA and shared-number attestation.
3. Stripe checkout returns to `/settings/texting`.
4. Local instance exchanges the code for a credential.
5. Client SMS consent is recorded with text/version.
6. Reminder sends through hosted service.
7. HELP receives generic support text.
8. STOP updates local client consent to opted out.
9. Subscription cancellation or past-due state blocks future sends.

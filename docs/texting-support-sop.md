# Texting Support SOP

This SOP applies when Trellis LLC helps a practice configure or troubleshoot the
hosted SMS reminder add-on.

## Rules

- Do not request PHI in tickets, email, screenshots, logs, or chat.
- Use install IDs, Stripe customer IDs, Telnyx message IDs, and timestamps for
  troubleshooting.
- If PHI is unavoidable, move to an approved secure channel and document why the
  access was minimum necessary.
- Do not ask for practice database credentials in plain text.
- Do not export client lists or message bodies from practice instances.
- Record support actions that involve customer environments.
- Escalate suspected unauthorized access, misdirected SMS, exposed credentials,
  or lost devices as security incidents.

## Standard Troubleshooting Flow

1. Confirm the practice has a signed Trellis LLC BAA and active Stripe
   subscription.
2. Confirm the practice accepted the shared-number attestation.
3. Check hosted-service account status by install ID.
4. Check Stripe state by customer or subscription ID.
5. Check Telnyx delivery by provider message ID only.
6. Confirm the local practice instance has client SMS consent recorded before
   sending reminders.
7. For STOP issues, use the phone hash callback trail rather than raw phone
   numbers where possible.

## Offboarding

When a practice cancels or terminates service:

1. Disable or revoke the hosted install credential.
2. Stop future hosted SMS sends for the account.
3. Keep agreement, billing, audit, and security records only as required.
4. Return or destroy PHI where feasible under the BAA.
5. Document completion.

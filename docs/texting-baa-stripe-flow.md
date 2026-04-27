# Texting BAA and Stripe Flow

This flow is for the Trellis-hosted SMS reminder add-on. The self-hosted
practice app stores only an install ID, onboarding secret, cached status, and an
encrypted hosted-service credential. The hosted service remains authoritative
for the practice BAA, Stripe subscription state, Telnyx delivery, and opt-out
callbacks.

## Portal Flow

1. The practice owner opens Settings -> Text reminders.
2. The local app calls `/api/texting/onboarding/start`.
3. The hosted service shows the Trellis text messaging BAA. If the current BAA is
   already signed and the shared-number attestation is accepted, the hosted
   service skips re-signing and presents Stripe checkout.
4. After Stripe returns to the hosted service, the hosted service redirects back
   to `/settings/texting` with a one-time exchange code.
5. The local app exchanges that code for a hosted-service credential and stores
   the credential encrypted.
6. SMS reminders are sent only through approved templates and only after local
   client SMS consent is recorded.
7. HELP replies receive a generic Trellis assistance response. STOP replies are
   synced back to every matching practice install by phone hash.

## Compliance Design Notes

- Telnyx publicly says its services generally fall within HIPAA's conduit
  exception, while its HIPAA architecture guidance separately addresses
  customers who have or plan to enter a BAA with Telnyx for HIPAA-eligible
  services.
- Trellis should not depend on Telnyx signing a BAA to make the add-on safe. The
  hosted Trellis service should keep SMS content minimum-necessary, avoid storing
  message bodies or phone numbers, validate Telnyx webhooks, and avoid PHI in
  Telnyx support tickets.
- Trellis, as the managed service provider for practices, should still execute a
  BAA with each covered-entity practice before enabling the hosted SMS add-on.
- Production hosted-service deployment must set counsel-approved
  `TEXTING_BAA_TEXT`, a non-draft `TEXTING_BAA_VERSION`, Stripe keys, Telnyx
  keys, and `TEXTING_ALLOWED_RETURN_ORIGINS`.
- The v1 sender model uses one Trellis LLC/Telnyx shared number. Practices must
  accept the shared-number attestation before activation.

## Source Links

- Telnyx conduit exception position:
  https://support.telnyx.com/en/articles/3347891-hipaa-baas-and-the-conduit-exception
- Telnyx HIPAA architecture guidance:
  https://telnyx.com/resources/architecting-hipaa-telnyx
- HHS business associate guidance:
  https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html
- HHS cloud/conduit guidance:
  https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html

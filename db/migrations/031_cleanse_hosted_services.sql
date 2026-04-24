-- Migration 031: Remove unfinished hosted service artifacts
--
-- Cleans up database objects from the abandoned SMS, external RCM,
-- credentialing, Stripe/license, and trellis-services integration paths.
-- New installs no longer create these objects because the original migrations
-- have been removed.

BEGIN;

DROP TABLE IF EXISTS billing_sms_log CASCADE;
DROP TABLE IF EXISTS billing_communications CASCADE;
DROP TABLE IF EXISTS billing_payments CASCADE;
DROP TABLE IF EXISTS billing_claims CASCADE;
DROP TABLE IF EXISTS billing_accounts CASCADE;
DROP TABLE IF EXISTS credentialing_timeline_events CASCADE;
DROP TABLE IF EXISTS credentialing_documents CASCADE;
DROP TABLE IF EXISTS credentialing_payers CASCADE;

ALTER TABLE IF EXISTS practices
    DROP COLUMN IF EXISTS sms_enabled,
    DROP COLUMN IF EXISTS billing_api_key,
    DROP COLUMN IF EXISTS billing_service_url,
    DROP COLUMN IF EXISTS billing_auto_submit,
    DROP COLUMN IF EXISTS billing_last_poll_at,
    DROP COLUMN IF EXISTS licensed_features;

ALTER TABLE IF EXISTS clients
    DROP COLUMN IF EXISTS sms_opt_in;

ALTER TABLE IF EXISTS appointments
    DROP COLUMN IF EXISTS sms_reminder_sent_at;

DROP INDEX IF EXISTS idx_superbills_claim_status;
DROP INDEX IF EXISTS idx_superbills_claim_external_id;

ALTER TABLE IF EXISTS superbills
    DROP COLUMN IF EXISTS claim_external_id,
    DROP COLUMN IF EXISTS claim_status,
    DROP COLUMN IF EXISTS claim_submitted_at,
    DROP COLUMN IF EXISTS claim_adjudicated_at,
    DROP COLUMN IF EXISTS era_data;

COMMIT;

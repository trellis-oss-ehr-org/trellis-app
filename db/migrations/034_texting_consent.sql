-- 034_texting_consent.sql
-- Client SMS consent and independent text reminder idempotency.

BEGIN;

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS sms_consent_status TEXT;

UPDATE clients
SET sms_consent_status = 'unknown'
WHERE sms_consent_status IS NULL;

ALTER TABLE clients
    ALTER COLUMN sms_consent_status SET DEFAULT 'unknown',
    ALTER COLUMN sms_consent_status SET NOT NULL;

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS sms_consent_source TEXT,
    ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sms_consent_updated_by TEXT;

ALTER TABLE clients
    DROP CONSTRAINT IF EXISTS clients_sms_consent_status_check;

ALTER TABLE clients
    ADD CONSTRAINT clients_sms_consent_status_check
    CHECK (sms_consent_status IN ('unknown', 'consented', 'declined', 'opted_out'));

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS text_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_text_reminders
    ON appointments (scheduled_at)
    WHERE status = 'scheduled' AND text_reminder_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_sms_consent
    ON clients (firebase_uid)
    WHERE sms_consent_status = 'consented';

COMMIT;

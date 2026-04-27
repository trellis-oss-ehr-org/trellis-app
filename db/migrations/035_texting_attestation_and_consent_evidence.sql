-- Track shared Trellis number attestation and SMS consent text/version evidence.

BEGIN;

ALTER TABLE texting_connection
    ADD COLUMN IF NOT EXISTS shared_number_attestation_status TEXT;

UPDATE texting_connection
SET shared_number_attestation_status = 'not_accepted'
WHERE shared_number_attestation_status IS NULL;

ALTER TABLE texting_connection
    ALTER COLUMN shared_number_attestation_status SET DEFAULT 'not_accepted',
    ALTER COLUMN shared_number_attestation_status SET NOT NULL;

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS sms_consent_text TEXT,
    ADD COLUMN IF NOT EXISTS sms_consent_version TEXT;

COMMIT;

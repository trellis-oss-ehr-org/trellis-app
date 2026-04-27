-- Bind hosted texting onboarding to this deployed Trellis install.
--
-- install_id is a stable identifier, not an authenticator. The local app sends
-- onboarding_secret only from owner-authenticated setup/complete calls so the
-- hosted service can reject onboarding exchanges that know only install_id.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE texting_connection
    ADD COLUMN IF NOT EXISTS onboarding_secret TEXT;

UPDATE texting_connection
SET onboarding_secret = encode(gen_random_bytes(32), 'hex')
WHERE onboarding_secret IS NULL;

ALTER TABLE texting_connection
    ALTER COLUMN onboarding_secret SET DEFAULT encode(gen_random_bytes(32), 'hex'),
    ALTER COLUMN onboarding_secret SET NOT NULL;

COMMIT;

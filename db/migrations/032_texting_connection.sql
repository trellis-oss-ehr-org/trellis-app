-- Local connection state for Trellis-hosted text messaging.
--
-- The cloned app stores only its install identity, cached subscription status,
-- and the service credential returned after BAA + Stripe activation. The
-- hosted trellis-services backend remains authoritative for entitlement and
-- Telnyx delivery.

BEGIN;

CREATE TABLE IF NOT EXISTS install_identity (
    singleton    BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    install_id   UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO install_identity (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS texting_connection (
    singleton              BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    install_id             UUID NOT NULL,
    account_id             UUID,
    service_url            TEXT,
    credential_secret      TEXT,
    credential_key_prefix  TEXT,
    status                 TEXT NOT NULL DEFAULT 'not_started',
    baa_status             TEXT NOT NULL DEFAULT 'not_signed',
    shared_number_attestation_status TEXT NOT NULL DEFAULT 'not_accepted',
    subscription_status    TEXT NOT NULL DEFAULT 'not_started',
    telnyx_status          TEXT NOT NULL DEFAULT 'not_provisioned',
    last_error             TEXT,
    last_synced_at         TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO texting_connection (singleton, install_id)
SELECT true, install_id FROM install_identity WHERE singleton = true
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_texting_connection_updated ON texting_connection;
CREATE TRIGGER trg_texting_connection_updated
    BEFORE UPDATE ON texting_connection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;

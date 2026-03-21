-- Migration 026: Add claim tracking columns to superbills
--
-- Tracks the external claim lifecycle when superbills are submitted through
-- the RCM service (trellis-services). Links each superbill to its external
-- claim ID, tracks status transitions, and stores ERA (remittance) data.

BEGIN;

ALTER TABLE superbills ADD COLUMN IF NOT EXISTS claim_external_id TEXT;
ALTER TABLE superbills ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'pending';
ALTER TABLE superbills ADD COLUMN IF NOT EXISTS claim_submitted_at TIMESTAMPTZ;
ALTER TABLE superbills ADD COLUMN IF NOT EXISTS claim_adjudicated_at TIMESTAMPTZ;
ALTER TABLE superbills ADD COLUMN IF NOT EXISTS era_data JSONB;

CREATE INDEX IF NOT EXISTS idx_superbills_claim_status ON superbills(claim_status);
CREATE INDEX IF NOT EXISTS idx_superbills_claim_external_id ON superbills(claim_external_id);

COMMIT;

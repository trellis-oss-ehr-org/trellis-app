-- Add billing service columns (referenced in db.py but not yet in schema)
-- These store the API key and URL for the external trellis-services server

ALTER TABLE practices ADD COLUMN IF NOT EXISTS billing_api_key TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS billing_service_url TEXT;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS billing_auto_submit BOOLEAN DEFAULT false;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS billing_last_poll_at TIMESTAMPTZ;
ALTER TABLE practices ADD COLUMN IF NOT EXISTS licensed_features JSONB DEFAULT '{}';

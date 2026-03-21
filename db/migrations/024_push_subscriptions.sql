-- Migration 024: Push notification subscriptions for appointment reminders
--
-- Stores FCM tokens per client device. Tokens rotate independently and stale
-- ones need individual cleanup, so this is a separate table (not JSONB on clients).
-- Also adds push_reminder_sent_at to appointments (matches sms_reminder_sent_at pattern).

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,  -- firebase_uid
    fcm_token TEXT NOT NULL,
    device_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (client_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_client_id ON push_subscriptions (client_id);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS push_reminder_sent_at TIMESTAMPTZ;

COMMIT;

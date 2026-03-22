-- 029_require_client_invite.sql
-- When enabled, only clients with a valid invitation can register

ALTER TABLE practices ADD COLUMN IF NOT EXISTS require_client_invite BOOLEAN NOT NULL DEFAULT false;

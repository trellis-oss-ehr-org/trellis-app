-- 027_context_compaction.sql
-- Rolling context compaction: persistent client portrait + per-encounter token tracking

-- Persistent compressed client portrait
ALTER TABLE clients ADD COLUMN IF NOT EXISTS context_summary TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS summary_version INTEGER NOT NULL DEFAULT 0;

-- Per-encounter token estimate and compaction tracking
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS token_estimate INTEGER;
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS summary_version INTEGER;

-- Index for efficient unsummarized encounter lookups
CREATE INDEX IF NOT EXISTS idx_encounters_unsummarized
    ON encounters (client_id, created_at)
    WHERE summary_version IS NULL AND transcript != '';

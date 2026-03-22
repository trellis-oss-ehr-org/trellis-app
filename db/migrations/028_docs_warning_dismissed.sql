-- 028_docs_warning_dismissed.sql
-- Flag to suppress the unsigned-documents warning for a specific client

ALTER TABLE clients ADD COLUMN IF NOT EXISTS docs_warning_dismissed BOOLEAN NOT NULL DEFAULT false;

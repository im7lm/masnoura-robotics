-- Rename sessions.publish_date to end_date (session end / expiry date)
ALTER TABLE sessions RENAME COLUMN publish_date TO end_date;

-- Add document_url to tasks (Google Docs / Word assignment instructions)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS document_url text;

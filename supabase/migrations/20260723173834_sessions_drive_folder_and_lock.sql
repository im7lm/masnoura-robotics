-- Rename video_url to drive_folder_url and add is_locked visibility toggle
ALTER TABLE sessions RENAME COLUMN video_url TO drive_folder_url;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

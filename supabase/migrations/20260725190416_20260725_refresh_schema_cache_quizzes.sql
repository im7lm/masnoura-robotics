/*
# Refresh schema cache — notify PostgREST of quizzes.start_datetime

PostgREST caches the schema on startup. After the column was added via
a previous migration, the cache may not have reloaded. This no-op
migration triggers a fresh schema introspection so the column is visible.

No structural changes — this is a cache-bust only.
*/

-- Confirm start_datetime exists and notify PostgREST via NOTIFY
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quizzes'
      AND column_name = 'start_datetime'
  ) THEN
    RAISE NOTICE 'quizzes.start_datetime confirmed present';
  ELSE
    -- Column missing — add it now as a safety net
    ALTER TABLE quizzes ADD COLUMN start_datetime timestamptz;
    RAISE NOTICE 'quizzes.start_datetime added';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

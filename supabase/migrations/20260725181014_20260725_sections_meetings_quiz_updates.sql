/*
# Sections, Meetings, and Quiz Updates

## Summary
This migration adds:

1. **Sections table** — sub-groups inside committees (e.g. "C Revision" inside "Embedded Systems").
   Members can optionally be assigned to a section within their committee.
   Management roles (team_leader, vice_team_leader, hr, director, admin) are NOT assigned to sections.

2. **section_id on members** — nullable foreign key so members can belong to a specific section.

3. **meetings table** — replaces attendance. Each meeting has title, description, date+time, a link,
   and belongs to a committee (and optionally a section). Flexible structure for future evaluation.

4. **meeting_attendance table** — tracks per-member presence at a meeting (present/late/absent).
   Mirrors old attendance so evaluation logic can be reused later.

5. **quizzes.start_datetime** — replaces the single `deadline` date with a proper start timestamp
   so the Google Form link is only accessible after the scheduled time.
   `deadline` is kept for backward-compat (used as the closing date).

6. **quizzes.description** — optional description field.

7. **quizzes.section_id** — optional link to a section.

## Security
All new tables have RLS enabled with authenticated-scoped policies using true (data is shared
within the team — access is controlled by the app's role checks, not per-row ownership).
*/

-- =========================================================
-- 1. SECTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sections_select" ON sections;
CREATE POLICY "sections_select" ON sections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sections_insert" ON sections;
CREATE POLICY "sections_insert" ON sections FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sections_update" ON sections;
CREATE POLICY "sections_update" ON sections FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sections_delete" ON sections;
CREATE POLICY "sections_delete" ON sections FOR DELETE TO authenticated USING (true);

-- =========================================================
-- 2. section_id on members (nullable — management roles skip it)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='members' AND column_name='section_id'
  ) THEN
    ALTER TABLE members ADD COLUMN section_id uuid REFERENCES sections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- 3. MEETINGS  (replaces attendance)
-- =========================================================
CREATE TABLE IF NOT EXISTS meetings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  section_id   uuid REFERENCES sections(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  meeting_link text,
  meeting_date date NOT NULL,
  meeting_time time NOT NULL DEFAULT '00:00:00',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_select" ON meetings;
CREATE POLICY "meetings_select" ON meetings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "meetings_insert" ON meetings;
CREATE POLICY "meetings_insert" ON meetings FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "meetings_update" ON meetings;
CREATE POLICY "meetings_update" ON meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "meetings_delete" ON meetings;
CREATE POLICY "meetings_delete" ON meetings FOR DELETE TO authenticated USING (true);

-- =========================================================
-- 4. MEETING ATTENDANCE
-- =========================================================
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'absent' CHECK (status IN ('present','late','absent')),
  recorded_at  timestamptz DEFAULT now(),
  UNIQUE (meeting_id, member_id)
);

ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_attendance_select" ON meeting_attendance;
CREATE POLICY "meeting_attendance_select" ON meeting_attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "meeting_attendance_insert" ON meeting_attendance;
CREATE POLICY "meeting_attendance_insert" ON meeting_attendance FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "meeting_attendance_update" ON meeting_attendance;
CREATE POLICY "meeting_attendance_update" ON meeting_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "meeting_attendance_delete" ON meeting_attendance;
CREATE POLICY "meeting_attendance_delete" ON meeting_attendance FOR DELETE TO authenticated USING (true);

-- =========================================================
-- 5. QUIZ UPDATES
-- =========================================================
DO $$
BEGIN
  -- start_datetime: when the quiz opens (before this, form is locked)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='quizzes' AND column_name='start_datetime'
  ) THEN
    ALTER TABLE quizzes ADD COLUMN start_datetime timestamptz;
  END IF;

  -- description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='quizzes' AND column_name='description'
  ) THEN
    ALTER TABLE quizzes ADD COLUMN description text;
  END IF;

  -- section_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='quizzes' AND column_name='section_id'
  ) THEN
    ALTER TABLE quizzes ADD COLUMN section_id uuid REFERENCES sections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- 6. SESSION section_id (optional — sessions can target a section)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sessions' AND column_name='section_id'
  ) THEN
    ALTER TABLE sessions ADD COLUMN section_id uuid REFERENCES sections(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =========================================================
-- 7. Enable realtime on new tables
-- =========================================================
DO $$
BEGIN
  BEGIN
    PERFORM pg_catalog.set_config('search_path', 'public', false);
    ALTER PUBLICATION supabase_realtime ADD TABLE sections;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE meeting_attendance;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

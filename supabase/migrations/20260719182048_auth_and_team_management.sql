/*
# Authentication & Team Management Architecture

## Summary
Transforms the app from a single-tenant prototype into a real authenticated SaaS platform.

## Changes
1. Add `user_id` column to `members` (links to auth.users)
2. Create RLS helper functions (current_member_id, current_member_role, is_admin, can_access_committee)
3. Drop ALL existing RLS policies on all public tables
4. Wipe ALL seed data (committees, members, sessions, tasks, etc.)
5. Create the default admin auth user (admin@nexus.edu / nexus2026)
6. Create the admin member record linked to the auth user
7. Create new RLS policies on ALL tables with committee-based access control
8. Recreate member_scores view with security_invoker=true (RLS applies to views)

## Security
- Admin: full access to everything
- Director: access to assigned committees only
- Team Leader / Vice TL: access to own committee, can create sessions/tasks/quizzes/announcements
- HR: access to own committee, can record attendance/scores/strikes/bonuses/notes
- Member: access to own committee, can submit tasks and view data
- User creation: only via edge function (service role), not via frontend RLS
*/

-- ============ Drop member_scores view ============
DROP VIEW IF EXISTS member_scores;

-- ============ Add user_id to members ============
DO $$ BEGIN
  ALTER TABLE members ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_key ON members(user_id) WHERE user_id IS NOT NULL;

-- ============ Helper functions for RLS ============
CREATE OR REPLACE FUNCTION current_member_id() RETURNS uuid AS $$
  SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_member_role() RETURNS text AS $$
  SELECT role FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_member_committee_id() RETURNS uuid AS $$
  SELECT committee_id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT current_member_role() = 'admin';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_access_committee(cid uuid) RETURNS boolean AS $$
  SELECT is_admin()
    OR (current_member_role() = 'director' AND EXISTS (
      SELECT 1 FROM director_committees dc
      WHERE dc.director_id = current_member_id() AND dc.committee_id = cid
    ))
    OR (current_member_committee_id() = cid AND cid IS NOT NULL);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============ Drop ALL existing RLS policies ============
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============ Wipe ALL seed data ============
DELETE FROM task_submissions;
DELETE FROM quiz_scores;
DELETE FROM attendance;
DELETE FROM strikes;
DELETE FROM bonuses;
DELETE FROM announcements;
DELETE FROM quizzes;
DELETE FROM tasks;
DELETE FROM sessions;
DELETE FROM director_committees;
DELETE FROM members;
DELETE FROM committees;

-- ============ Create admin auth user ============
DO $$
DECLARE admin_uid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@nexus.edu') THEN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role, raw_app_meta_data, raw_user_meta_data)
    VALUES (
      gen_random_uuid(),
      'admin@nexus.edu',
      crypt('nexus2026', gen_salt('bf')),
      now(),
      now(),
      now(),
      'authenticated',
      'authenticated',
      '{"role": "admin"}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO admin_uid;
  ELSE
    SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@nexus.edu';
    UPDATE auth.users SET encrypted_password = crypt('nexus2026', gen_salt('bf')), email_confirmed_at = now() WHERE email = 'admin@nexus.edu';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM members WHERE email = 'admin@nexus.edu') THEN
    INSERT INTO members (name, email, user_id, position, role, status, join_date, notes)
    VALUES ('General Team Leader', 'admin@nexus.edu', admin_uid, 'General Team Leader', 'admin', 'active', CURRENT_DATE, '[]'::jsonb);
  ELSE
    UPDATE members SET user_id = admin_uid, role = 'admin', position = 'General Team Leader' WHERE email = 'admin@nexus.edu';
  END IF;
END $$;

-- ============ RLS POLICIES ============

-- COMMITTEES
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_committees" ON committees FOR SELECT TO authenticated USING (is_admin() OR can_access_committee(id));
CREATE POLICY "insert_committees" ON committees FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "update_committees" ON committees FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "delete_committees" ON committees FOR DELETE TO authenticated USING (is_admin());

-- MEMBERS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_members" ON members FOR SELECT TO authenticated USING (
  is_admin()
  OR (current_member_role() = 'director' AND can_access_committee(committee_id))
  OR (committee_id = current_member_committee_id() AND committee_id IS NOT NULL)
);
CREATE POLICY "insert_members" ON members FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "update_members" ON members FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "delete_members" ON members FOR DELETE TO authenticated USING (is_admin());

-- DIRECTOR_COMMITTEES
ALTER TABLE director_committees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_director_committees" ON director_committees FOR SELECT TO authenticated USING (
  is_admin() OR (current_member_role() = 'director' AND director_id = current_member_id())
);
CREATE POLICY "insert_director_committees" ON director_committees FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "update_director_committees" ON director_committees FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "delete_director_committees" ON director_committees FOR DELETE TO authenticated USING (is_admin());

-- SESSIONS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sessions" ON sessions FOR SELECT TO authenticated USING (can_access_committee(committee_id));
CREATE POLICY "insert_sessions" ON sessions FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "update_sessions" ON sessions FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "delete_sessions" ON sessions FOR DELETE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);

-- TASKS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_tasks" ON tasks FOR SELECT TO authenticated USING (can_access_committee(committee_id));
CREATE POLICY "insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "update_tasks" ON tasks FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "delete_tasks" ON tasks FOR DELETE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);

-- QUIZZES
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_quizzes" ON quizzes FOR SELECT TO authenticated USING (can_access_committee(committee_id));
CREATE POLICY "insert_quizzes" ON quizzes FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "update_quizzes" ON quizzes FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "delete_quizzes" ON quizzes FOR DELETE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);

-- ANNOUNCEMENTS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_announcements" ON announcements FOR SELECT TO authenticated USING (can_access_committee(committee_id));
CREATE POLICY "insert_announcements" ON announcements FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader','hr') AND committee_id = current_member_committee_id())
);
CREATE POLICY "update_announcements" ON announcements FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader','hr') AND committee_id = current_member_committee_id())
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader','hr') AND committee_id = current_member_committee_id())
);
CREATE POLICY "delete_announcements" ON announcements FOR DELETE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('team_leader','vice_team_leader','hr') AND committee_id = current_member_committee_id())
);

-- ATTENDANCE
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_attendance" ON attendance FOR SELECT TO authenticated USING (can_access_committee(committee_id));
CREATE POLICY "insert_attendance" ON attendance FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "update_attendance" ON attendance FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND committee_id = current_member_committee_id())
);
CREATE POLICY "delete_attendance" ON attendance FOR DELETE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader') AND committee_id = current_member_committee_id())
);

-- TASK_SUBMISSIONS
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_task_submissions" ON task_submissions FOR SELECT TO authenticated USING (
  is_admin() OR can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id))
);
CREATE POLICY "insert_task_submissions" ON task_submissions FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR auth.uid() = (SELECT user_id FROM members WHERE id = member_id)
);
CREATE POLICY "update_task_submissions" ON task_submissions FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id)))
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id)))
);
CREATE POLICY "delete_task_submissions" ON task_submissions FOR DELETE TO authenticated USING (is_admin());

-- QUIZ_SCORES
ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_quiz_scores" ON quiz_scores FOR SELECT TO authenticated USING (
  is_admin() OR can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id))
);
CREATE POLICY "insert_quiz_scores" ON quiz_scores FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id)))
);
CREATE POLICY "update_quiz_scores" ON quiz_scores FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id)))
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id)))
);
CREATE POLICY "delete_quiz_scores" ON quiz_scores FOR DELETE TO authenticated USING (is_admin());

-- STRIKES
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_strikes" ON strikes FOR SELECT TO authenticated USING (
  is_admin() OR can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
);
CREATE POLICY "insert_strikes" ON strikes FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id)))
);
CREATE POLICY "update_strikes" ON strikes FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id)))
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id)))
);
CREATE POLICY "delete_strikes" ON strikes FOR DELETE TO authenticated USING (is_admin());

-- BONUSES
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_bonuses" ON bonuses FOR SELECT TO authenticated USING (
  is_admin() OR can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
);
CREATE POLICY "insert_bonuses" ON bonuses FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id)))
);
CREATE POLICY "update_bonuses" ON bonuses FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id)))
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id)))
);
CREATE POLICY "delete_bonuses" ON bonuses FOR DELETE TO authenticated USING (is_admin());

-- ============ Recreate member_scores view with security_invoker ============
CREATE VIEW member_scores WITH (security_invoker = true) AS
SELECT
  m.id AS member_id, m.name, m.committee_id, m.role, m.position,
  COALESCE(att.attendance_points, 0) AS attendance_points,
  COALESCE(tsk.task_points, 0) AS task_points,
  COALESCE(qz.quiz_points, 0) AS quiz_points,
  COALESCE(b.bonus_points, 0) AS bonus_points,
  COALESCE(st.strike_points, 0) AS strike_points,
  COALESCE(att.attendance_points, 0) + COALESCE(tsk.task_points, 0) + COALESCE(qz.quiz_points, 0) + COALESCE(b.bonus_points, 0) - COALESCE(st.strike_points, 0) AS total_points,
  COALESCE(att.present_count, 0) AS present_count,
  COALESCE(att.late_count, 0) AS late_count,
  COALESCE(att.absent_count, 0) AS absent_count,
  COALESCE(att.total_meetings, 0) AS total_meetings,
  CASE WHEN COALESCE(att.total_meetings, 0) = 0 THEN 0
       ELSE ROUND(100.0 * (COALESCE(att.present_count, 0) + COALESCE(att.late_count, 0) * 0.5) / att.total_meetings) END AS attendance_rate,
  COALESCE(tsk.tasks_completed, 0) AS tasks_completed,
  COALESCE(qz.quizzes_completed, 0) AS quizzes_completed
FROM members m
LEFT JOIN (
  SELECT member_id,
    SUM(CASE status WHEN 'present' THEN 10 WHEN 'late' THEN 5 ELSE 0 END) AS attendance_points,
    COUNT(*) AS total_meetings,
    COUNT(*) FILTER (WHERE status = 'present') AS present_count,
    COUNT(*) FILTER (WHERE status = 'late') AS late_count,
    COUNT(*) FILTER (WHERE status = 'absent') AS absent_count
  FROM attendance GROUP BY member_id
) att ON att.member_id = m.id
LEFT JOIN (
  SELECT member_id, SUM(score + bonus) AS task_points, COUNT(*) AS tasks_completed
  FROM task_submissions WHERE submitted_at IS NOT NULL GROUP BY member_id
) tsk ON tsk.member_id = m.id
LEFT JOIN (
  SELECT member_id, SUM(score + bonus) AS quiz_points, COUNT(*) AS quizzes_completed
  FROM quiz_scores GROUP BY member_id
) qz ON qz.member_id = m.id
LEFT JOIN (SELECT member_id, SUM(points) AS bonus_points FROM bonuses GROUP BY member_id) b ON b.member_id = m.id
LEFT JOIN (SELECT member_id, SUM(points) AS strike_points FROM strikes GROUP BY member_id) st ON st.member_id = m.id;

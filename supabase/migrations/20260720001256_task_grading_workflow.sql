-- Task grading workflow: store manual grades (points, bonus, leader note) per member per task.
-- Replaces reliance on task_submissions for scoring. task_submissions kept for backward compat.

CREATE TABLE IF NOT EXISTS task_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  bonus integer NOT NULL DEFAULT 0,
  leader_note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (task_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_task_grades_task ON task_grades(task_id);
CREATE INDEX IF NOT EXISTS idx_task_grades_member ON task_grades(member_id);

ALTER TABLE task_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_task_grades" ON task_grades;
CREATE POLICY "select_task_grades" ON task_grades FOR SELECT TO authenticated USING (
  is_admin() OR can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id))
);

DROP POLICY IF EXISTS "insert_task_grades" ON task_grades;
CREATE POLICY "insert_task_grades" ON task_grades FOR INSERT TO authenticated WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id)))
);

DROP POLICY IF EXISTS "update_task_grades" ON task_grades;
CREATE POLICY "update_task_grades" ON task_grades FOR UPDATE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id)))
) WITH CHECK (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id)))
);

DROP POLICY IF EXISTS "delete_task_grades" ON task_grades;
CREATE POLICY "delete_task_grades" ON task_grades FOR DELETE TO authenticated USING (
  is_admin() OR (current_member_role() IN ('hr','team_leader','vice_team_leader') AND can_access_committee((SELECT committee_id FROM tasks WHERE id = task_id)))
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_task_grades_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_grades_updated ON task_grades;
CREATE TRIGGER trg_task_grades_updated BEFORE UPDATE ON task_grades
  FOR EACH ROW EXECUTE FUNCTION set_task_grades_updated_at();

-- Recreate member_scores view to use task_grades instead of task_submissions
DROP VIEW IF EXISTS member_scores;

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
  SELECT member_id, SUM(points + bonus) AS task_points, COUNT(*) AS tasks_completed
  FROM task_grades GROUP BY member_id
) tsk ON tsk.member_id = m.id
LEFT JOIN (
  SELECT member_id, SUM(score + bonus) AS quiz_points, COUNT(*) AS quizzes_completed
  FROM quiz_scores GROUP BY member_id
) qz ON qz.member_id = m.id
LEFT JOIN (SELECT member_id, SUM(points) AS bonus_points FROM bonuses GROUP BY member_id) b ON b.member_id = m.id
LEFT JOIN (SELECT member_id, SUM(points) AS strike_points FROM strikes GROUP BY member_id) st ON st.member_id = m.id;

/*
# Committee Workspace Architecture (final)

Drops the old member_scores view (incompatible column set) and recreates it with
the new columns (position added). All other schema changes and seed data were
applied in the prior migration runs of this same filename.
*/

DROP VIEW IF EXISTS member_scores;

CREATE VIEW member_scores AS
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

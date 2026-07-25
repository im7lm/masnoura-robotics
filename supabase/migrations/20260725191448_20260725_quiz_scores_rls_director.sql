-- Fix quiz_scores RLS: add director role to insert/update/delete
-- Matches the same permission pattern as task_grades

DROP POLICY IF EXISTS "insert_quiz_scores" ON quiz_scores;
CREATE POLICY "insert_quiz_scores" ON quiz_scores FOR INSERT TO authenticated WITH CHECK (
  is_admin()
  OR (
    current_member_role() IN ('hr','team_leader','vice_team_leader','director')
    AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id))
  )
);

DROP POLICY IF EXISTS "update_quiz_scores" ON quiz_scores;
CREATE POLICY "update_quiz_scores" ON quiz_scores FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (
    current_member_role() IN ('hr','team_leader','vice_team_leader','director')
    AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id))
  )
)
WITH CHECK (
  is_admin()
  OR (
    current_member_role() IN ('hr','team_leader','vice_team_leader','director')
    AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id))
  )
);

DROP POLICY IF EXISTS "delete_quiz_scores" ON quiz_scores;
CREATE POLICY "delete_quiz_scores" ON quiz_scores FOR DELETE TO authenticated USING (
  is_admin()
  OR (
    current_member_role() IN ('hr','team_leader','vice_team_leader','director')
    AND can_access_committee((SELECT committee_id FROM quizzes WHERE id = quiz_id))
  )
);

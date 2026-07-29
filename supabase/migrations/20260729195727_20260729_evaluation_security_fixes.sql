-- ============ Update can_access_committee to include HR via committee_hr ============
CREATE OR REPLACE FUNCTION can_access_committee(cid uuid) RETURNS boolean AS $$
  SELECT is_admin()
    OR (current_member_role() = 'director' AND EXISTS (
      SELECT 1 FROM director_committees dc
      WHERE dc.director_id = current_member_id() AND dc.committee_id = cid
    ))
    OR (current_member_role() = 'hr' AND EXISTS (
      SELECT 1 FROM committee_hr ch
      WHERE ch.hr_id = current_member_id() AND ch.committee_id = cid
    ))
    OR (current_member_committee_id() = cid AND cid IS NOT NULL);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============ STRIKES: replace open policy with proper CRUD ============
DROP POLICY IF EXISTS "anon_crud_strikes" ON strikes;
DROP POLICY IF EXISTS "select_strikes" ON strikes;
DROP POLICY IF EXISTS "insert_strikes" ON strikes;
DROP POLICY IF EXISTS "update_strikes" ON strikes;
DROP POLICY IF EXISTS "delete_strikes" ON strikes;

CREATE POLICY "select_strikes" ON strikes FOR SELECT TO authenticated USING (
  is_admin()
  OR current_member_id() = member_id
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

CREATE POLICY "insert_strikes" ON strikes FOR INSERT TO authenticated WITH CHECK (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

CREATE POLICY "update_strikes" ON strikes FOR UPDATE TO authenticated USING (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
) WITH CHECK (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

CREATE POLICY "delete_strikes" ON strikes FOR DELETE TO authenticated USING (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

-- ============ BONUSES: replace open policy with proper CRUD ============
DROP POLICY IF EXISTS "anon_crud_bonuses" ON bonuses;
DROP POLICY IF EXISTS "select_bonuses" ON bonuses;
DROP POLICY IF EXISTS "insert_bonuses" ON bonuses;
DROP POLICY IF EXISTS "update_bonuses" ON bonuses;
DROP POLICY IF EXISTS "delete_bonuses" ON bonuses;

CREATE POLICY "select_bonuses" ON bonuses FOR SELECT TO authenticated USING (
  is_admin()
  OR current_member_id() = member_id
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

CREATE POLICY "insert_bonuses" ON bonuses FOR INSERT TO authenticated WITH CHECK (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

CREATE POLICY "update_bonuses" ON bonuses FOR UPDATE TO authenticated USING (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
) WITH CHECK (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

CREATE POLICY "delete_bonuses" ON bonuses FOR DELETE TO authenticated USING (
  is_admin()
  OR (
    current_member_role() IN ('director', 'hr', 'team_leader', 'vice_team_leader')
    AND can_access_committee((SELECT committee_id FROM members WHERE id = member_id))
  )
);

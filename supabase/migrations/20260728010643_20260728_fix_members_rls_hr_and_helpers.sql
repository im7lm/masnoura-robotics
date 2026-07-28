/*
# Fix members RLS + helper functions for HR role

## Root Cause
The `select_members` RLS policy has three branches:
  1. is_admin()
  2. role = 'director' AND can_access_committee(committee_id)
  3. committee_id = current_member_committee_id() AND committee_id IS NOT NULL

HR users fail ALL three because:
- They are not admins.
- They are not directors.
- Their `committee_id` in the members table is NULL (HR-to-committee links live in
  the `committee_hr` junction table, not in members.committee_id).

This means `auth.uid()` can never resolve to a member row for HR users, so:
- `current_member_role()` returns NULL for HR users.
- `is_admin()` returns false.
- `profile` in the frontend is null after login.
- The UI falls back to role = "member" and shows the wrong navigation.

## Changes

### 1. select_members policy
Added a self-read branch: `auth.uid() = user_id`
Every authenticated user can always read their own row in the members table.
This is the minimal, correct fix — it does not over-expose other users' rows.

### 2. current_member_committee_id() helper function
The old implementation returned `committee_id FROM members WHERE user_id = auth.uid()`.
For HR users this was always NULL because HR committee assignments live in committee_hr.
The new implementation:
- First tries members.committee_id (works for member, team_leader, vice_team_leader).
- If NULL, checks committee_hr for the first committee this HR is assigned to.
This means HR-scoped policies (attendance, evaluation, etc.) now resolve the correct
committee_id for HR users.

### 3. No data changes
No rows are modified. All existing policies continue to work unchanged for other roles.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix select_members: add self-read so every user can see their own row
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "select_members" ON members;
CREATE POLICY "select_members" ON members FOR SELECT
TO authenticated
USING (
  -- Every user can always read their own profile row
  auth.uid() = user_id
  OR is_admin()
  OR (
    current_member_role() = 'director'
    AND can_access_committee(committee_id)
  )
  OR (
    committee_id = current_member_committee_id()
    AND committee_id IS NOT NULL
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix current_member_committee_id() to work for HR users
--    HR users have committee_id = NULL in members; their committees are in
--    the committee_hr junction table.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_member_committee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Primary: direct committee assignment (member, TL, VTL, etc.)
    (SELECT committee_id FROM members WHERE user_id = auth.uid() LIMIT 1),
    -- Fallback: first HR committee assignment via junction table
    (SELECT ch.committee_id
     FROM committee_hr ch
     JOIN members m ON m.id = ch.hr_id
     WHERE m.user_id = auth.uid()
     LIMIT 1)
  );
$$;

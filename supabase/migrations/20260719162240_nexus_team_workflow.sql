/*
# Nexus Team Workflow Schema

Redesigns the database for a university student team internal portal with a real
daily-work workflow: Sessions, educational Tasks, Quizzes, Attendance, an
auto-calculating Evaluation system, and a Leaderboard.

## 1. New Tables

- `committees` — functional committees (Tech, Media, PR, R&D). Columns: id, name, color, created_at.
- `members` — people in the org. Columns: id, name, email, phone, avatar_url, committee_id (FK), position, role (admin/hr/team_leader/member), join_date, status (active/on_leave/inactive), notes (jsonb array of leader notes).
- `sessions` — recurring learning sessions. Columns: id, title, description, video_url, publish_date, committee_id (nullable for org-wide).
- `tasks` — educational assignments. Columns: id, session_id (FK nullable), title, description, deadline, submission_type (google_form/external_link/file_upload), submission_url, created_at.
- `quizzes` — quizzes tied to sessions. Columns: id, session_id (FK nullable), title, deadline, form_url, created_at.
- `task_submissions` — a member's submission for a task. Columns: id, task_id, member_id, submitted_at, link, score (0-10), bonus (default 0). Unique (task_id, member_id).
- `quiz_scores` — HR-entered quiz score per member. Columns: id, quiz_id, member_id, score (0-10), bonus (default 0), recorded_at. Unique (quiz_id, member_id).
- `attendance` — HR-recorded meeting attendance. Columns: id, session_id, member_id, status (present/late/absent), recorded_at. Unique (session_id, member_id).
- `strikes` — penalties. Columns: id, member_id, reason, date, points (default 5).
- `bonuses` — extra points. Columns: id, member_id, reason, points, date.
- `announcements` — org announcements. Columns: id, author_id (FK members), title, body, image_url, file_url, link_url, pinned (bool), created_at.

## 2. Scoring (computed in `member_scores` view)

Final Score = Attendance Points + Task Points + Quiz Points + Bonus Points - Strike Points
- Attendance: present = 10, late = 5, absent = 0
- Task Points = SUM(task_submissions.score + bonus)
- Quiz Points = SUM(quiz_scores.score + bonus)
- Bonus Points = SUM(bonuses.points)
- Strike Points = SUM(strikes.points)

## 3. Views

- `member_scores` — per-member aggregate: total_points, attendance_points, task_points, quiz_points, bonus_points, strike_points, present/late/absent counts, tasks_completed, quizzes_completed, attendance_rate.

## 4. Security

Single-tenant internal portal prototype (no sign-in screen). RLS enabled on every
table with open CRUD policies for `anon, authenticated` because the data is
intentionally shared across the team for this prototype. A role switcher in the UI
simulates the authenticated role.
*/

-- ============ COMMITTEES ============
CREATE TABLE IF NOT EXISTS committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#E53935',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_committees" ON committees;
CREATE POLICY "anon_crud_committees" ON committees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ MEMBERS ============
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar_url text,
  committee_id uuid REFERENCES committees(id) ON DELETE SET NULL,
  position text NOT NULL DEFAULT 'Member',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','hr','team_leader','member')),
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','inactive')),
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_members" ON members;
CREATE POLICY "anon_crud_members" ON members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ SESSIONS ============
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text,
  publish_date date NOT NULL DEFAULT CURRENT_DATE,
  committee_id uuid REFERENCES committees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_sessions" ON sessions;
CREATE POLICY "anon_crud_sessions" ON sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ TASKS ============
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  deadline date NOT NULL,
  submission_type text NOT NULL DEFAULT 'google_form' CHECK (submission_type IN ('google_form','external_link','file_upload')),
  submission_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_tasks" ON tasks;
CREATE POLICY "anon_crud_tasks" ON tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ QUIZZES ============
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  deadline date NOT NULL,
  form_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_quizzes" ON quizzes;
CREATE POLICY "anon_crud_quizzes" ON quizzes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ TASK SUBMISSIONS ============
CREATE TABLE IF NOT EXISTS task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  submitted_at timestamptz,
  link text,
  score numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (task_id, member_id)
);
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_task_submissions" ON task_submissions;
CREATE POLICY "anon_crud_task_submissions" ON task_submissions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ QUIZ SCORES ============
CREATE TABLE IF NOT EXISTS quiz_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz DEFAULT now(),
  UNIQUE (quiz_id, member_id)
);
ALTER TABLE quiz_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_quiz_scores" ON quiz_scores;
CREATE POLICY "anon_crud_quiz_scores" ON quiz_scores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ ATTENDANCE ============
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'absent' CHECK (status IN ('present','late','absent')),
  recorded_at timestamptz DEFAULT now(),
  UNIQUE (session_id, member_id)
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_attendance" ON attendance;
CREATE POLICY "anon_crud_attendance" ON attendance FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ STRIKES ============
CREATE TABLE IF NOT EXISTS strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  points numeric NOT NULL DEFAULT 5
);
ALTER TABLE strikes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_strikes" ON strikes;
CREATE POLICY "anon_crud_strikes" ON strikes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ BONUSES ============
CREATE TABLE IF NOT EXISTS bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reason text NOT NULL,
  points numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE
);
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_bonuses" ON bonuses;
CREATE POLICY "anon_crud_bonuses" ON bonuses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES members(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  file_url text,
  link_url text,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_announcements" ON announcements;
CREATE POLICY "anon_crud_announcements" ON announcements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ MEMBER_SCORES VIEW ============
CREATE OR REPLACE VIEW member_scores AS
SELECT
  m.id AS member_id,
  m.name,
  m.committee_id,
  m.role,
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

-- ============ SEED: COMMITTEES ============
INSERT INTO committees (name, color) VALUES
  ('Tech', '#E53935'),
  ('Media', '#45A87A'),
  ('PR', '#3B82F6'),
  ('R&D', '#8B5CF6')
ON CONFLICT (name) DO NOTHING;

-- ============ SEED: MEMBERS ============
-- Use fixed UUIDs via gen_random_uuid; reference committees by name.
INSERT INTO members (name, email, phone, avatar_url, committee_id, position, role, join_date, status, notes) VALUES
  ('Omar Khalil', 'omar.khalil@nexus.edu', '+966 56 555 1212', 'https://i.pravatar.cc/120?u=omar', (SELECT id FROM committees WHERE name='Media'), 'President', 'admin', '2023-01-10', 'active', '[{"from":"Layla Saleh","date":"2026-07-01","text":"Strong leadership across committees."}]'),
  ('Sara Hassan', 'sara.hassan@nexus.edu', '+966 55 987 6543', 'https://i.pravatar.cc/120?u=sara', (SELECT id FROM committees WHERE name='R&D'), 'HR Director', 'hr', '2023-08-15', 'active', '[{"from":"Omar Khalil","date":"2026-06-20","text":"Excellent communication and fair evaluations."}]'),
  ('Ahmed Al-Rashid', 'ahmed.rashid@nexus.edu', '+966 50 123 4567', 'https://i.pravatar.cc/120?u=ahmed', (SELECT id FROM committees WHERE name='Tech'), 'Tech Lead', 'team_leader', '2023-09-02', 'active', '[{"from":"Sara Hassan","date":"2026-06-12","text":"Consistently delivers and mentors juniors."}]'),
  ('Layla Saleh', 'layla.saleh@nexus.edu', '+966 50 444 7788', 'https://i.pravatar.cc/120?u=layla', (SELECT id FROM committees WHERE name='PR'), 'PR Lead', 'team_leader', '2023-02-20', 'active', '[]'),
  ('Yusuf Nabil', 'yusuf.nabil@nexus.edu', '+966 53 222 3344', 'https://i.pravatar.cc/120?u=yusuf', (SELECT id FROM committees WHERE name='Tech'), 'Frontend Engineer', 'member', '2024-02-01', 'active', '[]'),
  ('Maya Tariq', 'maya.tariq@nexus.edu', '+966 59 111 9090', 'https://i.pravatar.cc/120?u=maya', (SELECT id FROM committees WHERE name='Media'), 'Graphic Designer', 'member', '2024-03-15', 'active', '[{"from":"Ahmed Al-Rashid","date":"2026-05-22","text":"Creative output has improved a lot."}]'),
  ('Khalid Mansour', 'khalid.mansour@nexus.edu', '+966 54 333 8800', 'https://i.pravatar.cc/120?u=khalid', (SELECT id FROM committees WHERE name='Tech'), 'Backend Engineer', 'member', '2023-10-05', 'on_leave', '[]'),
  ('Nora Faisal', 'nora.faisal@nexus.edu', '+966 58 777 1212', 'https://i.pravatar.cc/120?u=nora', (SELECT id FROM committees WHERE name='R&D'), 'Research Analyst', 'member', '2024-01-20', 'active', '[]'),
  ('Bilal Hadi', 'bilal.hadi@nexus.edu', '+966 51 666 4422', 'https://i.pravatar.cc/120?u=bilal', (SELECT id FROM committees WHERE name='Tech'), 'DevOps Engineer', 'member', '2024-04-12', 'active', '[]'),
  ('Zainab Adel', 'zainab.adel@nexus.edu', '+966 52 888 5566', 'https://i.pravatar.cc/120?u=zainab', (SELECT id FROM committees WHERE name='PR'), 'PR Specialist', 'member', '2023-11-08', 'active', '[]'),
  ('Faris Nabil', 'faris.nabil@nexus.edu', '+966 57 222 9911', 'https://i.pravatar.cc/120?u=faris', (SELECT id FROM committees WHERE name='Media'), 'Video Editor', 'member', '2024-05-01', 'inactive', '[{"from":"Sara Hassan","date":"2026-04-10","text":"Needs to improve attendance and responsiveness."}]'),
  ('Hala Mansour', 'hala.mansour@nexus.edu', '+966 53 444 6677', 'https://i.pravatar.cc/120?u=hala', (SELECT id FROM committees WHERE name='R&D'), 'Data Scientist', 'member', '2023-12-15', 'active', '[]')
ON CONFLICT (email) DO NOTHING;

-- ============ SEED: SESSIONS ============
INSERT INTO sessions (title, description, video_url, publish_date, committee_id) VALUES
  ('Intro to Web Development', 'Foundations of HTML, CSS and the DOM. Recording of the live session with walkthrough.', 'https://youtu.be/dQw4w9WgXcQ', '2026-06-10', (SELECT id FROM committees WHERE name='Tech')),
  ('Design Principles 101', 'Visual hierarchy, spacing, and color theory for new designers.', 'https://youtu.be/dQw4w9WgXcQ', '2026-06-17', (SELECT id FROM committees WHERE name='Media')),
  ('Effective Public Relations', 'How to write press releases and pitch to sponsors.', 'https://youtu.be/dQw4w9WgXcQ', '2026-06-24', (SELECT id FROM committees WHERE name='PR')),
  ('React Fundamentals', 'Components, hooks, and state management basics.', 'https://youtu.be/dQw4w9WgXcQ', '2026-07-01', (SELECT id FROM committees WHERE name='Tech')),
  ('Research Methodology', 'How to read and summarize academic papers.', 'https://youtu.be/dQw4w9WgXcQ', '2026-07-08', (SELECT id FROM committees WHERE name='R&D')),
  ('Advanced Git & Collaboration', 'Branching strategies, code review, and team workflows.', 'https://youtu.be/dQw4w9WgXcQ', '2026-07-15', NULL)
ON CONFLICT DO NOTHING;

-- ============ SEED: TASKS ============
INSERT INTO tasks (session_id, title, description, deadline, submission_type, submission_url) VALUES
  ((SELECT id FROM sessions WHERE title='Intro to Web Development'), 'Build a personal portfolio page', 'Create a single-page HTML/CSS portfolio and submit the link.', '2026-06-20', 'external_link', NULL),
  ((SELECT id FROM sessions WHERE title='Intro to Web Development'), 'CSS Flexbox exercises', 'Complete the Flexbox exercises Google Form.', '2026-06-18', 'google_form', 'https://forms.gle/flexbox-exercises'),
  ((SELECT id FROM sessions WHERE title='Design Principles 101'), 'Redesign a landing page', 'Pick a landing page and redesign it. Upload the Figma export file.', '2026-06-27', 'file_upload', NULL),
  ((SELECT id FROM sessions WHERE title='React Fundamentals'), 'Build a counter app', 'Build a React counter with hooks and submit your repo link.', '2026-07-08', 'external_link', NULL),
  ((SELECT id FROM sessions WHERE title='React Fundamentals'), 'React hooks quiz task', 'Fill the React hooks understanding Google Form.', '2026-07-10', 'google_form', 'https://forms.gle/react-hooks'),
  ((SELECT id FROM sessions WHERE title='Advanced Git & Collaboration'), 'Submit a pull request', 'Open a PR to the practice repo and paste the link.', '2026-07-22', 'external_link', NULL),
  ((SELECT id FROM sessions WHERE title='Research Methodology'), 'Summarize a paper', 'Upload a 1-page summary of the assigned paper.', '2026-07-15', 'file_upload', NULL),
  ((SELECT id FROM sessions WHERE title='Effective Public Relations'), 'Write a press release', 'Draft a press release for the fall event and submit the link.', '2026-07-05', 'external_link', NULL)
ON CONFLICT DO NOTHING;

-- ============ SEED: QUIZZES ============
INSERT INTO quizzes (session_id, title, deadline, form_url) VALUES
  ((SELECT id FROM sessions WHERE title='Intro to Web Development'), 'HTML & CSS Basics Quiz', '2026-06-22', 'https://forms.gle/html-css-quiz'),
  ((SELECT id FROM sessions WHERE title='Design Principles 101'), 'Design Theory Quiz', '2026-06-29', 'https://forms.gle/design-quiz'),
  ((SELECT id FROM sessions WHERE title='React Fundamentals'), 'React Hooks Quiz', '2026-07-12', 'https://forms.gle/react-quiz'),
  ((SELECT id FROM sessions WHERE title='Research Methodology'), 'Research Methods Quiz', '2026-07-17', 'https://forms.gle/research-quiz'),
  ((SELECT id FROM sessions WHERE title='Advanced Git & Collaboration'), 'Git Workflow Quiz', '2026-07-24', 'https://forms.gle/git-quiz')
ON CONFLICT DO NOTHING;

-- ============ SEED: ATTENDANCE (generated for all members x sessions) ============
DO $$
DECLARE
  s RECORD;
  m RECORD;
  st text;
  seed int := 0;
BEGIN
  FOR s IN SELECT id FROM sessions ORDER BY publish_date LOOP
    FOR m IN SELECT id FROM members ORDER BY created_at LOOP
      seed := seed + 1;
      -- deterministic pseudo distribution: most present, some late, few absent
      CASE
        WHEN (seed % 7 = 0) THEN st := 'absent';
        WHEN (seed % 4 = 0) THEN st := 'late';
        ELSE st := 'present';
      END CASE;
      INSERT INTO attendance (session_id, member_id, status)
      VALUES (s.id, m.id, st)
      ON CONFLICT (session_id, member_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============ SEED: TASK SUBMISSIONS ============
-- Submit a subset of tasks for active members with scores
INSERT INTO task_submissions (task_id, member_id, submitted_at, link, score, bonus)
SELECT t.id, m.id, t.deadline - (random()*3)::int, 'https://example.com/submission', (5 + (random()*5)::int), (random()*3)::int
FROM tasks t
CROSS JOIN members m
WHERE m.status = 'active'
  AND (random() < 0.55)
  AND NOT EXISTS (SELECT 1 FROM task_submissions ts WHERE ts.task_id = t.id AND ts.member_id = m.id)
ON CONFLICT (task_id, member_id) DO NOTHING;

-- ============ SEED: QUIZ SCORES ============
INSERT INTO quiz_scores (quiz_id, member_id, score, bonus)
SELECT q.id, m.id, (4 + (random()*6)::int), (random()*2)::int
FROM quizzes q
CROSS JOIN members m
WHERE m.status = 'active'
  AND (random() < 0.5)
  AND NOT EXISTS (SELECT 1 FROM quiz_scores qs WHERE qs.quiz_id = q.id AND qs.member_id = m.id)
ON CONFLICT (quiz_id, member_id) DO NOTHING;

-- ============ SEED: STRIKES ============
INSERT INTO strikes (member_id, reason, date, points)
SELECT id, 'Missed two consecutive deadlines', '2026-06-30', 5 FROM members WHERE name = 'Faris Nabil'
ON CONFLICT DO NOTHING;
INSERT INTO strikes (member_id, reason, date, points)
SELECT id, 'Disruptive during session', '2026-07-05', 3 FROM members WHERE name = 'Bilal Hadi'
ON CONFLICT DO NOTHING;

-- ============ SEED: BONUSES ============
INSERT INTO bonuses (member_id, reason, points, date)
SELECT id, 'Mentored three new members', 8, '2026-07-10' FROM members WHERE name = 'Ahmed Al-Rashid'
ON CONFLICT DO NOTHING;
INSERT INTO bonuses (member_id, reason, points, date)
SELECT id, 'Organized the design workshop', 6, '2026-07-12' FROM members WHERE name = 'Maya Tariq'
ON CONFLICT DO NOTHING;
INSERT INTO bonuses (member_id, reason, points, date)
SELECT id, 'Top contributor this month', 5, '2026-07-15' FROM members WHERE name = 'Hala Mansour'
ON CONFLICT DO NOTHING;

-- ============ SEED: ANNOUNCEMENTS ============
INSERT INTO announcements (author_id, title, body, image_url, file_url, link_url, pinned, created_at)
SELECT id, 'Welcome to the Fall 2026 Semester', 'Sessions restart this week. Check the Sessions page for your committee schedule and the first tasks.', 'https://images.pexels.com/photos/7988079/pexels-photo-7988079.jpeg?auto=compress&cs=tinysrgb&w=1200', NULL, NULL, true, '2026-07-19'
FROM members WHERE name = 'Omar Khalil'
ON CONFLICT DO NOTHING;
INSERT INTO announcements (author_id, title, body, image_url, file_url, link_url, pinned, created_at)
SELECT id, 'Evaluation Cycle Q3 Opens', 'HR will record attendance, task and quiz scores this week. Final scores update automatically on the Leaderboard.', NULL, 'https://example.com/evaluation-rubric.pdf', NULL, true, '2026-07-17'
FROM members WHERE name = 'Sara Hassan'
ON CONFLICT DO NOTHING;
INSERT INTO announcements (author_id, title, body, image_url, file_url, link_url, pinned, created_at)
SELECT id, 'Repository Migration Complete', 'All repos are now under the new GitHub organization. Re-authenticate with SSO.', NULL, NULL, 'https://github.com/nexus-team', false, '2026-07-15'
FROM members WHERE name = 'Ahmed Al-Rashid'
ON CONFLICT DO NOTHING;
INSERT INTO announcements (author_id, title, body, image_url, file_url, link_url, pinned, created_at)
SELECT id, 'Sponsor Deck v4 Published', 'PR committee, please use the updated deck for all outreach.', NULL, 'https://example.com/sponsor-deck-v4.pdf', NULL, false, '2026-07-12'
FROM members WHERE name = 'Layla Saleh'
ON CONFLICT DO NOTHING;

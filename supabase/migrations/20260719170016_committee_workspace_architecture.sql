/*
# Committee Workspace Architecture (complete)

Redesigns the schema around isolated Committee Workspaces with full Role-Based
Access Control.

## Changes
1. Committees: add `type` column (technical / non_technical).
2. Members: expand `role` CHECK to include `director` and `vice_team_leader`.
3. New `director_committees` join table (director -> many committees).
4. Add `committee_id` to tasks, quizzes, announcements, attendance.
5. Drop and recreate `member_scores` view (adds `position` column).
6. Wipe & re-seed: 9 committees, 49 members (5 per committee + 3 directors + 1 admin),
   18 sessions, 36 tasks, 18 quizzes, attendance, submissions, scores, strikes, bonuses,
   per-committee announcements, director assignments.
7. RLS: `anon, authenticated` CRUD on `director_committees` (single-tenant prototype).
*/

-- ============ Drop view FIRST so later CREATE doesn't conflict ============
DROP VIEW IF EXISTS member_scores;

-- ============ COMMITTEES: add type column ============
DO $$ BEGIN
  ALTER TABLE committees ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'technical' CHECK (type IN ('technical','non_technical'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============ MEMBERS: expand role CHECK ============
DO $$ BEGIN
  ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check;
  ALTER TABLE members ADD CONSTRAINT members_role_check CHECK (role IN ('admin','director','team_leader','vice_team_leader','hr','member'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============ DIRECTOR_COMMITTEES ============
CREATE TABLE IF NOT EXISTS director_committees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  committee_id uuid NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  UNIQUE (director_id, committee_id)
);
ALTER TABLE director_committees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_director_committees" ON director_committees;
CREATE POLICY "anon_crud_director_committees" ON director_committees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============ Add committee_id to content tables ============
DO $$ BEGIN
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS committee_id uuid REFERENCES committees(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS committee_id uuid REFERENCES committees(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE announcements ADD COLUMN IF NOT EXISTS committee_id uuid REFERENCES committees(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE attendance ADD COLUMN IF NOT EXISTS committee_id uuid REFERENCES committees(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============ WIPE & RESEED ============
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

-- Committees (9)
INSERT INTO committees (name, color, type) VALUES
  ('Embedded Systems', '#E53935', 'technical'),
  ('Robotics', '#F59E0B', 'technical'),
  ('Computer Science', '#3B82F6', 'technical'),
  ('Electronics', '#8B5CF6', 'technical'),
  ('Hardware', '#06B6D4', 'technical'),
  ('HR', '#45A87A', 'non_technical'),
  ('Media', '#EC4899', 'non_technical'),
  ('Organization', '#6366F1', 'non_technical'),
  ('PR', '#14B8A6', 'non_technical');

-- Members (cast types properly)
INSERT INTO members (name, email, phone, avatar_url, committee_id, position, role, join_date, status, notes)
SELECT v.name, v.email, v.phone, v.avatar, c.id, v.position, v.role::text, v.join_date::date, v.status::text, v.notes::jsonb
FROM (VALUES
  ('Yara Mansour','yara.mansour@nexus.edu','+966 50 111 0001','https://i.pravatar.cc/120?u=yara','Embedded Systems','Team Leader','team_leader','2023-09-01','active','[]'),
  ('Tarek Nabil','tarek.nabil@nexus.edu','+966 50 111 0002','https://i.pravatar.cc/120?u=tarek','Embedded Systems','Vice Team Leader','vice_team_leader','2023-09-05','active','[]'),
  ('Dina Fares','dina.fares@nexus.edu','+966 50 111 0003','https://i.pravatar.cc/120?u=dina','Embedded Systems','HR','hr','2023-09-10','active','[]'),
  ('Sami Orabi','sami.orabi@nexus.edu','+966 50 111 0004','https://i.pravatar.cc/120?u=sami','Embedded Systems','Member','member','2024-01-15','active','[]'),
  ('Lina Hadi','lina.hadi@nexus.edu','+966 50 111 0005','https://i.pravatar.cc/120?u=lina','Embedded Systems','Member','member','2024-02-01','active','[]'),
  ('Karim Adel','karim.adel@nexus.edu','+966 50 222 0001','https://i.pravatar.cc/120?u=karim','Robotics','Team Leader','team_leader','2023-08-20','active','[]'),
  ('Mona Saif','mona.saif@nexus.edu','+966 50 222 0002','https://i.pravatar.cc/120?u=mona','Robotics','Vice Team Leader','vice_team_leader','2023-08-25','active','[]'),
  ('Hana Rida','hana.rida@nexus.edu','+966 50 222 0003','https://i.pravatar.cc/120?u=hana','Robotics','HR','hr','2023-09-01','active','[]'),
  ('Omar Zaki','omar.zaki@nexus.edu','+966 50 222 0004','https://i.pravatar.cc/120?u=omarz','Robotics','Member','member','2024-01-10','active','[]'),
  ('Rana Tarek','rana.tarek@nexus.edu','+966 50 222 0005','https://i.pravatar.cc/120?u=rana','Robotics','Member','member','2024-03-01','on_leave','[]'),
  ('Ahmed Al-Rashid','ahmed.rashid@nexus.edu','+966 50 333 0001','https://i.pravatar.cc/120?u=ahmedr','Computer Science','Team Leader','team_leader','2023-09-02','active','[{"from":"Dina Fares","date":"2026-06-12","text":"Consistently delivers and mentors juniors."}]'),
  ('Salma Wael','salma.wael@nexus.edu','+966 50 333 0002','https://i.pravatar.cc/120?u=salma','Computer Science','Vice Team Leader','vice_team_leader','2023-09-08','active','[]'),
  ('Khaled Nour','khaled.nour@nexus.edu','+966 50 333 0003','https://i.pravatar.cc/120?u=khaled','Computer Science','HR','hr','2023-09-12','active','[]'),
  ('Yusuf Nabil','yusuf.nabil@nexus.edu','+966 50 333 0004','https://i.pravatar.cc/120?u=yusuf','Computer Science','Member','member','2024-02-01','active','[]'),
  ('Maya Tariq','maya.tariq@nexus.edu','+966 50 333 0005','https://i.pravatar.cc/120?u=maya','Computer Science','Member','member','2024-03-15','active','[]'),
  ('Bilal Hadi','bilal.hadi@nexus.edu','+966 50 444 0001','https://i.pravatar.cc/120?u=bilal','Electronics','Team Leader','team_leader','2023-10-05','active','[]'),
  ('Nour Amr','nour.amr@nexus.edu','+966 50 444 0002','https://i.pravatar.cc/120?u=nour','Electronics','Vice Team Leader','vice_team_leader','2023-10-10','active','[]'),
  ('Sara Hassan','sara.hassan@nexus.edu','+966 50 444 0003','https://i.pravatar.cc/120?u=sara','Electronics','HR','hr','2023-10-15','active','[]'),
  ('Fadi Walid','fadi.walid@nexus.edu','+966 50 444 0004','https://i.pravatar.cc/120?u=fadi','Electronics','Member','member','2024-01-20','active','[]'),
  ('Rim Saad','rim.saad@nexus.edu','+966 50 444 0005','https://i.pravatar.cc/120?u=rim','Electronics','Member','member','2024-04-01','active','[]'),
  ('Ziad Tarek','ziad.tarek@nexus.edu','+966 50 555 0001','https://i.pravatar.cc/120?u=ziad','Hardware','Team Leader','team_leader','2023-11-01','active','[]'),
  ('Asma Yasser','asma.yasser@nexus.edu','+966 50 555 0002','https://i.pravatar.cc/120?u=asma','Hardware','Vice Team Leader','vice_team_leader','2023-11-05','active','[]'),
  ('Layla Saleh','layla.saleh@nexus.edu','+966 50 555 0003','https://i.pravatar.cc/120?u=layla','Hardware','HR','hr','2023-11-10','active','[]'),
  ('Hassan Magdy','hassan.magdy@nexus.edu','+966 50 555 0004','https://i.pravatar.cc/120?u=hassan','Hardware','Member','member','2024-02-15','active','[]'),
  ('Faris Nabil','faris.nabil@nexus.edu','+966 50 555 0005','https://i.pravatar.cc/120?u=faris','Hardware','Member','member','2024-05-01','inactive','[{"from":"Layla Saleh","date":"2026-04-10","text":"Needs to improve attendance."}]'),
  ('Hala Mansour','hala.mansour@nexus.edu','+966 50 666 0001','https://i.pravatar.cc/120?u=hala','HR','Team Leader','team_leader','2023-12-01','active','[]'),
  ('Dalia Samir','dalia.samir@nexus.edu','+966 50 666 0002','https://i.pravatar.cc/120?u=dalia','HR','Vice Team Leader','vice_team_leader','2023-12-05','active','[]'),
  ('Menna Adel','menna.adel@nexus.edu','+966 50 666 0003','https://i.pravatar.cc/120?u=menna','HR','HR','hr','2023-12-10','active','[]'),
  ('Sara Adel','sara.adel@nexus.edu','+966 50 666 0004','https://i.pravatar.cc/120?u=saraa','HR','Member','member','2024-01-05','active','[]'),
  ('Yara Adel','yara.adel@nexus.edu','+966 50 666 0005','https://i.pravatar.cc/120?u=yaraa','HR','Member','member','2024-02-20','active','[]'),
  ('Maya Omar','maya.omar@nexus.edu','+966 50 777 0001','https://i.pravatar.cc/120?u=mayaom','Media','Team Leader','team_leader','2023-09-15','active','[]'),
  ('Rana Hadi','rana.hadi@nexus.edu','+966 50 777 0002','https://i.pravatar.cc/120?u=ranah','Media','Vice Team Leader','vice_team_leader','2023-09-20','active','[]'),
  ('Nada Wael','nada.wael@nexus.edu','+966 50 777 0003','https://i.pravatar.cc/120?u=nada','Media','HR','hr','2023-09-25','active','[]'),
  ('Farah Saif','farah.saif@nexus.edu','+966 50 777 0004','https://i.pravatar.cc/120?u=farah','Media','Member','member','2024-01-12','active','[]'),
  ('Lina Omar','lina.omar@nexus.edu','+966 50 777 0005','https://i.pravatar.cc/120?u=linao','Media','Member','member','2024-03-20','active','[]'),
  ('Omar Khalil','omar.khalil@nexus.edu','+966 50 888 0001','https://i.pravatar.cc/120?u=omark','Organization','Team Leader','team_leader','2023-01-10','active','[]'),
  ('Layla Omar','layla.omar@nexus.edu','+966 50 888 0002','https://i.pravatar.cc/120?u=laylao','Organization','Vice Team Leader','vice_team_leader','2023-02-01','active','[]'),
  ('Heba Nabil','heba.nabil@nexus.edu','+966 50 888 0003','https://i.pravatar.cc/120?u=heba','Organization','HR','hr','2023-02-10','active','[]'),
  ('Khalid Mansour','khalid.mansour@nexus.edu','+966 50 888 0004','https://i.pravatar.cc/120?u=khalid','Organization','Member','member','2023-10-05','on_leave','[]'),
  ('Nora Faisal','nora.faisal@nexus.edu','+966 50 888 0005','https://i.pravatar.cc/120?u=noraf','Organization','Member','member','2024-01-20','active','[]'),
  ('Zainab Adel','zainab.adel@nexus.edu','+966 50 999 0001','https://i.pravatar.cc/120?u=zainab','PR','Team Leader','team_leader','2023-11-08','active','[]'),
  ('Dina Omar','dina.omar@nexus.edu','+966 50 999 0002','https://i.pravatar.cc/120?u=dinao','PR','Vice Team Leader','vice_team_leader','2023-11-15','active','[]'),
  ('Salma Adel','salma.adel@nexus.edu','+966 50 999 0003','https://i.pravatar.cc/120?u=salmaa','PR','HR','hr','2023-11-20','active','[]'),
  ('Rana Adel','rana.adel@nexus.edu','+966 50 999 0004','https://i.pravatar.cc/120?u=ranaa','PR','Member','member','2024-02-10','active','[]'),
  ('Tarek Adel','tarek.adel@nexus.edu','+966 50 999 0005','https://i.pravatar.cc/120?u=tareka','PR','Member','member','2024-04-15','active','[]')
) AS v(name, email, phone, avatar, committee_name, position, role, join_date, status, notes)
JOIN committees c ON c.name = v.committee_name;

-- Directors (no committee)
INSERT INTO members (name, email, phone, avatar_url, committee_id, position, role, join_date, status, notes)
SELECT v.name, v.email, v.phone, v.avatar, NULL, v.position, 'director', '2023-01-01'::date, 'active', '[]'::jsonb
FROM (VALUES
  ('Sofia Karim','sofia.karim@nexus.edu','+966 50 000 0001','https://i.pravatar.cc/120?u=sofia','Software Director'),
  ('Adel Mansour','adel.mansour@nexus.edu','+966 50 000 0002','https://i.pravatar.cc/120?u=adel','Hardware Director'),
  ('Nadia Salem','nadia.salem@nexus.edu','+966 50 000 0003','https://i.pravatar.cc/120?u=nadia','Non-Technical Director')
) AS v(name, email, phone, avatar, position);

-- Admin
INSERT INTO members (name, email, phone, avatar_url, committee_id, position, role, join_date, status, notes)
VALUES ('Admin User','admin@nexus.edu','+966 50 000 0000','https://i.pravatar.cc/120?u=admin',NULL,'President','admin','2023-01-01'::date,'active','[]'::jsonb);

-- Director assignments
INSERT INTO director_committees (director_id, committee_id)
SELECT d.id, c.id FROM members d, committees c
WHERE d.name = 'Sofia Karim' AND c.name IN ('Embedded Systems','Computer Science','Robotics');
INSERT INTO director_committees (director_id, committee_id)
SELECT d.id, c.id FROM members d, committees c
WHERE d.name = 'Adel Mansour' AND c.name IN ('Electronics','Hardware');
INSERT INTO director_committees (director_id, committee_id)
SELECT d.id, c.id FROM members d, committees c
WHERE d.name = 'Nadia Salem' AND c.name IN ('HR','Media','Organization','PR');

-- ============ SESSIONS (2 per committee) ============
INSERT INTO sessions (title, description, video_url, publish_date, committee_id)
SELECT v.title, v.description, v.video, v.publish_date::date, c.id
FROM (VALUES
  ('Intro to Microcontrollers','Arduino & AVR basics, GPIO, timers.','https://youtu.be/dQw4w9WgXcQ','2026-06-10','Embedded Systems'),
  ('RTOS Fundamentals','Real-time scheduling and task priorities.','https://youtu.be/dQw4w9WgXcQ','2026-07-08','Embedded Systems'),
  ('Kinematics Basics','Forward and inverse kinematics for arms.','https://youtu.be/dQw4w9WgXcQ','2026-06-12','Robotics'),
  ('PID Control','Tuning PID for motor control.','https://youtu.be/dQw4w9WgXcQ','2026-07-10','Robotics'),
  ('React Fundamentals','Components, hooks, and state management.','https://youtu.be/dQw4w9WgXcQ','2026-06-15','Computer Science'),
  ('Advanced Git & Collaboration','Branching, code review, team workflows.','https://youtu.be/dQw4w9WgXcQ','2026-07-15','Computer Science'),
  ('Circuit Analysis','Ohms law, KVL/KCL, nodal analysis.','https://youtu.be/dQw4w9WgXcQ','2026-06-18','Electronics'),
  ('Op-Amp Applications','Filters, comparators, oscillators.','https://youtu.be/dQw4w9WgXcQ','2026-07-12','Electronics'),
  ('PCB Design 101','Schematic capture and layout in KiCad.','https://youtu.be/dQw4w9WgXcQ','2026-06-20','Hardware'),
  ('Power Electronics','Buck/boost converters and thermal design.','https://youtu.be/dQw4w9WgXcQ','2026-07-14','Hardware'),
  ('Effective Onboarding','Running a smooth new-member onboarding.','https://youtu.be/dQw4w9WgXcQ','2026-06-22','HR'),
  ('Evaluation Best Practices','Fair scoring and feedback.','https://youtu.be/dQw4w9WgXcQ','2026-07-16','HR'),
  ('Design Principles 101','Visual hierarchy, spacing, color theory.','https://youtu.be/dQw4w9WgXcQ','2026-06-17','Media'),
  ('Video Editing Workshop','Cuts, transitions, color grading.','https://youtu.be/dQw4w9WgXcQ','2026-07-11','Media'),
  ('Event Planning','From concept to execution.','https://youtu.be/dQw4w9WgXcQ','2026-06-25','Organization'),
  ('Team Coordination','Running weekly syncs that work.','https://youtu.be/dQw4w9WgXcQ','2026-07-18','Organization'),
  ('Effective Public Relations','Writing press releases and pitching sponsors.','https://youtu.be/dQw4w9WgXcQ','2026-06-24','PR'),
  ('Sponsorship Outreach','Building sponsor relationships.','https://youtu.be/dQw4w9WgXcQ','2026-07-13','PR')
) AS v(title, description, video, publish_date, committee_name)
JOIN committees c ON c.name = v.committee_name;

-- ============ TASKS (2 per session) ============
INSERT INTO tasks (session_id, title, description, deadline, submission_type, submission_url, committee_id)
SELECT s.id, v.title, v.description, v.deadline::date, v.submission_type, v.submission_url, s.committee_id
FROM (VALUES
  ('Intro to Microcontrollers','Blink an LED','Write Arduino code to blink an LED at 1Hz.','2026-06-20','external_link',NULL,'Intro to Microcontrollers'),
  ('Intro to Microcontrollers','GPIO Quiz Task','Complete the GPIO basics Google Form.','2026-06-18','google_form','https://forms.gle/gpio-basics','Intro to Microcontrollers'),
  ('RTOS Fundamentals','Implement a task scheduler','Build a cooperative scheduler with 3 tasks.','2026-07-20','external_link',NULL,'RTOS Fundamentals'),
  ('RTOS Fundamentals','Priority inversion exercise','Upload your analysis of the priority inversion case.','2026-07-18','file_upload',NULL,'RTOS Fundamentals'),
  ('Kinematics Basics','Compute forward kinematics','Submit a Python script computing end-effector position.','2026-06-25','external_link',NULL,'Kinematics Basics'),
  ('Kinematics Basics','Kinematics quiz','Fill the kinematics Google Form.','2026-06-22','google_form','https://forms.gle/kinematics-quiz','Kinematics Basics'),
  ('PID Control','Tune a PID controller','Submit your tuned gains and step response plot.','2026-07-20','file_upload',NULL,'PID Control'),
  ('PID Control','PID concepts quiz','Google Form quiz on PID theory.','2026-07-18','google_form','https://forms.gle/pid-quiz','PID Control'),
  ('React Fundamentals','Build a counter app','Build a React counter with hooks and submit your repo link.','2026-07-08','external_link',NULL,'React Fundamentals'),
  ('React Fundamentals','React hooks quiz task','Fill the React hooks understanding Google Form.','2026-07-10','google_form','https://forms.gle/react-hooks','React Fundamentals'),
  ('Advanced Git & Collaboration','Submit a pull request','Open a PR to the practice repo and paste the link.','2026-07-22','external_link',NULL,'Advanced Git & Collaboration'),
  ('Advanced Git & Collaboration','Git workflow quiz','Google Form quiz on git workflows.','2026-07-24','google_form','https://forms.gle/git-quiz','Advanced Git & Collaboration'),
  ('Circuit Analysis','Solve a KVL problem','Submit your worked solution PDF.','2026-06-28','file_upload',NULL,'Circuit Analysis'),
  ('Circuit Analysis','KVL/KCL quiz','Google Form quiz on KVL/KCL.','2026-06-26','google_form','https://forms.gle/kvl-quiz','Circuit Analysis'),
  ('Op-Amp Applications','Design an inverting amplifier','Submit your schematic and calculations.','2026-07-20','file_upload',NULL,'Op-Amp Applications'),
  ('Op-Amp Applications','Op-amp quiz','Google Form quiz on op-amps.','2026-07-18','google_form','https://forms.gle/opamp-quiz','Op-Amp Applications'),
  ('PCB Design 101','Layout a simple board','Upload your KiCad project file.','2026-06-30','file_upload',NULL,'PCB Design 101'),
  ('PCB Design 101','PCB basics quiz','Google Form quiz on PCB basics.','2026-06-28','google_form','https://forms.gle/pcb-quiz','PCB Design 101'),
  ('Power Electronics','Design a buck converter','Submit your schematic and efficiency calculation.','2026-07-22','external_link',NULL,'Power Electronics'),
  ('Power Electronics','Power electronics quiz','Google Form quiz.','2026-07-20','google_form','https://forms.gle/power-quiz','Power Electronics'),
  ('Effective Onboarding','Draft an onboarding plan','Submit a 1-page onboarding plan for new members.','2026-06-30','external_link',NULL,'Effective Onboarding'),
  ('Effective Onboarding','Onboarding quiz','Google Form quiz on onboarding principles.','2026-06-28','google_form','https://forms.gle/onboarding-quiz','Effective Onboarding'),
  ('Evaluation Best Practices','Score a sample member','Upload your evaluation of the sample profile.','2026-07-22','file_upload',NULL,'Evaluation Best Practices'),
  ('Evaluation Best Practices','Evaluation quiz','Google Form quiz on evaluation fairness.','2026-07-20','google_form','https://forms.gle/eval-quiz','Evaluation Best Practices'),
  ('Design Principles 101','Redesign a landing page','Pick a landing page and redesign it. Upload the Figma export.','2026-06-27','file_upload',NULL,'Design Principles 101'),
  ('Design Principles 101','Design theory quiz','Google Form quiz on design theory.','2026-06-29','google_form','https://forms.gle/design-quiz','Design Principles 101'),
  ('Video Editing Workshop','Edit a 30s promo','Upload your edited 30-second promo video.','2026-07-20','file_upload',NULL,'Video Editing Workshop'),
  ('Video Editing Workshop','Editing quiz','Google Form quiz on editing basics.','2026-07-18','google_form','https://forms.gle/editing-quiz','Video Editing Workshop'),
  ('Event Planning','Plan a workshop','Submit a 1-page workshop plan.','2026-07-02','external_link',NULL,'Event Planning'),
  ('Event Planning','Planning quiz','Google Form quiz on event planning.','2026-06-30','google_form','https://forms.gle/planning-quiz','Event Planning'),
  ('Team Coordination','Write a meeting agenda','Submit a sample weekly-sync agenda.','2026-07-25','external_link',NULL,'Team Coordination'),
  ('Team Coordination','Coordination quiz','Google Form quiz.','2026-07-23','google_form','https://forms.gle/coord-quiz','Team Coordination'),
  ('Effective Public Relations','Write a press release','Draft a press release for the fall event and submit the link.','2026-07-05','external_link',NULL,'Effective Public Relations'),
  ('Effective Public Relations','PR quiz','Google Form quiz on PR basics.','2026-07-03','google_form','https://forms.gle/pr-quiz','Effective Public Relations'),
  ('Sponsorship Outreach','Build a sponsor list','Submit a list of 10 prospective sponsors with notes.','2026-07-20','external_link',NULL,'Sponsorship Outreach'),
  ('Sponsorship Outreach','Sponsorship quiz','Google Form quiz on sponsorship.','2026-07-18','google_form','https://forms.gle/sponsor-quiz','Sponsorship Outreach')
) AS v(session_title, title, description, deadline, submission_type, submission_url, st)
JOIN sessions s ON s.title = v.st;

-- ============ QUIZZES (1 per session) ============
INSERT INTO quizzes (session_id, title, deadline, form_url, committee_id)
SELECT s.id, v.quiz_title, v.deadline::date, v.form_url, s.committee_id
FROM (VALUES
  ('Intro to Microcontrollers','Microcontrollers Basics Quiz','2026-06-22','https://forms.gle/mcu-quiz'),
  ('RTOS Fundamentals','RTOS Concepts Quiz','2026-07-22','https://forms.gle/rtos-quiz'),
  ('Kinematics Basics','Kinematics Quiz','2026-06-27','https://forms.gle/kin-quiz'),
  ('PID Control','PID Theory Quiz','2026-07-22','https://forms.gle/pidq-quiz'),
  ('React Fundamentals','React Hooks Quiz','2026-07-12','https://forms.gle/reactq-quiz'),
  ('Advanced Git & Collaboration','Git Workflow Quiz','2026-07-24','https://forms.gle/gitq-quiz'),
  ('Circuit Analysis','Circuits Quiz','2026-06-30','https://forms.gle/circ-quiz'),
  ('Op-Amp Applications','Op-Amps Quiz','2026-07-22','https://forms.gle/opampq-quiz'),
  ('PCB Design 101','PCB Quiz','2026-07-02','https://forms.gle/pcbq-quiz'),
  ('Power Electronics','Power Electronics Quiz','2026-07-24','https://forms.gle/powerq-quiz'),
  ('Effective Onboarding','Onboarding Quiz','2026-07-02','https://forms.gle/onboardq-quiz'),
  ('Evaluation Best Practices','Evaluation Quiz','2026-07-24','https://forms.gle/evalq-quiz'),
  ('Design Principles 101','Design Quiz','2026-06-29','https://forms.gle/designq-quiz'),
  ('Video Editing Workshop','Editing Quiz','2026-07-22','https://forms.gle/editq-quiz'),
  ('Event Planning','Planning Quiz','2026-07-04','https://forms.gle/planq-quiz'),
  ('Team Coordination','Coordination Quiz','2026-07-27','https://forms.gle/coordq-quiz'),
  ('Effective Public Relations','PR Quiz','2026-07-07','https://forms.gle/prq-quiz'),
  ('Sponsorship Outreach','Sponsorship Quiz','2026-07-22','https://forms.gle/sponsorq-quiz')
) AS v(session_title, quiz_title, deadline, form_url)
JOIN sessions s ON s.title = v.session_title;

-- ============ ATTENDANCE ============
DO $$
DECLARE
  s RECORD; m RECORD; st text; seed int := 0;
BEGIN
  FOR s IN SELECT id, committee_id FROM sessions ORDER BY publish_date LOOP
    FOR m IN SELECT id FROM members WHERE committee_id = s.committee_id AND status <> 'inactive' ORDER BY created_at LOOP
      seed := seed + 1;
      CASE
        WHEN (seed % 7 = 0) THEN st := 'absent';
        WHEN (seed % 4 = 0) THEN st := 'late';
        ELSE st := 'present';
      END CASE;
      INSERT INTO attendance (session_id, member_id, status, committee_id)
      VALUES (s.id, m.id, st, s.committee_id)
      ON CONFLICT (session_id, member_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============ TASK SUBMISSIONS ============
INSERT INTO task_submissions (task_id, member_id, submitted_at, link, score, bonus)
SELECT t.id, m.id, t.deadline - (random()*3)::int, 'https://example.com/submission', (5 + (random()*5)::int), (random()*3)::int
FROM tasks t
JOIN members m ON m.committee_id = t.committee_id AND m.role = 'member' AND m.status = 'active'
WHERE (random() < 0.6)
  AND NOT EXISTS (SELECT 1 FROM task_submissions ts WHERE ts.task_id = t.id AND ts.member_id = m.id)
ON CONFLICT (task_id, member_id) DO NOTHING;

-- ============ QUIZ SCORES ============
INSERT INTO quiz_scores (quiz_id, member_id, score, bonus)
SELECT q.id, m.id, (4 + (random()*6)::int), (random()*2)::int
FROM quizzes q
JOIN members m ON m.committee_id = q.committee_id AND m.role = 'member' AND m.status = 'active'
WHERE (random() < 0.55)
  AND NOT EXISTS (SELECT 1 FROM quiz_scores qs WHERE qs.quiz_id = q.id AND qs.member_id = m.id)
ON CONFLICT (quiz_id, member_id) DO NOTHING;

-- ============ STRIKES & BONUSES ============
INSERT INTO strikes (member_id, reason, date, points)
SELECT id, 'Missed two consecutive deadlines', '2026-06-30'::date, 5 FROM members WHERE name = 'Faris Nabil';
INSERT INTO strikes (member_id, reason, date, points)
SELECT id, 'Disruptive during session', '2026-07-05'::date, 3 FROM members WHERE name = 'Rana Tarek';
INSERT INTO bonuses (member_id, reason, points, date)
SELECT id, 'Mentored three new members', 8, '2026-07-10'::date FROM members WHERE name = 'Ahmed Al-Rashid';
INSERT INTO bonuses (member_id, reason, points, date)
SELECT id, 'Organized the design workshop', 6, '2026-07-12'::date FROM members WHERE name = 'Maya Omar';
INSERT INTO bonuses (member_id, reason, points, date)
SELECT id, 'Top contributor this month', 5, '2026-07-15'::date FROM members WHERE name = 'Yara Mansour';

-- ============ ANNOUNCEMENTS (1 per committee) ============
INSERT INTO announcements (author_id, title, body, image_url, file_url, link_url, pinned, created_at, committee_id)
SELECT tl.id, v.title, v.body, v.image, v.file, v.link, true, '2026-07-19'::timestamptz, c.id
FROM (VALUES
  ('Embedded Systems','Welcome to Embedded Systems','Sessions restart this week. Check the Sessions page for your schedule and first tasks.','https://images.pexels.com/photos/8566472/pexels-photo-8566472.jpeg?auto=compress&cs=tinysrgb&w=1200',NULL,NULL),
  ('Robotics','Robotics Semester Kickoff','Welcome back! First session on kinematics this Thursday.',NULL,NULL,NULL),
  ('Computer Science','CS Committee Welcome','React fundamentals session is live. Submit your counter app by next week.',NULL,NULL,'https://github.com/nexus-team'),
  ('Electronics','Electronics Update','Circuit analysis session slides are posted.',NULL,NULL,NULL),
  ('Hardware','Hardware Workspace Live','PCB design task is open. Upload your KiCad project by Friday.',NULL,NULL,NULL),
  ('HR','HR Evaluation Cycle','The Q3 evaluation cycle begins this week. Please review the rubric.',NULL,'https://example.com/evaluation-rubric.pdf',NULL),
  ('Media','Media Team Welcome','Design workshop recording is up. Redesign task due soon!',NULL,NULL,NULL),
  ('Organization','Organization Sync','Weekly sync moves to Tuesdays. Update your calendars.',NULL,NULL,NULL),
  ('PR','PR Outreach Starts','Sponsorship outreach campaign launches Monday.',NULL,NULL,NULL)
) AS v(committee_name, title, body, image, file, link)
JOIN committees c ON c.name = v.committee_name
LEFT JOIN members tl ON tl.committee_id = c.id AND tl.role = 'team_leader';

-- ============ member_scores VIEW (recreate with position column) ============
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

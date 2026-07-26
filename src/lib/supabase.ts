import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey);

// ===== Types =====
export type Role = 'admin' | 'director' | 'team_leader' | 'vice_team_leader' | 'hr' | 'member';
export type MemberStatus = 'active' | 'on_leave' | 'inactive';
export type SubmissionType = 'google_form' | 'external_link' | 'file_upload';
export type AttendanceStatus = 'present' | 'late' | 'absent';
export type CommitteeType = 'technical' | 'non_technical';

export interface Committee {
  id: string; name: string; color: string; type: CommitteeType;
  created_at?: string;
}

export interface Section {
  id: string; committee_id: string; name: string; created_at?: string;
}

export interface LeaderNote { from: string; date: string; text: string; }

export interface Member {
  id: string; name: string; email: string; phone: string | null;
  avatar_url: string | null; committee_id: string | null;
  section_id: string | null;
  position: string; role: Role; join_date: string; status: MemberStatus;
  notes: LeaderNote[];
  created_at?: string;
}

export interface DirectorCommittee {
  id: string; director_id: string; committee_id: string;
}

export interface Session {
  id: string; title: string; description: string | null;
  drive_folder_url: string | null; end_date: string; committee_id: string;
  section_id: string | null;
  is_locked: boolean;
}

export interface Task {
  id: string; session_id: string | null; title: string; description: string | null;
  deadline: string; submission_type: SubmissionType; submission_url: string | null;
  committee_id: string; document_url: string | null; section_id: string | null;
}

export interface Quiz {
  id: string; session_id: string | null; title: string; description: string | null;
  deadline: string; start_time: string | null;
  form_url: string | null; committee_id: string; section_id: string | null;
}

export interface QuizScore {
  id: string; quiz_id: string; member_id: string; score: number; bonus: number; recorded_at: string;
}

export interface TaskGrade {
  id: string; task_id: string; member_id: string;
  points: number; bonus: number; leader_note: string;
  created_at?: string; updated_at?: string;
}

export interface Attendance {
  id: string; session_id: string; member_id: string; status: AttendanceStatus;
  recorded_at: string; committee_id: string;
}

export interface Meeting {
  id: string; committee_id: string; section_id: string | null;
  title: string; description: string | null; meeting_link: string | null;
  meeting_date: string; meeting_time: string;
  created_at?: string;
}

export interface MeetingAttendance {
  id: string; meeting_id: string; member_id: string; committee_id: string;
  status: AttendanceStatus; recorded_at: string;
}

export interface Strike { id: string; member_id: string; reason: string; date: string; points: number; }
export interface Bonus { id: string; member_id: string; reason: string; points: number; date: string; }

export interface Announcement {
  id: string; author_id: string | null; title: string; body: string;
  image_url: string | null; file_url: string | null; link_url: string | null;
  pinned: boolean; created_at: string; committee_id: string;
}

export interface MemberScore {
  member_id: string; name: string; committee_id: string | null; role: Role; position: string;
  attendance_points: number; task_points: number; quiz_points: number;
  bonus_points: number; strike_points: number; total_points: number;
  present_count: number; late_count: number; absent_count: number; total_meetings: number;
  attendance_rate: number; tasks_completed: number; quizzes_completed: number;
}

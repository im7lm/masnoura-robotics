import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type {
  Member, Committee, Section, Session, Task, Quiz, TaskGrade, QuizScore,
  Attendance, Strike, Bonus, Announcement, MemberScore, Meeting, MeetingAttendance,
} from './supabase';

type QueryResult<T> = { data: T[]; loading: boolean; error: string | null; refetch: () => void };

function useRealtimeQuery<T>(
  table: string,
  buildQuery: () => Promise<{ data: T[] | null; error: { message: string } | null }>,
  deps: unknown[],
): QueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const buildRef = useRef(buildQuery);
  buildRef.current = buildQuery;

  const fetch = useCallback(async (activeRef: { current: boolean }) => {
    setLoading(true);
    const { data, error } = await buildRef.current();
    if (!activeRef.current) return;
    if (error) setError(error.message);
    else { setData(data ?? []); setError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const active = { current: true };
    fetch(active);

    const channel = supabase
      .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (active.current) fetch(active);
      })
      .subscribe();

    return () => {
      active.current = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, ...deps, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, refetch };
}

// ===== Committees (sourced from auth context) =====
export function useCommittees() {
  const { committees } = useAuth();
  return { data: committees, loading: false, error: null as string | null, refetch: async () => {} };
}

// ===== Sections scoped to active committee =====
export function useSections(committeeId?: string): QueryResult<Section> {
  const { activeCommittee } = useAuth();
  const cid = committeeId ?? activeCommittee?.id ?? '';
  return useRealtimeQuery<Section>('sections', async () => {
    if (!cid) return { data: [], error: null };
    const { data, error } = await supabase.from('sections').select('*').eq('committee_id', cid).order('name');
    return { data: data as Section[] | null, error: error as { message: string } | null };
  }, [cid]);
}

// Returns ALL sections (for admin overview)
export function useAllSections(): QueryResult<Section> {
  return useRealtimeQuery<Section>('sections', async () => {
    const { data, error } = await supabase.from('sections').select('*').order('name');
    return { data: data as Section[] | null, error: error as { message: string } | null };
  }, []);
}

// ===== Members scoped to active committee (or all for admin/director) =====
export function useMembers() {
  const { activeCommittee, profile, members, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const data = (() => {
    if (role === 'admin') {
      // Admin: filter by active committee when one is explicitly selected
      if (activeCommittee) return members.filter((m) => m.committee_id === activeCommittee.id);
      return members;
    }
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      // Director: scope to active committee if set
      if (activeCommittee && ids.includes(activeCommittee.id)) {
        return members.filter((m) => m.committee_id === activeCommittee.id);
      }
      return members.filter((m) => m.committee_id && ids.includes(m.committee_id));
    }
    if (activeCommittee) return members.filter((m) => m.committee_id === activeCommittee.id);
    return [];
  })();
  return { data, loading: false, error: null as string | null, refetch: async () => {} };
}

// All members regardless of committee (for admin team management)
export function useAllMembers() {
  const { members } = useAuth();
  return { data: members, loading: false, error: null as string | null, refetch: async () => {} };
}

// ===== Committee-scoped helpers =====
function getCommitteeIds(role: string, activeCommittee: Committee | null, directorAssignments: { director_id: string; committee_id: string }[], profileId: string | undefined): string[] | 'all' {
  if (role === 'admin') {
    if (activeCommittee) return [activeCommittee.id];
    return 'all';
  }
  if (role === 'director') {
    const ids = directorAssignments.filter((d) => d.director_id === profileId).map((d) => d.committee_id);
    if (activeCommittee && ids.includes(activeCommittee.id)) return [activeCommittee.id];
    return ids.length ? ids : [];
  }
  if (activeCommittee) return [activeCommittee.id];
  return [];
}

// ===== Scoped table hooks (realtime) =====
export function useSessions(): QueryResult<Session> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  const sectionId = role === 'member' ? (profile?.section_id ?? null) : null;
  return useRealtimeQuery<Session>('sessions', async () => {
    let q = supabase.from('sessions').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    // Members only see sessions for their section (or sessions with no section)
    if (sectionId) q = q.or(`section_id.eq.${sectionId},section_id.is.null`);
    const { data, error } = await q.order('end_date', { ascending: false });
    return { data: data as Session[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id, sectionId]);
}

export function useTasks(): QueryResult<Task> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  const sectionId = role === 'member' ? (profile?.section_id ?? null) : null;
  return useRealtimeQuery<Task>('tasks', async () => {
    let q = supabase.from('tasks').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    // Members only see tasks for their section (or tasks with no section)
    if (sectionId) q = q.or(`section_id.eq.${sectionId},section_id.is.null`);
    const { data, error } = await q.order('deadline', { ascending: false });
    return { data: data as Task[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id, sectionId]);
}

export function useQuizzes(): QueryResult<Quiz> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  const sectionId = role === 'member' ? (profile?.section_id ?? null) : null;
  return useRealtimeQuery<Quiz>('quizzes', async () => {
    let q = supabase.from('quizzes').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    // Members only see quizzes for their section (or quizzes with no section)
    if (sectionId) q = q.or(`section_id.eq.${sectionId},section_id.is.null`);
    const { data, error } = await q.order('deadline', { ascending: false });
    return { data: data as Quiz[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id, sectionId]);
}

export function useAnnouncements(): QueryResult<Announcement> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<Announcement>('announcements', async () => {
    let q = supabase.from('announcements').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    const { data, error } = await q.order('created_at', { ascending: false });
    return { data: data as Announcement[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id]);
}

// Legacy attendance (kept for backward-compat with evaluation page)
export function useAttendance(): QueryResult<Attendance> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<Attendance>('attendance', async () => {
    // Check if attendance table exists
    let q = supabase.from('attendance').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    const { data, error } = await q.order('recorded_at', { ascending: false });
    if (error) return { data: [], error: null }; // table may not exist
    return { data: data as Attendance[] | null, error: null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id]);
}

// ===== Meetings =====
export function useMeetings(): QueryResult<Meeting> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<Meeting>('meetings', async () => {
    let q = supabase.from('meetings').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    const { data, error } = await q.order('meeting_date', { ascending: false });
    return { data: data as Meeting[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id]);
}

export function useMeetingAttendance(): QueryResult<MeetingAttendance> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<MeetingAttendance>('meeting_attendance', async () => {
    let q = supabase.from('meeting_attendance').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    const { data, error } = await q.order('recorded_at', { ascending: false });
    return { data: data as MeetingAttendance[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id]);
}

// ===== Task grades: scoped via parent task's committee =====
export function useTaskGrades(): QueryResult<TaskGrade> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<TaskGrade>('task_grades', async () => {
    let taskQuery = supabase.from('tasks').select('id, committee_id');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) taskQuery = taskQuery.eq('committee_id', committeeIds[0]);
    else taskQuery = taskQuery.in('committee_id', committeeIds);
    const { data: tasks } = await taskQuery;
    const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
    if (taskIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('task_grades').select('*').in('task_id', taskIds);
    return { data: data as TaskGrade[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id]);
}

export function useQuizScores(): QueryResult<QuizScore> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<QuizScore>('quiz_scores', async () => {
    let quizQuery = supabase.from('quizzes').select('id, committee_id');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) quizQuery = quizQuery.eq('committee_id', committeeIds[0]);
    else quizQuery = quizQuery.in('committee_id', committeeIds);
    const { data: quizzes } = await quizQuery;
    const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
    if (quizIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('quiz_scores').select('*').in('quiz_id', quizIds);
    return { data: data as QuizScore[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id]);
}

// ===== Strikes & bonuses =====
export function useStrikes(): QueryResult<Strike> {
  const { activeCommittee, profile, directorAssignments, members } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Strike>('strikes', async () => {
    let memberIds: string[] = [];
    if (role === 'admin') {
      memberIds = activeCommittee
        ? members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id)
        : members.map((m) => m.id);
    } else if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      const filtered = activeCommittee && ids.includes(activeCommittee.id)
        ? members.filter((m) => m.committee_id === activeCommittee.id)
        : members.filter((m) => m.committee_id && ids.includes(m.committee_id));
      memberIds = filtered.map((m) => m.id);
    } else if (activeCommittee) {
      memberIds = members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id);
    }
    if (memberIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('strikes').select('*').in('member_id', memberIds).order('date', { ascending: false });
    return { data: data as Strike[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id, members]);
}

export function useBonuses(): QueryResult<Bonus> {
  const { activeCommittee, profile, directorAssignments, members } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Bonus>('bonuses', async () => {
    let memberIds: string[] = [];
    if (role === 'admin') {
      memberIds = activeCommittee
        ? members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id)
        : members.map((m) => m.id);
    } else if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      const filtered = activeCommittee && ids.includes(activeCommittee.id)
        ? members.filter((m) => m.committee_id === activeCommittee.id)
        : members.filter((m) => m.committee_id && ids.includes(m.committee_id));
      memberIds = filtered.map((m) => m.id);
    } else if (activeCommittee) {
      memberIds = members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id);
    }
    if (memberIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('bonuses').select('*').in('member_id', memberIds).order('date', { ascending: false });
    return { data: data as Bonus[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id, members]);
}

export function useMemberScores(): QueryResult<MemberScore> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const refetchSignal = useRealtimeSignal(['task_grades', 'quiz_scores', 'attendance', 'strikes', 'bonuses', 'members', 'meeting_attendance']);
  const committeeIds = getCommitteeIds(role, activeCommittee, directorAssignments, profile?.id);
  return useRealtimeQuery<MemberScore>('member_scores', async () => {
    let q = supabase.from('member_scores').select('*');
    if (committeeIds === 'all') { /* no filter */ }
    else if (committeeIds.length === 0) return { data: [], error: null };
    else if (committeeIds.length === 1) q = q.eq('committee_id', committeeIds[0]);
    else q = q.in('committee_id', committeeIds);
    const { data, error } = await q.order('total_points', { ascending: false });
    return { data: data as MemberScore[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, JSON.stringify(directorAssignments), profile?.id, refetchSignal]);
}

function useRealtimeSignal(tables: string[]): number {
  const [signal, setSignal] = useState(0);
  const tablesKey = tables.join(',');
  useEffect(() => {
    const channel = supabase
      .channel(`signal:${tablesKey}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (tables.includes((payload as { table: string }).table)) setSignal((s) => s + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey]);
  return signal;
}

export function useDirectorCommittees() {
  const { directorAssignments } = useAuth();
  return { data: directorAssignments, loading: false, error: null as string | null, refetch: async () => {} };
}

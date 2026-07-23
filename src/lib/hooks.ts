import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type {
  Member, Committee, Session, Task, Quiz, TaskGrade, QuizScore,
  Attendance, Strike, Bonus, Announcement, MemberScore,
} from './supabase';

type QueryResult<T> = { data: T[]; loading: boolean; error: string | null; refetch: () => void };

/**
 * Fetches data from a table and keeps it synchronized via Supabase Realtime.
 * Any INSERT/UPDATE/DELETE on the table triggers a refetch of the scoped query.
 */
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

// ===== Members scoped to active committee (or all for admin/director) =====
export function useMembers() {
  const { activeCommittee, profile, members, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const data = (() => {
    if (role === 'admin') return members;
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      return members.filter((m) => m.committee_id && ids.includes(m.committee_id));
    }
    if (activeCommittee) return members.filter((m) => m.committee_id === activeCommittee.id);
    return [];
  })();
  return { data, loading: false, error: null as string | null, refetch: async () => {} };
}

// ===== Scoped table hooks (realtime) =====
export function useSessions(): QueryResult<Session> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Session>('sessions', async () => {
    let q = supabase.from('sessions').select('*');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      q = q.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      q = q.eq('committee_id', activeCommittee.id);
    }
    const { data, error } = await q.order('end_date', { ascending: false });
    return { data: data as Session[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

export function useTasks(): QueryResult<Task> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Task>('tasks', async () => {
    let q = supabase.from('tasks').select('*');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      q = q.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      q = q.eq('committee_id', activeCommittee.id);
    }
    const { data, error } = await q.order('deadline', { ascending: false });
    return { data: data as Task[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

export function useQuizzes(): QueryResult<Quiz> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Quiz>('quizzes', async () => {
    let q = supabase.from('quizzes').select('*');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      q = q.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      q = q.eq('committee_id', activeCommittee.id);
    }
    const { data, error } = await q.order('deadline', { ascending: false });
    return { data: data as Quiz[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

export function useAnnouncements(): QueryResult<Announcement> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Announcement>('announcements', async () => {
    let q = supabase.from('announcements').select('*');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      q = q.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      q = q.eq('committee_id', activeCommittee.id);
    }
    const { data, error } = await q.order('created_at', { ascending: false });
    return { data: data as Announcement[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

export function useAttendance(): QueryResult<Attendance> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Attendance>('attendance', async () => {
    let q = supabase.from('attendance').select('*');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      q = q.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      q = q.eq('committee_id', activeCommittee.id);
    }
    const { data, error } = await q.order('recorded_at', { ascending: false });
    return { data: data as Attendance[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

// ===== Task grades: scoped via parent task's committee =====
export function useTaskGrades(): QueryResult<TaskGrade> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<TaskGrade>('task_grades', async () => {
    let taskQuery = supabase.from('tasks').select('id, committee_id');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      taskQuery = taskQuery.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      taskQuery = taskQuery.eq('committee_id', activeCommittee.id);
    }
    const { data: tasks } = await taskQuery;
    const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
    if (taskIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('task_grades').select('*').in('task_id', taskIds);
    return { data: data as TaskGrade[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

export function useQuizScores(): QueryResult<QuizScore> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<QuizScore>('quiz_scores', async () => {
    let quizQuery = supabase.from('quizzes').select('id, committee_id');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      quizQuery = quizQuery.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      quizQuery = quizQuery.eq('committee_id', activeCommittee.id);
    }
    const { data: quizzes } = await quizQuery;
    const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
    if (quizIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('quiz_scores').select('*').in('quiz_id', quizIds);
    return { data: data as QuizScore[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);
}

// ===== Strikes & bonuses: scoped via member's committee =====
export function useStrikes(): QueryResult<Strike> {
  const { activeCommittee, profile, directorAssignments, members } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Strike>('strikes', async () => {
    let memberIds: string[] = [];
    if (role === 'admin') memberIds = members.map((m) => m.id);
    else if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      memberIds = members.filter((m) => m.committee_id && ids.includes(m.committee_id)).map((m) => m.id);
    } else if (activeCommittee) {
      memberIds = members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id);
    }
    if (memberIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('strikes').select('*').in('member_id', memberIds).order('date', { ascending: false });
    return { data: data as Strike[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id, members]);
}

export function useBonuses(): QueryResult<Bonus> {
  const { activeCommittee, profile, directorAssignments, members } = useAuth();
  const role = profile?.role ?? 'member';
  return useRealtimeQuery<Bonus>('bonuses', async () => {
    let memberIds: string[] = [];
    if (role === 'admin') memberIds = members.map((m) => m.id);
    else if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      memberIds = members.filter((m) => m.committee_id && ids.includes(m.committee_id)).map((m) => m.id);
    } else if (activeCommittee) {
      memberIds = members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id);
    }
    if (memberIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase.from('bonuses').select('*').in('member_id', memberIds).order('date', { ascending: false });
    return { data: data as Bonus[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id, members]);
}

// ===== Member scores view: filter by committee (realtime via base tables) =====
export function useMemberScores(): QueryResult<MemberScore> {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  // member_scores is a view; we subscribe to the base tables that feed it.
  const refetchSignal = useRealtimeSignal(['task_grades', 'quiz_scores', 'attendance', 'strikes', 'bonuses', 'members']);
  return useRealtimeQuery<MemberScore>('member_scores', async () => {
    let q = supabase.from('member_scores').select('*');
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      q = q.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (role !== 'admin' && activeCommittee) {
      q = q.eq('committee_id', activeCommittee.id);
    }
    const { data, error } = await q.order('total_points', { ascending: false });
    return { data: data as MemberScore[] | null, error: error as { message: string } | null };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id, refetchSignal]);
}

/**
 * Returns a counter that increments whenever any of the given tables changes.
 * Used to trigger refetches for views that aggregate multiple base tables.
 */
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

// ===== Director assignments (sourced from auth context) =====
export function useDirectorCommittees() {
  const { directorAssignments } = useAuth();
  return { data: directorAssignments, loading: false, error: null as string | null, refetch: async () => {} };
}

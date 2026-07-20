import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type {
  Member, Committee, Session, Task, Quiz, TaskSubmission, TaskGrade, QuizScore,
  Attendance, Strike, Bonus, Announcement, MemberScore,
} from './supabase';

// ===== Committees (all accessible to current user) =====
export function useCommittees() {
  const { committees } = useAuth();
  return { data: committees, loading: false, error: null as string | null, refetch: async () => {} };
}

// ===== Members scoped to active committee (or all for admin/director) =====
export function useMembers() {
  const { activeCommittee, profile, members, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const data = useMemo(() => {
    if (role === 'admin') return members;
    if (role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
      return members.filter((m) => m.committee_id && ids.includes(m.committee_id));
    }
    if (activeCommittee) return members.filter((m) => m.committee_id === activeCommittee.id);
    return [];
  }, [members, role, activeCommittee, directorAssignments, profile?.id]);
  return { data, loading: false, error: null as string | null, refetch: async () => {} };
}

function useScopedTable<T>(table: string, orderCol: string, ascending = true) {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let query = supabase.from(table).select('*');
      if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        query = query.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else if (role !== 'admin' && activeCommittee) {
        query = query.eq('committee_id', activeCommittee.id);
      }
      const { data, error } = await query.order(orderCol, { ascending });
      if (!active) return;
      if (error) setError(error.message); else setData((data as T[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [table, orderCol, ascending, role, activeCommittee?.id, directorAssignments, profile?.id]);

  return { data, loading, error, refetch: async () => {} };
}

export function useSessions() { return useScopedTable<Session>('sessions', 'publish_date', false); }
export function useTasks() { return useScopedTable<Task>('tasks', 'deadline', false); }
export function useQuizzes() { return useScopedTable<Quiz>('quizzes', 'deadline', false); }
export function useAnnouncements() { return useScopedTable<Announcement>('announcements', 'created_at', false); }
export function useAttendance() { return useScopedTable<Attendance>('attendance', 'recorded_at', false); }

// ===== Submissions & scores: scoped via committee_id on the parent task/quiz =====
export function useTaskSubmissions() {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let taskQuery = supabase.from('tasks').select('id, committee_id');
      if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        taskQuery = taskQuery.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else if (role !== 'admin' && activeCommittee) {
        taskQuery = taskQuery.eq('committee_id', activeCommittee.id);
      }
      const { data: tasks } = await taskQuery;
      const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
      if (!active) return;
      if (taskIds.length === 0) { setData([]); setLoading(false); return; }
      const { data: subs, error } = await supabase.from('task_submissions').select('*').in('task_id', taskIds);
      if (!active) return;
      if (error) setError(error.message); else setData((subs as TaskSubmission[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);

  return { data, loading, error, refetch: async () => {} };
}

export function useTaskGrades() {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<TaskGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let taskQuery = supabase.from('tasks').select('id, committee_id');
      if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        taskQuery = taskQuery.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else if (role !== 'admin' && activeCommittee) {
        taskQuery = taskQuery.eq('committee_id', activeCommittee.id);
      }
      const { data: tasks } = await taskQuery;
      const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
      if (!active) return;
      if (taskIds.length === 0) { setData([]); setLoading(false); return; }
      const { data: grades, error } = await supabase.from('task_grades').select('*').in('task_id', taskIds);
      if (!active) return;
      if (error) setError(error.message); else setData((grades as TaskGrade[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);

  return { data, loading, error, refetch: async () => {} };
}

export function useQuizScores() {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<QuizScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let quizQuery = supabase.from('quizzes').select('id, committee_id');
      if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        quizQuery = quizQuery.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else if (role !== 'admin' && activeCommittee) {
        quizQuery = quizQuery.eq('committee_id', activeCommittee.id);
      }
      const { data: quizzes } = await quizQuery;
      const quizIds = (quizzes ?? []).map((q: { id: string }) => q.id);
      if (!active) return;
      if (quizIds.length === 0) { setData([]); setLoading(false); return; }
      const { data: scores, error } = await supabase.from('quiz_scores').select('*').in('quiz_id', quizIds);
      if (!active) return;
      if (error) setError(error.message); else setData((scores as QuizScore[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);

  return { data, loading, error, refetch: async () => {} };
}

// ===== Strikes & bonuses: scoped via member's committee =====
export function useStrikes() {
  const { activeCommittee, profile, directorAssignments, members } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let memberIds: string[] = [];
      if (role === 'admin') {
        memberIds = members.map((m) => m.id);
      } else if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        memberIds = members.filter((m) => m.committee_id && ids.includes(m.committee_id)).map((m) => m.id);
      } else if (activeCommittee) {
        memberIds = members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id);
      }
      if (!active) return;
      if (memberIds.length === 0) { setData([]); setLoading(false); return; }
      const { data: strikes, error } = await supabase.from('strikes').select('*').in('member_id', memberIds).order('date', { ascending: false });
      if (!active) return;
      if (error) setError(error.message); else setData((strikes as Strike[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id, members]);

  return { data, loading, error, refetch: async () => {} };
}

export function useBonuses() {
  const { activeCommittee, profile, directorAssignments, members } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let memberIds: string[] = [];
      if (role === 'admin') {
        memberIds = members.map((m) => m.id);
      } else if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        memberIds = members.filter((m) => m.committee_id && ids.includes(m.committee_id)).map((m) => m.id);
      } else if (activeCommittee) {
        memberIds = members.filter((m) => m.committee_id === activeCommittee.id).map((m) => m.id);
      }
      if (!active) return;
      if (memberIds.length === 0) { setData([]); setLoading(false); return; }
      const { data: bonuses, error } = await supabase.from('bonuses').select('*').in('member_id', memberIds).order('date', { ascending: false });
      if (!active) return;
      if (error) setError(error.message); else setData((bonuses as Bonus[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id, members]);

  return { data, loading, error, refetch: async () => {} };
}

// ===== Member scores view: filter by committee =====
export function useMemberScores() {
  const { activeCommittee, profile, directorAssignments } = useAuth();
  const role = profile?.role ?? 'member';
  const [data, setData] = useState<MemberScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let query = supabase.from('member_scores').select('*');
      if (role === 'director') {
        const ids = directorAssignments.filter((d) => d.director_id === profile?.id).map((d) => d.committee_id);
        query = query.in('committee_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      } else if (role !== 'admin' && activeCommittee) {
        query = query.eq('committee_id', activeCommittee.id);
      }
      const { data, error } = await query.order('total_points', { ascending: false });
      if (!active) return;
      if (error) setError(error.message); else setData((data as MemberScore[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [role, activeCommittee?.id, directorAssignments, profile?.id]);

  return { data, loading, error, refetch: async () => {} };
}

// ===== Director assignments =====
export function useDirectorCommittees() {
  const { directorAssignments } = useAuth();
  return { data: directorAssignments, loading: false, error: null as string | null, refetch: async () => {} };
}

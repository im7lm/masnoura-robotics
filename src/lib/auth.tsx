import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Member, Committee, Role, DirectorCommittee } from './supabase';
import { supabase } from './supabase';

interface AuthCtx {
  session: Session | null;
  profile: Member | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;

  committees: Committee[];
  members: Member[];
  directorAssignments: DirectorCommittee[];

  availableCommittees: Committee[];
  activeCommittee: Committee | null;
  setActiveCommitteeId: (id: string) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const STORAGE_COMMITTEE = 'nexus.activeCommitteeId';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [directorAssignments, setDirectorAssignments] = useState<DirectorCommittee[]>([]);
  const [committeeId, setCommitteeId] = useState<string>(() => localStorage.getItem(STORAGE_COMMITTEE) || '');

  // Session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (!sess) { setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile when session changes
  useEffect(() => {
    if (!session?.user?.id) { setProfile(null); return; }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      setProfile(data as Member | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [session?.user?.id]);

  // Load committees, members, director assignments
  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const [com, mem, dir] = await Promise.all([
        supabase.from('committees').select('*').order('name'),
        supabase.from('members').select('*').order('name'),
        supabase.from('director_committees').select('*'),
      ]);
      if (!active) return;
      if (com.data) setCommittees(com.data as Committee[]);
      if (mem.data) setMembers(mem.data as Member[]);
      if (dir.data) setDirectorAssignments(dir.data as DirectorCommittee[]);
    })();
    return () => { active = false; };
  }, [profile?.id]);

  const availableCommittees = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin') return committees;
    if (profile.role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile.id).map((d) => d.committee_id);
      return committees.filter((c) => ids.includes(c.id));
    }
    if (profile.committee_id) return committees.filter((c) => c.id === profile.committee_id);
    return [];
  }, [profile, committees, directorAssignments]);

  // Auto-select active committee
  useEffect(() => {
    if (availableCommittees.length === 0) return;
    if (!committeeId || !availableCommittees.find((c) => c.id === committeeId)) {
      setCommitteeId(availableCommittees[0].id);
    }
  }, [availableCommittees, committeeId]);

  const activeCommittee = useMemo(
    () => committees.find((c) => c.id === committeeId) ?? availableCommittees[0] ?? null,
    [committees, committeeId, availableCommittees],
  );

  const setActiveCommitteeId = (id: string) => { setCommitteeId(id); localStorage.setItem(STORAGE_COMMITTEE, id); };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setCommittees([]);
    setMembers([]);
    setDirectorAssignments([]);
    setCommitteeId('');
    localStorage.removeItem(STORAGE_COMMITTEE);
  };

  return (
    <Ctx.Provider value={{
      session, profile, loading, signIn, signOut,
      committees, members, directorAssignments,
      availableCommittees, activeCommittee, setActiveCommitteeId,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider missing');
  return c;
}

// Backward-compat: useRole re-exports useAuth for pages that still call it
export const useRole = useAuth;

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'General Team Leader',
  director: 'Director',
  team_leader: 'Team Leader',
  vice_team_leader: 'Vice Team Leader',
  hr: 'HR',
  member: 'Member',
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ['Full access', 'Create committees & users', 'Assign directors & leaders', 'Manage the whole organization'],
  director: ['Supervise multiple committees', 'Switch workspaces', 'View committee analytics', 'Oversee leaders'],
  team_leader: ['Create sessions, tasks & quizzes', 'Post announcements', 'Add leader notes', 'View committee leaderboard'],
  vice_team_leader: ['Assist team leader', 'Create sessions & tasks', 'View committee data'],
  hr: ['Record attendance', 'Enter quiz scores', 'Evaluate tasks', 'Add strikes & bonuses', 'Write notes'],
  member: ['View sessions', 'Submit tasks', 'Take quizzes', 'View leaderboard & announcements'],
};

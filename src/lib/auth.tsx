import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Member, Committee, Role, DirectorCommittee, CommitteeHr } from './supabase';
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
  hrAssignments: CommitteeHr[];

  availableCommittees: Committee[];
  activeCommittee: Committee | null;
  setActiveCommitteeId: (id: string) => void;

  refreshGlobal: () => void;
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
  const [hrAssignments, setHrAssignments] = useState<CommitteeHr[]>([]);
  const [committeeId, setCommitteeId] = useState<string>(() => localStorage.getItem(STORAGE_COMMITTEE) || '');

  // Keep a ref to the current user_id so loadGlobalData can re-sync the profile
  const userIdRef = useRef<string | null>(null);

  // Session listener — runs once on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      userIdRef.current = data.session?.user?.id ?? null;
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      userIdRef.current = sess?.user?.id ?? null;
      setSession(sess);
      if (!sess) { setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load global data: committees, members, director assignments, hr assignments.
  // Also re-syncs `profile` so that role changes made via the Users tab are
  // reflected immediately for the logged-in user without requiring a page reload.
  const loadGlobalData = useCallback(async () => {
    const [com, mem, dir, hr] = await Promise.all([
      supabase.from('committees').select('*').order('name'),
      supabase.from('members').select('*').order('name'),
      supabase.from('director_committees').select('*'),
      supabase.from('committee_hr').select('*'),
    ]);
    if (com.data) setCommittees(com.data as Committee[]);
    if (mem.data) {
      const freshMembers = mem.data as Member[];
      setMembers(freshMembers);
      // Re-sync the logged-in user's profile from the fresh member list
      const uid = userIdRef.current;
      if (uid) {
        const freshProfile = freshMembers.find((m) => m.user_id === uid);
        if (freshProfile) setProfile(freshProfile);
      }
    }
    if (dir.data) setDirectorAssignments(dir.data as DirectorCommittee[]);
    if (hr.data) setHrAssignments(hr.data as CommitteeHr[]);
  }, []);

  // Initial load when a session is first detected
  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      // Load the profile directly first so we have a role before the global load
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!active) return;
      setProfile(data as Member | null);
      setLoading(false);
      // Then load full global data (also re-syncs profile)
      loadGlobalData();
    })();
    return () => { active = false; };
  }, [session?.user?.id, loadGlobalData]);

  // Realtime: keep all global tables in sync
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`auth-global:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'committees' }, loadGlobalData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, loadGlobalData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'director_committees' }, loadGlobalData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'committee_hr' }, loadGlobalData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, loadGlobalData]);

  const refreshGlobal = useCallback(() => { loadGlobalData(); }, [loadGlobalData]);

  const availableCommittees = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin') return committees;
    if (profile.role === 'director') {
      const ids = directorAssignments.filter((d) => d.director_id === profile.id).map((d) => d.committee_id);
      return committees.filter((c) => ids.includes(c.id));
    }
    if (profile.role === 'hr') {
      const ids = hrAssignments.filter((a) => a.hr_id === profile.id).map((a) => a.committee_id);
      return committees.filter((c) => ids.includes(c.id));
    }
    if (profile.role === 'team_leader' || profile.role === 'vice_team_leader') {
      if (profile.committee_id) return committees.filter((c) => c.id === profile.committee_id);
    }
    if (profile.committee_id) return committees.filter((c) => c.id === profile.committee_id);
    return [];
  }, [profile, committees, directorAssignments, hrAssignments]);

  // Auto-select active committee when the available list changes
  useEffect(() => {
    if (availableCommittees.length === 0) return;
    if (!committeeId || !availableCommittees.find((c) => c.id === committeeId)) {
      const id = availableCommittees[0].id;
      setCommitteeId(id);
      localStorage.setItem(STORAGE_COMMITTEE, id);
    }
  }, [availableCommittees, committeeId]);

  const activeCommittee = useMemo(
    () => committees.find((c) => c.id === committeeId) ?? availableCommittees[0] ?? null,
    [committees, committeeId, availableCommittees],
  );

  const setActiveCommitteeId = (id: string) => {
    setCommitteeId(id);
    localStorage.setItem(STORAGE_COMMITTEE, id);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    userIdRef.current = null;
    setProfile(null);
    setCommittees([]);
    setMembers([]);
    setDirectorAssignments([]);
    setHrAssignments([]);
    setCommitteeId('');
    localStorage.removeItem(STORAGE_COMMITTEE);
  };

  return (
    <Ctx.Provider value={{
      session, profile, loading, signIn, signOut,
      committees, members, directorAssignments, hrAssignments,
      availableCommittees, activeCommittee, setActiveCommitteeId,
      refreshGlobal,
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

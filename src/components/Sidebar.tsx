import { LayoutDashboard, Users, GraduationCap, ClipboardList, Star, Trophy, Megaphone, Settings, Hexagon, Sparkles, ChevronDown, Building2, LogOut, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, useRouter } from './Router';
import { useState } from 'react';
import type { Role } from '../lib/supabase';
import { useAuth, ROLE_LABELS, ROLE_PERMISSIONS } from '../lib/auth';
import type { Member, Committee } from '../lib/supabase';

export interface NavItem { label: string; to: string; icon: LucideIcon; roles: Role[]; }
export const NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'] },
  { label: 'Sessions', to: '/sessions', icon: GraduationCap, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'] },
  { label: 'Tasks', to: '/tasks', icon: ClipboardList, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'] },
  { label: 'Quizzes', to: '/quizzes', icon: Star, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'] },
  { label: 'Attendance', to: '/attendance', icon: ClipboardList, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'] },
  { label: 'Evaluation', to: '/evaluation', icon: Star, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'] },
  { label: 'Leaderboard', to: '/leaderboard', icon: Trophy, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'] },
  { label: 'Members', to: '/members', icon: Users, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'] },
  { label: 'Announcements', to: '/announcements', icon: Megaphone, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'] },
  { label: 'Team Management', to: '/team', icon: ShieldCheck, roles: ['admin'] },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { path } = useRouter();
  const { profile, availableCommittees, activeCommittee, setActiveCommitteeId, signOut } = useAuth();
  const role = profile?.role ?? 'member';
  const isActive = (to: string) => path === to || path.startsWith(to + '/');
  const items = NAV.filter((n) => n.roles.includes(role));
  const showWorkspaceSwitcher = availableCommittees.length > 1;

  return (
    <>
      {open && <div className="fixed inset-0 bg-ink-900/30 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen w-[248px] shrink-0 bg-white border-r border-ink-200/70 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-ink-200/70">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
            <Hexagon size={20} strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <p className="font-semibold text-ink-900 tracking-tight">Mansoura Robotics</p>
            <p className="text-[11px] text-ink-500">Team Portal</p>
          </div>
        </div>

        <div className="px-3 pt-3 space-y-2">
          {showWorkspaceSwitcher && activeCommittee && (
            <WorkspaceSwitcher committees={availableCommittees} activeId={activeCommittee.id} onSelect={setActiveCommitteeId} />
          )}
          {activeCommittee && !showWorkspaceSwitcher && (
            <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-ink-50 border border-ink-200/60 text-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: activeCommittee.color }} />
              <span className="font-medium text-ink-800 truncate">{activeCommittee.name}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Workspace</p>
          {items.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} onClick={onClose}>
                <div className={`group flex items-center gap-3 px-3 h-9 rounded-xl text-sm font-medium transition-all ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'}`}>
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} className={active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'} />
                  {item.label}
                  {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3 space-y-2">
          <div className="m-0 p-3 rounded-2xl bg-mint-50 border border-mint-200/60">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={15} className="text-mint-500" />
              <p className="text-xs font-semibold text-ink-800">{ROLE_LABELS[role]}</p>
            </div>
            <p className="text-[11px] text-ink-600 leading-relaxed">{ROLE_PERMISSIONS[role]?.[0] ?? ''}</p>
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 h-9 rounded-xl text-sm font-medium text-ink-500 hover:bg-red-50 hover:text-brand-600 transition-colors">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function WorkspaceSwitcher({ committees, activeId, onSelect }: { committees: Committee[]; activeId: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = committees.find((c) => c.id === activeId);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3 h-10 rounded-xl bg-ink-100 hover:bg-ink-200/70 transition-colors text-sm">
        <span className="flex items-center gap-2 min-w-0">
          <Building2 size={14} className="text-ink-500 shrink-0" />
          <span className="font-medium text-ink-800 truncate">{active?.name ?? 'Workspace'}</span>
        </span>
        <ChevronDown size={14} className={`text-ink-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-11 left-0 right-0 card shadow-pop animate-slide-down z-10 py-1 max-h-[60vh] overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Switch workspace</p>
          {committees.map((c) => (
            <button key={c.id} onClick={() => { onSelect(c.id); setOpen(false); }} className={`w-full flex items-center gap-2 px-3 h-9 text-sm text-left transition-colors ${c.id === activeId ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-700 hover:bg-ink-100'}`}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useMobileNav() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

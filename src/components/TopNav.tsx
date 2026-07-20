import { useEffect, useRef, useState } from 'react';
import { Menu, Search, Bell, ChevronDown, LogOut, User, HelpCircle } from 'lucide-react';
import { GlobalSearch } from './CommandPalette';
import { useRouter, Link } from './Router';
import { Avatar } from './ui';
import { useAuth, ROLE_LABELS } from '../lib/auth';

export function TopNav({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { navigate } = useRouter();
  const { profile, activeCommittee, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const role = profile?.role ?? 'member';
  const name = profile?.name ?? 'Loading...';
  const avatar = profile?.avatar_url ?? null;

  return (
    <header className="sticky top-0 z-30 h-16 glass border-b border-ink-200/70 flex items-center gap-3 px-4 lg:px-6">
      <button onClick={onMenu} className="lg:hidden btn-ghost btn-sm !px-2"><Menu size={18} /></button>

      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
          <span className="text-xs font-bold">N</span>
        </div>
      </div>

      <button onClick={onSearch} className="md:hidden btn-ghost btn-sm !px-2"><Search size={18} /></button>

      <GlobalSearch onOpen={onSearch} />

      {activeCommittee && (
        <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-xl bg-ink-100/70 border border-ink-200/60 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ background: activeCommittee.color }} />
          <span className="font-medium text-ink-700">{activeCommittee.name}</span>
          <span className="text-[11px] text-ink-400 uppercase tracking-wider">{activeCommittee.type === 'technical' ? 'Tech' : 'Non-Tech'}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Link to="/announcements" className="hidden sm:flex btn-secondary btn-sm"><Bell size={15} /> Announcements</Link>

        <div className="relative" ref={profileRef}>
          <button onClick={() => setProfileOpen((v) => !v)} className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-xl hover:bg-ink-100 transition-colors">
            <Avatar src={avatar} name={name} size={28} />
            <span className="hidden sm:block text-sm font-medium text-ink-700">{name.split(' ')[0]}</span>
            <ChevronDown size={14} className="text-ink-400" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 card shadow-pop animate-slide-down overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-200/70">
                <p className="text-sm font-semibold text-ink-900">{name}</p>
                <p className="text-xs text-ink-500">{ROLE_LABELS[role]} · {profile?.position ?? ''}</p>
              </div>
              <div className="py-1">
                {profile && (
                  <button onClick={() => { setProfileOpen(false); navigate(`/members/${profile.id}`); }} className="w-full flex items-center gap-2.5 px-4 h-9 text-sm text-ink-700 hover:bg-ink-100">
                    <User size={15} className="text-ink-400" /> My Profile
                  </button>
                )}
                <button className="w-full flex items-center gap-2.5 px-4 h-9 text-sm text-ink-700 hover:bg-ink-100">
                  <HelpCircle size={15} className="text-ink-400" /> Help & support
                </button>
              </div>
              <div className="py-1 border-t border-ink-200/70">
                <button onClick={signOut} className="w-full flex items-center gap-2.5 px-4 h-9 text-sm text-brand-600 hover:bg-brand-50">
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

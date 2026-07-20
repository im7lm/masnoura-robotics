import { useEffect, useMemo, useState } from 'react';
import { Search, Command, CornerDownLeft, ChevronRight } from 'lucide-react';
import { NAV } from './Sidebar';
import { useRouter } from './Router';
import { useMembers, useSessions, useTasks, useQuizzes } from '../lib/hooks';
import { useAuth } from '../lib/auth';

interface CmdItem { id: string; label: string; hint: string; to: string; group: string; }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate } = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const { data: members } = useMembers();
  const { data: sessions } = useSessions();
  const { data: tasks } = useTasks();
  const { data: quizzes } = useQuizzes();

  const items = useMemo<CmdItem[]>(() => {
    const nav: CmdItem[] = NAV.map((n) => ({ id: 'nav-' + n.to, label: n.label, hint: 'Page', to: n.to, group: 'Navigation' }));
    const mem: CmdItem[] = members.map((m) => ({ id: 'm-' + m.id, label: m.name, hint: m.position, to: `/members/${m.id}`, group: 'Members' }));
    const ses: CmdItem[] = sessions.map((s) => ({ id: 's-' + s.id, label: s.title, hint: 'Session', to: `/sessions/${s.id}`, group: 'Sessions' }));
    const tsk: CmdItem[] = tasks.map((t) => ({ id: 't-' + t.id, label: t.title, hint: 'Task', to: `/tasks/${t.id}`, group: 'Tasks' }));
    const qz: CmdItem[] = quizzes.map((q) => ({ id: 'q-' + q.id, label: q.title, hint: 'Quiz', to: '/quizzes', group: 'Quizzes' }));
    return [...nav, ...mem, ...ses, ...tsk, ...qz];
  }, [members, sessions, tasks, quizzes]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    return items.filter((i) => (i.label + ' ' + i.hint + ' ' + i.group).toLowerCase().includes(s)).slice(0, 12);
  }, [q, items]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (!open) { setQ(''); return; }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      if (e.key === 'Enter') { const it = filtered[active]; if (it) { navigate(it.to); onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, navigate, onClose]);

  if (!open) return null;
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[180] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl card shadow-pop animate-scale-in overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-ink-200/70">
          <Search size={18} className="text-ink-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions, tasks, members, quizzes..." className="flex-1 bg-transparent outline-none text-sm text-ink-800 placeholder:text-ink-400" />
          <kbd className="text-[11px] text-ink-400 bg-ink-100 px-1.5 py-0.5 rounded-md">ESC</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 && <div className="px-4 py-10 text-center text-sm text-ink-500">No results for "{q}"</div>}
          {filtered.map((it, idx) => {
            const showGroup = it.group !== lastGroup; lastGroup = it.group;
            return (
              <div key={it.id}>
                {showGroup && <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-ink-400 uppercase tracking-wider">{it.group}</p>}
                <button onClick={() => { navigate(it.to); onClose(); }} onMouseEnter={() => setActive(idx)} className={`w-full flex items-center gap-3 px-4 h-10 text-left transition-colors ${active === idx ? 'bg-brand-50' : 'hover:bg-ink-50'}`}>
                  <span className={`flex-1 text-sm ${active === idx ? 'text-brand-700 font-medium' : 'text-ink-700'}`}>{it.label}</span>
                  <span className="text-xs text-ink-400">{it.hint}</span>
                  {active === idx && <CornerDownLeft size={14} className="text-brand-500" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-4 h-9 border-t border-ink-200/70 flex items-center gap-4 text-[11px] text-ink-400">
          <span className="flex items-center gap-1"><kbd className="bg-ink-100 px-1 rounded">↑</kbd><kbd className="bg-ink-100 px-1 rounded">↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-ink-100 px-1 rounded">↵</kbd> open</span>
          <span className="ml-auto flex items-center gap-1"><Command size={11} /> + K</span>
        </div>
      </div>
    </div>
  );
}

export function GlobalSearch({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="hidden md:flex items-center gap-2 h-9 w-64 lg:w-72 px-3 rounded-xl bg-ink-100/70 hover:bg-ink-100 border border-transparent hover:border-ink-200 text-sm text-ink-400 transition-all">
      <Search size={15} /><span className="flex-1 text-left">Search...</span>
      <kbd className="text-[10px] bg-white border border-ink-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"><Command size={9} />K</kbd>
    </button>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  const { navigate } = useRouter();
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={13} className="text-ink-300" />}
          {it.to ? <button onClick={() => navigate(it.to!)} className="text-ink-500 hover:text-ink-800 transition-colors">{it.label}</button> : <span className="text-ink-800 font-medium">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

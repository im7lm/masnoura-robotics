import { useMemo, useState } from 'react';
import { Video, CalendarDays, ClipboardList, Star, ArrowRight, Plus, Search } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Badge, SectionHeader, EmptyState, formatDate, daysUntil } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useSessions, useTasks, useQuizzes, useCommittees, useAttendance, useMembers } from '../lib/hooks';

export function SessionsPage() {
  const { data: sessions } = useSessions();
  const { data: tasks } = useTasks();
  const { data: quizzes } = useQuizzes();
  const { data: committees } = useCommittees();
  const [q, setQ] = useState('');

  const filtered = sessions.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => +new Date(b.publish_date) - +new Date(a.publish_date));

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Sessions' }]} />
      <SectionHeader title="Sessions" description="Recorded learning sessions with tasks and quizzes" />
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions..." className="input !pl-9" />
      </div>

      {sorted.length === 0 ? (
        <div className="card"><EmptyState icon={<Video size={22} />} title="No sessions yet" description="Sessions will appear here once created." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((s) => {
            const committee = committees.find((c) => c.id === s.committee_id);
            const sessionTasks = tasks.filter((t) => t.session_id === s.id);
            const sessionQuizzes = quizzes.filter((qz) => qz.session_id === s.id);
            const upcoming = daysUntil(s.publish_date) >= 0;
            return (
              <Link key={s.id} to={`/sessions/${s.id}`} className="card card-hover p-5 block group">
                <div className="flex items-center justify-between mb-3">
                  <Badge tone={upcoming ? 'mint' : 'neutral'}>{upcoming ? 'Upcoming' : 'Past'}</Badge>
                  {committee && <Badge tone="neutral">{committee.name}</Badge>}
                </div>
                <h3 className="font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">{s.title}</h3>
                <p className="text-sm text-ink-500 mt-1 line-clamp-2">{s.description ?? ''}</p>
                <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-3">
                  <CalendarDays size={13} /> {formatDate(s.publish_date, { dateStyle: 'medium' })}
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
                  <span className="flex items-center gap-1"><ClipboardList size={12} /> {sessionTasks.length} tasks</span>
                  <span className="flex items-center gap-1"><Star size={12} /> {sessionQuizzes.length} quizzes</span>
                  {s.video_url && <span className="flex items-center gap-1 ml-auto text-brand-600"><Video size={12} /> Video</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SessionDetailsPage({ id }: { id: string }) {
  const { data: sessions } = useSessions();
  const { data: tasks } = useTasks();
  const { data: quizzes } = useQuizzes();
  const { data: committees } = useCommittees();
  const { data: attendance } = useAttendance();
  const { role } = useAuth();

  const session = sessions.find((s) => s.id === id);
  const sessionTasks = tasks.filter((t) => t.session_id === id);
  const sessionQuizzes = quizzes.filter((qz) => qz.session_id === id);
  const committee = committees.find((c) => c.id === session?.committee_id);
  const sessionAttendance = attendance.filter((a) => a.session_id === id);
  const present = sessionAttendance.filter((a) => a.status === 'present').length;
  const late = sessionAttendance.filter((a) => a.status === 'late').length;
  const absent = sessionAttendance.filter((a) => a.status === 'absent').length;

  if (!session) return <div className="card"><EmptyState icon={<Video size={22} />} title="Session not found" description="This session may have been removed." action={<Link to="/sessions" className="btn-primary btn-md">Back to sessions</Link>} /></div>;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Sessions', to: '/sessions' }, { label: session.title }]} />
      <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">← Back to sessions</Link>

      <div className="card p-6 bg-gradient-to-br from-mint-50/50 to-white">
        <div className="flex items-center gap-2 mb-2">
          {committee && <Badge tone="neutral">{committee.name}</Badge>}
          <Badge tone={daysUntil(session.publish_date) >= 0 ? 'mint' : 'neutral'}>{daysUntil(session.publish_date) >= 0 ? 'Upcoming' : 'Past'}</Badge>
        </div>
        <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">{session.title}</h1>
        <p className="text-sm text-ink-600 mt-2 leading-relaxed max-w-2xl">{session.description ?? 'No description provided.'}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-ink-500">
          <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {formatDate(session.publish_date, { dateStyle: 'full' })}</span>
          {session.video_url && <a href={session.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-600 hover:underline"><Video size={14} /> Watch recording</a>}
        </div>
      </div>

      {/* Attendance summary */}
      <div className="grid grid-cols-3 gap-4">
        <StatBox label="Present" value={present} tone="text-mint-500" />
        <StatBox label="Late" value={late} tone="text-amber-600" />
        <StatBox label="Absent" value={absent} tone="text-brand-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900 flex items-center gap-2"><ClipboardList size={16} className="text-ink-400" /> Tasks ({sessionTasks.length})</h3>
          </div>
          {sessionTasks.length === 0 ? <p className="text-sm text-ink-500">No tasks for this session.</p> : (
            <div className="space-y-2.5">
              {sessionTasks.map((t) => (
                <Link key={t.id} to={`/tasks/${t.id}`} className="block p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all">
                  <p className="text-sm font-medium text-ink-800">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge tone="neutral">{t.submission_type.replace('_', ' ')}</Badge>
                    <span className="text-xs text-ink-400">Due {formatDate(t.deadline, { dateStyle: 'medium' })}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Star size={16} className="text-ink-400" /> Quizzes ({sessionQuizzes.length})</h3>
          </div>
          {sessionQuizzes.length === 0 ? <p className="text-sm text-ink-500">No quizzes for this session.</p> : (
            <div className="space-y-2.5">
              {sessionQuizzes.map((qz) => (
                <Link key={qz.id} to="/quizzes" className="block p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all">
                  <p className="text-sm font-medium text-ink-800">{qz.title}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-ink-400">Due {formatDate(qz.deadline, { dateStyle: 'medium' })}</span>
                    {qz.form_url && <span className="text-xs text-brand-600 flex items-center gap-1">Open form <ArrowRight size={11} /></span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}



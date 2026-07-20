import { useMemo } from 'react';
import { CalendarDays, ClipboardList, Star, Trophy, TrendingUp, Megaphone, Clock, Video, ArrowRight, Users, Building2, Award, CheckCircle2, UserCog } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Avatar, Badge, Progress } from '../components/ui';
import { LineChart } from '../components/Charts';
import { useAuth, ROLE_LABELS } from '../lib/auth';
import { useSessions, useTasks, useQuizzes, useAnnouncements, useMemberScores, useMembers, useAttendance } from '../lib/hooks';
import { formatDate, daysUntil } from '../components/ui';

export function DashboardPage() {
  const { role, profile, activeCommittee, availableCommittees } = useAuth();
  const { data: sessions } = useSessions();
  const { data: tasks } = useTasks();
  const { data: quizzes } = useQuizzes();
  const { data: announcements } = useAnnouncements();
  const { data: scores } = useMemberScores();
  const { data: members } = useMembers();
  const { data: attendance } = useAttendance();

  const today = new Date();
  const upcomingSessions = useMemo(() => sessions.filter((s) => new Date(s.publish_date) >= today).slice(0, 3), [sessions]);
  const nextSession = upcomingSessions[0];
  const openTasks = useMemo(() => tasks.filter((t) => daysUntil(t.deadline) >= 0).sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline)), [tasks]);
  const nextDeadline = openTasks[0];
  const nextQuiz = useMemo(() => quizzes.filter((q) => daysUntil(q.deadline) >= 0).sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))[0], [quizzes]);
  const latestAnnouncement = announcements[0];
  const myScore = scores.find((s) => s.member_id === profile?.id);
  const myRank = scores.findIndex((s) => s.member_id === profile?.id) + 1;
  const pinned = announcements.filter((a) => a.pinned);

  const trend = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => +new Date(a.publish_date) - +new Date(b.publish_date)).slice(-6);
    return sorted.map((s) => {
      const att = attendance.filter((a) => a.session_id === s.id);
      const present = att.filter((a) => a.status === 'present').length;
      const late = att.filter((a) => a.status === 'late').length;
      const rate = att.length ? Math.round(100 * (present + late * 0.5) / att.length) : 0;
      return { label: new Date(s.publish_date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), value: rate };
    });
  }, [sessions, attendance]);

  const greeting = role === 'member' ? "Here's what's on your plate today." : role === 'director' ? "Here's the pulse across your committees." : "Here's the team's pulse today.";

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Dashboard' }]} />
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-ink-900 tracking-tight">Welcome back, {profile?.name?.split(' ')[0] ?? 'there'}</h1>
          <p className="text-sm text-ink-500 mt-1">You're viewing as {ROLE_LABELS[role]}. {greeting}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeCommittee && (
            <Badge tone="neutral"><span className="w-1.5 h-1.5 rounded-full" style={{ background: activeCommittee.color }} />{activeCommittee.name}</Badge>
          )}
          <Badge tone="mint"><span className="w-1.5 h-1.5 rounded-full bg-mint-500" />{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</Badge>
        </div>
      </div>

      {/* Director overview: committee cards */}
      {role === 'director' && availableCommittees.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {availableCommittees.map((c) => {
            const cMembers = members.filter((m) => m.committee_id === c.id);
            const cScores = scores.filter((s) => s.committee_id === c.id);
            const avg = cScores.length ? Math.round(cScores.reduce((a, b) => a + b.total_points, 0) / cScores.length) : 0;
            return (
              <Link key={c.id} to="/members" className="card card-hover p-5 block group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: c.color + '20', color: c.color }}>
                    <Building2 size={18} />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">{c.name}</p>
                    <p className="text-xs text-ink-500 capitalize">{c.type}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Mini label="Members" value={cMembers.length} />
                  <Mini label="Avg Score" value={avg} />
                  <Mini label="Sessions" value={sessions.filter((s) => s.committee_id === c.id).length} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Widget icon={Video} tone="bg-brand-50 text-brand-600" title="Today's Session" link="/sessions">
          {nextSession ? (
            <>
              <p className="text-base font-semibold text-ink-900">{nextSession.title}</p>
              <p className="text-xs text-ink-500 mt-1 line-clamp-2">{nextSession.description ?? 'No description'}</p>
              <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-3">
                <CalendarDays size={13} /> {formatDate(nextSession.publish_date, { dateStyle: 'medium' })}
              </div>
              {nextSession.video_url && (
                <a href={nextSession.video_url} target="_blank" rel="noreferrer" className="btn-primary btn-sm mt-3 w-full">
                  <Video size={14} /> Watch session
                </a>
              )}
            </>
          ) : <Empty label="No session scheduled today" />}
        </Widget>

        <Widget icon={ClipboardList} tone="bg-amber-50 text-amber-600" title="Next Deadline" link="/tasks">
          {nextDeadline ? (
            <>
              <Link to={`/tasks/${nextDeadline.id}`} className="block">
                <p className="text-base font-semibold text-ink-900 hover:text-brand-700 transition-colors">{nextDeadline.title}</p>
              </Link>
              <p className="text-xs text-ink-500 mt-1 line-clamp-2">{nextDeadline.description ?? ''}</p>
              <div className="flex items-center justify-between mt-3">
                <span className={`chip ${daysUntil(nextDeadline.deadline) <= 2 ? 'bg-red-50 text-brand-600' : 'bg-ink-100 text-ink-600'}`}>
                  <Clock size={11} /> {daysUntil(nextDeadline.deadline) === 0 ? 'Due today' : `${daysUntil(nextDeadline.deadline)} days left`}
                </span>
                <Badge tone="neutral">{nextDeadline.submission_type.replace('_', ' ')}</Badge>
              </div>
            </>
          ) : <Empty label="No upcoming deadlines" />}
        </Widget>

        <Widget icon={Star} tone="bg-blue-50 text-blue-600" title="Upcoming Quiz" link="/quizzes">
          {nextQuiz ? (
            <>
              <p className="text-base font-semibold text-ink-900">{nextQuiz.title}</p>
              <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-1">
                <Clock size={13} /> Due {formatDate(nextQuiz.deadline, { dateStyle: 'medium' })}
              </div>
              {nextQuiz.form_url && (
                <a href={nextQuiz.form_url} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-3 w-full">
                  <Star size={14} /> Open quiz form
                </a>
              )}
            </>
          ) : <Empty label="No upcoming quizzes" />}
        </Widget>

        <Widget icon={TrendingUp} tone="bg-mint-100 text-mint-500" title="Attendance Rate" link="/attendance">
          {myScore ? (
            <>
              <p className="text-3xl font-semibold text-ink-900">{myScore.attendance_rate}%</p>
              <p className="text-xs text-ink-500 mt-1">{myScore.present_count} present · {myScore.late_count} late · {myScore.absent_count} absent</p>
              <div className="mt-3"><Progress value={myScore.attendance_rate} tone="mint" /></div>
            </>
          ) : <Empty label="No attendance recorded yet" />}
        </Widget>

        <Widget icon={Trophy} tone="bg-amber-50 text-amber-600" title="Current Rank" link="/leaderboard">
          {myScore && profile ? (
            <>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${myRank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>
                  #{myRank || '—'}
                </div>
                <div>
                  <p className="text-2xl font-semibold text-ink-900">{myScore.total_points}<span className="text-sm text-ink-400"> pts</span></p>
                  <p className="text-xs text-ink-500">of {scores.length} members</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <Mini label="Tasks" value={myScore.tasks_completed} />
                <Mini label="Quizzes" value={myScore.quizzes_completed} />
                <Mini label="Bonuses" value={`+${myScore.bonus_points}`} />
              </div>
            </>
          ) : <Empty label="No scores yet" />}
        </Widget>

        <Widget icon={Megaphone} tone="bg-purple-50 text-purple-700" title="Latest Announcement" link="/announcements">
          {latestAnnouncement ? (
            <>
              <p className="text-base font-semibold text-ink-900">{latestAnnouncement.title}</p>
              <p className="text-xs text-ink-500 mt-1 line-clamp-3">{latestAnnouncement.body}</p>
              <p className="text-[11px] text-ink-400 mt-2">{formatDate(latestAnnouncement.created_at, { dateStyle: 'medium' })}</p>
            </>
          ) : <Empty label="No announcements yet" />}
        </Widget>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-ink-900">Attendance Trend</h3>
              <p className="text-xs text-ink-500 mt-0.5">{activeCommittee ? `${activeCommittee.name} attendance` : 'Team attendance'} over recent sessions</p>
            </div>
            <Badge tone="mint">Last 6 sessions</Badge>
          </div>
          {trend.length > 0 ? <LineChart data={trend} height={180} /> : <Empty label="Not enough data yet" />}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900">Top Performers</h3>
            <Link to="/leaderboard" className="text-xs text-brand-600 hover:underline flex items-center gap-1">View all <ArrowRight size={11} /></Link>
          </div>
          <div className="space-y-2.5">
            {scores.slice(0, 5).map((s, i) => {
              const m = members.find((x) => x.id === s.member_id);
              return (
                <Link key={s.member_id} to={`/members/${s.member_id}`} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-ink-50 transition-colors group">
                  <span className={`w-6 text-center text-sm font-semibold ${i === 0 ? 'text-amber-600' : i === 1 ? 'text-ink-500' : i === 2 ? 'text-amber-700' : 'text-ink-400'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </span>
                  <Avatar src={m?.avatar_url ?? null} name={s.name} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate group-hover:text-brand-700 transition-colors">{s.name}</p>
                    <p className="text-xs text-ink-500">{s.tasks_completed} tasks · {s.quizzes_completed} quizzes</p>
                  </div>
                  <span className="text-sm font-semibold text-ink-800">{s.total_points}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2"><Megaphone size={16} className="text-brand-600" /> Pinned Announcements</h3>
          <div className="space-y-2">
            {pinned.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-ink-50 border border-ink-200/60">
                <Badge tone="brand">Pinned</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-800">{a.title}</p>
                  <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{a.body}</p>
                </div>
                <Link to="/announcements" className="text-xs text-brand-600 hover:underline shrink-0">Read</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Widget({ icon: Icon, tone, title, link, children }: { icon: LucideIcon; tone: string; title: string; link: string; children: React.ReactNode }) {
  return (
    <Link to={link} className="card card-hover p-5 block group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}><Icon size={17} /></span>
          <span className="text-sm font-medium text-ink-600">{title}</span>
        </div>
        <ArrowRight size={14} className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
      </div>
      {children}
    </Link>
  );
}

function Empty({ label }: { label: string }) { return <p className="text-sm text-ink-400 py-2">{label}</p>; }
function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2 rounded-lg bg-ink-50">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="text-sm font-semibold text-ink-800">{value}</p>
    </div>
  );
}

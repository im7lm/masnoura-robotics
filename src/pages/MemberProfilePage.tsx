import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Phone, Calendar, Star, Award, AlertTriangle, TrendingUp, CheckCircle2, Clock, XCircle, FileText, Send, Flame, Trophy } from 'lucide-react';
import { Breadcrumbs, Link } from '../components/Router';
import { Avatar, Badge, StatusBadge, RoleBadge, Progress, EmptyState, formatDate, AttendanceBadge } from '../components/ui';
import { useMembers, useCommittees, useMemberScores, useAttendance, useSessions, useTaskGrades, useTasks, useQuizScores, useQuizzes, useStrikes, useBonuses } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

export function MemberProfilePage({ id }: { id: string }) {
  const { data: members } = useMembers();
  const { data: committees } = useCommittees();
  const { data: scores } = useMemberScores();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const { data: taskGrades } = useTaskGrades();
  const { data: tasks } = useTasks();
  const { data: quizScores } = useQuizScores();
  const { data: quizzes } = useQuizzes();
  const { data: strikes } = useStrikes();
  const { data: bonuses } = useBonuses();
  const { role } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<'overview' | 'attendance' | 'tasks' | 'quizzes' | 'notes'>('overview');
  const [note, setNote] = useState('');

  const member = members.find((m) => m.id === id);
  const score = scores.find((s) => s.member_id === id);
  const rank = scores.findIndex((s) => s.member_id === id) + 1;
  const committee = committees.find((c) => c.id === member?.committee_id);

  const myAttendance = attendance.filter((a) => a.member_id === id);
  const myTaskGrades = taskGrades.filter((g) => g.member_id === id);
  const myQuizScores = quizScores.filter((s) => s.member_id === id);
  const myStrikes = strikes.filter((s) => s.member_id === id);
  const myBonuses = bonuses.filter((b) => b.member_id === id);

  if (!member) return <div className="card"><EmptyState icon={<Star size={22} />} title="Member not found" description="This profile doesn't exist." action={<Link to="/members" className="btn-primary btn-md">Back to members</Link>} /></div>;

  const canAddNote = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(role);

  const addNote = async () => {
    if (!note.trim()) return;
    const newNotes = [...member.notes, { from: 'You', date: new Date().toISOString().slice(0, 10), text: note }];
    const { error } = await supabase.from('members').update({ notes: newNotes }).eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Note added'); setNote('');
    window.location.reload();
  };

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'attendance' as const, label: 'Attendance' },
    { key: 'tasks' as const, label: 'Tasks' },
    { key: 'quizzes' as const, label: 'Quizzes' },
    { key: 'notes' as const, label: 'Notes' },
  ];

  const streak = (() => {
    const sorted = myAttendance.sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at));
    let s = 0; for (const a of sorted) { if (a.status === 'present') s++; else break; } return s;
  })();

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Members', to: '/members' }, { label: member.name }]} />
      <Link to="/members" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors"><ArrowLeft size={15} /> Back to members</Link>

      <div className="card p-6 bg-gradient-to-br from-mint-50/60 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar src={member.avatar_url} name={member.name} size={84} className="ring-4 ring-white shadow-soft" />
          <div className="flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-semibold text-ink-900 tracking-tight">{member.name}</h1>
              <StatusBadge status={member.status} />
              <RoleBadge role={member.role} />
            </div>
            <p className="text-sm text-ink-600 mt-1">{member.position}{committee && ` · ${committee.name} Committee`}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-sm text-ink-500">
              <span className="flex items-center gap-1.5"><Mail size={14} /> {member.email}</span>
              {member.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {member.phone}</span>}
              <span className="flex items-center gap-1.5"><Calendar size={14} /> Joined {formatDate(member.join_date, { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Points breakdown + rank */}
      {score && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-5">
            <p className="text-xs text-ink-500">Final Score</p>
            <p className="text-3xl font-semibold text-ink-900 mt-1">{score.total_points}</p>
            <p className="text-xs text-ink-400 mt-1">points</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-ink-500">Current Rank</p>
            <p className="text-3xl font-semibold text-amber-600 mt-1 flex items-center gap-1.5">
              {rank <= 3 && <Trophy size={22} />}#{rank || '—'}
            </p>
            <p className="text-xs text-ink-400 mt-1">of {scores.length} members</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-ink-500">Attendance</p>
            <p className="text-3xl font-semibold text-mint-500 mt-1">{score.attendance_rate}%</p>
            <div className="mt-2"><Progress value={score.attendance_rate} tone="mint" /></div>
          </div>
          <div className="card p-5">
            <p className="text-xs text-ink-500">Current Streak</p>
            <p className="text-3xl font-semibold text-brand-600 mt-1 flex items-center gap-1.5"><Flame size={22} />{streak}</p>
            <p className="text-xs text-ink-400 mt-1">sessions in a row</p>
          </div>
        </div>
      )}

      {/* Points breakdown formula */}
      {score && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-brand-600" /> Points Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Calc label="Attendance" value={score.attendance_points} tone="text-mint-500" sign="+" />
            <Calc label="Tasks" value={score.task_points} tone="text-blue-600" sign="+" />
            <Calc label="Quizzes" value={score.quiz_points} tone="text-purple-600" sign="+" />
            <Calc label="Bonuses" value={score.bonus_points} tone="text-amber-600" sign="+" />
            <Calc label="Strikes" value={score.strike_points} tone="text-brand-600" sign="−" />
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100">
            <span className="text-sm font-medium text-ink-600">= Final Score</span>
            <span className="text-xl font-semibold text-ink-900">{score.total_points} pts</span>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-ink-200/70 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 h-10 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Personal Information</h3>
            <dl className="space-y-3 text-sm">
              {[['Full name', member.name], ['Email', member.email], ['Phone', member.phone ?? '—'], ['Committee', committee?.name ?? '—'], ['Position', member.position], ['Role', member.role], ['Joined', formatDate(member.join_date, { dateStyle: 'medium' })]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5 border-b border-ink-100 last:border-0">
                  <dt className="text-ink-500">{k}</dt><dd className="text-ink-800 font-medium text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2"><Award size={16} className="text-amber-600" /> Bonuses ({myBonuses.length})</h3>
              <div className="space-y-2">
                {myBonuses.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                    <Award size={15} className="text-amber-600" />
                    <div className="flex-1"><p className="text-sm font-medium text-ink-800">{b.reason}</p><p className="text-xs text-ink-500">{formatDate(b.date, { dateStyle: 'medium' })}</p></div>
                    <span className="text-sm font-semibold text-amber-600">+{b.points}</span>
                  </div>
                ))}
                {myBonuses.length === 0 && <p className="text-sm text-ink-500">No bonuses.</p>}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-brand-600" /> Strikes ({myStrikes.length})</h3>
              <div className="space-y-2">
                {myStrikes.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle size={15} className="text-brand-600" />
                    <div className="flex-1"><p className="text-sm font-medium text-ink-800">{s.reason}</p><p className="text-xs text-ink-500">{formatDate(s.date, { dateStyle: 'medium' })}</p></div>
                    <span className="text-sm font-semibold text-brand-600">−{s.points}</span>
                  </div>
                ))}
                {myStrikes.length === 0 && <p className="text-sm text-ink-500">No strikes. Clean record.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Attendance History</h3>
          <div className="space-y-1">
            {myAttendance.sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at)).map((a) => {
              const session = sessions.find((s) => s.id === a.session_id);
              return (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-0">
                  <div className="w-10 h-10 rounded-lg bg-ink-100 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-ink-400 uppercase">{session ? new Date(session.end_date).toLocaleDateString('en', { month: 'short' }) : '—'}</span>
                    <span className="text-sm font-semibold text-ink-800 leading-none">{session ? new Date(session.end_date).getDate() : '—'}</span>
                  </div>
                  <p className="flex-1 text-sm font-medium text-ink-800">{session?.title ?? 'Session'}</p>
                  <AttendanceBadge status={a.status} />
                </div>
              );
            })}
            {myAttendance.length === 0 && <p className="text-sm text-ink-500">No attendance recorded.</p>}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Task History ({myTaskGrades.length})</h3>
          <div className="space-y-2.5">
            {myTaskGrades.map((g) => {
              const task = tasks.find((t) => t.id === g.task_id);
              const total = g.points + g.bonus;
              return (
                <Link key={g.id} to={`/tasks/${g.task_id}`} className="block p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-800">{task?.title ?? 'Task'}</p>
                    <Badge tone="mint">{g.points} pts{g.bonus ? ` (+${g.bonus} bonus)` : ''}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-ink-500">Total earned: {total}</p>
                    {g.updated_at && <p className="text-xs text-ink-400">{formatDate(g.updated_at, { dateStyle: 'medium' })}</p>}
                  </div>
                  {g.leader_note && <p className="text-xs text-ink-600 italic mt-2 pl-3 border-l-2 border-ink-200">{g.leader_note}</p>}
                </Link>
              );
            })}
            {myTaskGrades.length === 0 && <p className="text-sm text-ink-500">No graded tasks yet.</p>}
          </div>
        </div>
      )}

      {tab === 'quizzes' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Quiz History ({myQuizScores.length})</h3>
          <div className="space-y-2.5">
            {myQuizScores.map((s) => {
              const quiz = quizzes.find((q) => q.id === s.quiz_id);
              return (
                <div key={s.id} className="p-3 rounded-xl border border-ink-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-800">{quiz?.title ?? 'Quiz'}</p>
                    <Badge tone="mint">Score {s.score}{s.bonus ? ` +${s.bonus}` : ''}</Badge>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">{formatDate(s.recorded_at, { dateStyle: 'medium' })}</p>
                </div>
              );
            })}
            {myQuizScores.length === 0 && <p className="text-sm text-ink-500">No quiz scores yet.</p>}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="card p-5 max-w-2xl">
          <h3 className="font-semibold text-ink-900 mb-4 flex items-center gap-2"><FileText size={16} className="text-ink-400" /> Leader Notes</h3>
          <div className="space-y-3">
            {member.notes.map((n, i) => (
              <div key={i} className="p-4 rounded-xl bg-ink-50 border border-ink-200/60">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-ink-800">{n.from}</span>
                  <span className="text-xs text-ink-400">{formatDate(n.date, { dateStyle: 'medium' })}</span>
                </div>
                <p className="text-sm text-ink-600 leading-relaxed">{n.text}</p>
              </div>
            ))}
            {member.notes.length === 0 && <p className="text-sm text-ink-500">No notes yet.</p>}
          </div>
          {canAddNote && (
            <div className="mt-5">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note visible to other leaders..." className="input !h-auto py-2 resize-none" />
              <div className="flex justify-end mt-2">
                <button className="btn-primary btn-md" onClick={addNote}><Send size={14} /> Add note</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Calc({ label, value, tone, sign }: { label: string; value: number; tone: string; sign: string }) {
  return (
    <div className="p-3 rounded-xl bg-ink-50 text-center">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${tone}`}>{sign}{value}</p>
    </div>
  );
}

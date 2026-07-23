import { useEffect, useMemo, useState } from 'react';
import { Star, Save, Plus, X, TrendingUp, Award, Zap, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Avatar, Badge, SectionHeader, EmptyState, Progress, formatDate } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useMembers, useSessions, useAttendance, useTaskGrades, useTasks, useQuizScores, useStrikes, useBonuses, useMemberScores } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { LineChart } from '../components/Charts';

export function EvaluationPage() {
  const { role } = useAuth();
  const { push } = useToast();
  const { data: members } = useMembers();
  const { data: scores, refetch } = useMemberScores();
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<'breakdown' | 'strikes' | 'bonuses' | 'history'>('breakdown');

  useEffect(() => {
    if (!selectedId && members.length) setSelectedId(members[0].id);
  }, [members, selectedId]);

  const member = members.find((m) => m.id === selectedId);
  const score = scores.find((s) => s.member_id === selectedId);
  const rank = scores.findIndex((s) => s.member_id === selectedId) + 1;

  const canEdit = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(role);

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Evaluation' }]} />
      <SectionHeader title="Evaluation System" description="HR enters data — final scores calculate automatically" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card p-4 lg:max-h-[680px] overflow-y-auto">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider px-1 mb-2">Members</p>
          <div className="space-y-1">
            {scores.map((s, i) => {
              const m = members.find((x) => x.id === s.member_id);
              if (!m) return null;
              return (
                <button key={s.member_id} onClick={() => setSelectedId(s.member_id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${selectedId === s.member_id ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-ink-50'}`}>
                  <span className="text-xs font-semibold text-ink-400 w-5">{i + 1}</span>
                  <Avatar src={m.avatar_url} name={m.name} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 truncate">{m.name}</p>
                    <p className="text-xs text-ink-500">{m.position}</p>
                  </div>
                  <span className={`text-sm font-semibold ${i < 3 ? 'text-amber-600' : 'text-ink-700'}`}>{s.total_points}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {member && score ? (
            <>
              <div className="card p-6 bg-gradient-to-br from-mint-50/50 to-white">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar src={member.avatar_url} name={member.name} size={64} className="ring-4 ring-white shadow-soft" />
                  <div className="flex-1">
                    <Link to={`/members/${member.id}`} className="text-xl font-semibold text-ink-900 hover:text-brand-700 transition-colors">{member.name}</Link>
                    <p className="text-sm text-ink-500">{member.position}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-500">Final Score</p>
                    <p className="text-4xl font-semibold text-ink-900">{score.total_points}</p>
                    <Badge tone={rank <= 3 ? 'amber' : 'neutral'}>Rank #{rank}</Badge>
                  </div>
                </div>
              </div>

              {/* Auto-calc formula */}
              <div className="card p-5">
                <h3 className="font-semibold text-ink-900 mb-1 flex items-center gap-2"><Zap size={16} className="text-brand-600" /> Final Score Calculation</h3>
                <p className="text-xs text-ink-500 mb-4">Updates automatically as HR enters data — no manual calculation needed.</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <Calc label="Attendance" value={score.attendance_points} tone="text-mint-500" sign="+" />
                  <Calc label="Tasks" value={score.task_points} tone="text-blue-600" sign="+" />
                  <Calc label="Quizzes" value={score.quiz_points} tone="text-purple-600" sign="+" />
                  <Calc label="Bonuses" value={score.bonus_points} tone="text-amber-600" sign="+" />
                  <Calc label="Strikes" value={score.strike_points} tone="text-brand-600" sign="−" />
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink-100">
                  <span className="text-sm font-medium text-ink-600">= Final Score</span>
                  <span className="text-2xl font-semibold text-ink-900">{score.total_points} pts</span>
                </div>
              </div>

              <div className="flex gap-1 border-b border-ink-200/70 overflow-x-auto no-scrollbar">
                {([['breakdown', 'Breakdown'], ['strikes', 'Strikes'], ['bonuses', 'Bonuses'], ['history', 'Attendance History']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`px-4 h-10 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>{l}</button>
                ))}
              </div>

              {tab === 'breakdown' && <BreakdownTab memberId={member.id} canEdit={canEdit} push={push} refetch={refetch} />}
              {tab === 'strikes' && <StrikesTab memberId={member.id} canEdit={canEdit} push={push} refetch={refetch} />}
              {tab === 'bonuses' && <BonusesTab memberId={member.id} canEdit={canEdit} push={push} refetch={refetch} />}
              {tab === 'history' && <HistoryTab memberId={member.id} />}
            </>
          ) : (
            <div className="card"><EmptyState icon={<Star size={22} />} title="Select a member" description="Choose a member from the list to view their evaluation." /></div>
          )}
        </div>
      </div>
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

function BreakdownTab({ memberId, canEdit, push, refetch }: { memberId: string; canEdit: boolean; push: (t: 'success' | 'error' | 'info', m: string) => void; refetch: () => void }) {
  const { data: grades } = useTaskGrades();
  const { data: tasks } = useTasks();
  const { data: quizScores } = useQuizScores();
  const [editing, setEditing] = useState<Record<string, { score: string; bonus: string }>>({});

  const myGrades = grades.filter((g) => g.member_id === memberId);
  const myQuizzes = quizScores.filter((s) => s.member_id === memberId);

  const saveTask = async (gradeId: string) => {
    const v = editing[gradeId];
    if (!v) return;
    const { error } = await supabase.from('task_grades').update({ points: Number(v.score) || 0, bonus: Number(v.bonus) || 0 }).eq('id', gradeId);
    if (error) { push('error', error.message); return; }
    push('success', 'Task score saved'); refetch(); setEditing((e) => { const n = { ...e }; delete n[gradeId]; return n; });
  };

  const saveQuiz = async (scoreId: string) => {
    const v = editing[scoreId];
    if (!v) return;
    const { error } = await supabase.from('quiz_scores').update({ score: Number(v.score) || 0, bonus: Number(v.bonus) || 0 }).eq('id', scoreId);
    if (error) { push('error', error.message); return; }
    push('success', 'Quiz score saved'); refetch(); setEditing((e) => { const n = { ...e }; delete n[scoreId]; return n; });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-3">Task Scores ({myGrades.length})</h3>
        {myGrades.length === 0 ? <p className="text-sm text-ink-500">No task grades yet.</p> : (
          <div className="space-y-2.5">
            {myGrades.map((g) => {
              const task = tasks.find((t) => t.id === g.task_id);
              const editing_ = editing[g.id];
              return (
                <div key={g.id} className="p-3 rounded-xl border border-ink-200">
                  <p className="text-sm font-medium text-ink-800 truncate">{task?.title ?? 'Task'}</p>
                  {g.leader_note && <p className="text-xs text-ink-500 italic mt-1">“{g.leader_note}”</p>}
                  {canEdit ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input type="number" min="0" placeholder="Points" defaultValue={g.points} onChange={(e) => setEditing((v) => ({ ...v, [g.id]: { ...v[g.id] ?? { score: '', bonus: '' }, score: e.target.value } }))} className="input !h-8 !w-20 text-center" />
                      <input type="number" min="0" placeholder="Bonus" defaultValue={g.bonus} onChange={(e) => setEditing((v) => ({ ...v, [g.id]: { ...v[g.id] ?? { score: '', bonus: '' }, bonus: e.target.value } }))} className="input !h-8 !w-20 text-center" />
                      <button className="btn-primary btn-sm" onClick={() => saveTask(g.id)}><Save size={12} /></button>
                    </div>
                  ) : <Badge tone="mint">{g.points} pts{g.bonus ? ` (+${g.bonus} bonus)` : ''}</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-3">Quiz Scores ({myQuizzes.length})</h3>
        {myQuizzes.length === 0 ? <p className="text-sm text-ink-500">No quiz scores yet.</p> : (
          <div className="space-y-2.5">
            {myQuizzes.map((s) => {
              return (
                <div key={s.id} className="p-3 rounded-xl border border-ink-200">
                  <p className="text-sm font-medium text-ink-800 truncate">Quiz: {s.quiz_id.slice(0, 8)}...</p>
                  <p className="text-xs text-ink-500 mb-2">{formatDate(s.recorded_at, { dateStyle: 'medium' })}</p>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" max="10" placeholder="Score" defaultValue={s.score} onChange={(e) => setEditing((v) => ({ ...v, [s.id]: { ...v[s.id] ?? { score: '', bonus: '' }, score: e.target.value } }))} className="input !h-8 !w-20 text-center" />
                      <input type="number" placeholder="Bonus" defaultValue={s.bonus} onChange={(e) => setEditing((v) => ({ ...v, [s.id]: { ...v[s.id] ?? { score: '', bonus: '' }, bonus: e.target.value } }))} className="input !h-8 !w-20 text-center" />
                      <button className="btn-primary btn-sm" onClick={() => saveQuiz(s.id)}><Save size={12} /></button>
                    </div>
                  ) : <Badge tone="mint">Score {s.score}{s.bonus ? ` +${s.bonus}` : ''}</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StrikesTab({ memberId, canEdit, push, refetch }: { memberId: string; canEdit: boolean; push: (t: 'success' | 'error' | 'info', m: string) => void; refetch: () => void }) {
  const { data: strikes, refetch: r2 } = useStrikes();
  const [reason, setReason] = useState('');
  const [points, setPoints] = useState('5');

  const mine = strikes.filter((s) => s.member_id === memberId);

  const add = async () => {
    if (!reason.trim()) { push('error', 'Add a reason'); return; }
    const { error } = await supabase.from('strikes').insert({ member_id: memberId, reason, points: Number(points) || 0, date: new Date().toISOString().slice(0, 10) });
    if (error) { push('error', error.message); return; }
    push('success', 'Strike recorded'); setReason(''); setPoints('5'); refetch(); r2();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('strikes').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Strike removed'); refetch(); r2();
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-ink-900 flex items-center gap-2"><AlertTriangle size={16} className="text-brand-600" /> Strikes ({mine.length})</h3>
        <span className="text-sm text-brand-600 font-medium">−{mine.reduce((s, x) => s + x.points, 0)} pts</span>
      </div>
      <div className="space-y-2 mb-4">
        {mine.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
            <AlertTriangle size={16} className="text-brand-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-800">{s.reason}</p>
              <p className="text-xs text-ink-500">{formatDate(s.date, { dateStyle: 'medium' })} · −{s.points} pts</p>
            </div>
            {canEdit && <button onClick={() => remove(s.id)} className="btn-ghost btn-sm !px-2 text-brand-600"><X size={14} /></button>}
          </div>
        ))}
        {mine.length === 0 && <p className="text-sm text-ink-500">No strikes. Clean record.</p>}
      </div>
      {canEdit && (
        <div className="flex gap-2 pt-4 border-t border-ink-100">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for strike" className="input flex-1" />
          <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="input !w-20 text-center" />
          <button className="btn-primary btn-md" onClick={add}><Plus size={14} /> Add</button>
        </div>
      )}
    </div>
  );
}

function BonusesTab({ memberId, canEdit, push, refetch }: { memberId: string; canEdit: boolean; push: (t: 'success' | 'error' | 'info', m: string) => void; refetch: () => void }) {
  const { data: bonuses, refetch: r2 } = useBonuses();
  const [reason, setReason] = useState('');
  const [points, setPoints] = useState('5');

  const mine = bonuses.filter((b) => b.member_id === memberId);

  const add = async () => {
    if (!reason.trim()) { push('error', 'Add a reason'); return; }
    const { error } = await supabase.from('bonuses').insert({ member_id: memberId, reason, points: Number(points) || 0, date: new Date().toISOString().slice(0, 10) });
    if (error) { push('error', error.message); return; }
    push('success', 'Bonus added'); setReason(''); setPoints('5'); refetch(); r2();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('bonuses').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Bonus removed'); refetch(); r2();
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Award size={16} className="text-amber-600" /> Bonuses ({mine.length})</h3>
        <span className="text-sm text-amber-600 font-medium">+{mine.reduce((s, x) => s + x.points, 0)} pts</span>
      </div>
      <div className="space-y-2 mb-4">
        {mine.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <Award size={16} className="text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-800">{b.reason}</p>
              <p className="text-xs text-ink-500">{formatDate(b.date, { dateStyle: 'medium' })} · +{b.points} pts</p>
            </div>
            {canEdit && <button onClick={() => remove(b.id)} className="btn-ghost btn-sm !px-2 text-brand-600"><X size={14} /></button>}
          </div>
        ))}
        {mine.length === 0 && <p className="text-sm text-ink-500">No bonuses yet.</p>}
      </div>
      {canEdit && (
        <div className="flex gap-2 pt-4 border-t border-ink-100">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for bonus" className="input flex-1" />
          <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="input !w-20 text-center" />
          <button className="btn-primary btn-md" onClick={add}><Plus size={14} /> Add</button>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ memberId }: { memberId: string }) {
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const mine = attendance.filter((a) => a.member_id === memberId);
  const sorted = [...mine].sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at));

  const present = mine.filter((a) => a.status === 'present').length;
  const late = mine.filter((a) => a.status === 'late').length;
  const absent = mine.filter((a) => a.status === 'absent').length;
  const rate = mine.length ? Math.round(100 * (present + late * 0.5) / mine.length) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Rate" value={`${rate}%`} tone="text-mint-500" />
        <Stat label="Present" value={present} tone="text-mint-500" />
        <Stat label="Late" value={late} tone="text-amber-600" />
        <Stat label="Absent" value={absent} tone="text-brand-600" />
      </div>
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-3">Attendance History</h3>
        <div className="space-y-1">
          {sorted.map((a) => {
            const session = sessions.find((s) => s.id === a.session_id);
            return (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-ink-100 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-ink-400 uppercase">{session ? new Date(session.end_date).toLocaleDateString('en', { month: 'short' }) : '—'}</span>
                  <span className="text-sm font-semibold text-ink-800 leading-none">{session ? new Date(session.end_date).getDate() : '—'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-800">{session?.title ?? 'Session'}</p>
                </div>
                {a.status === 'present' ? <Badge tone="mint"><CheckCircle2 size={11} /> Present</Badge> : a.status === 'late' ? <Badge tone="amber"><Clock size={11} /> Late</Badge> : <Badge tone="red"><XCircle size={11} /> Absent</Badge>}
              </div>
            );
          })}
          {sorted.length === 0 && <p className="text-sm text-ink-500">No attendance recorded.</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

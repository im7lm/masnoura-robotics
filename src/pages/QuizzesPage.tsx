import { useMemo, useState } from 'react';
import { Star, Search, ExternalLink, Clock, CheckCircle2, XCircle, ArrowLeft, Save } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Badge, SectionHeader, EmptyState, formatDate, daysUntil, Avatar, Field, Modal, Progress } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useQuizzes, useSessions, useQuizScores, useMembers } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

export function QuizzesPage() {
  const { data: quizzes } = useQuizzes();
  const { data: sessions } = useSessions();
  const { data: scores } = useQuizScores();
  const { data: members } = useMembers();
  const { profile, role } = useAuth();
  const { push } = useToast();
  const [q, setQ] = useState('');
  const [scoring, setScoring] = useState<string | null>(null);

  const filtered = quizzes.filter((qz) => qz.title.toLowerCase().includes(q.toLowerCase()));

  const myScore = (quizId: string) => scores.find((s) => s.quiz_id === quizId && s.member_id === profile?.id);

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Quizzes' }]} />
      <SectionHeader title="Quizzes" description="Take quizzes and view your scores" />
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quizzes..." className="input !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Star size={22} />} title="No quizzes yet" description="Quizzes will appear here once created." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((qz) => {
            const session = sessions.find((s) => s.id === qz.session_id);
            const mine = myScore(qz.id);
            const overdue = daysUntil(qz.deadline) < 0;
            return (
              <div key={qz.id} className="card card-hover p-5">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone="blue">Quiz</Badge>
                  {mine ? <Badge tone="mint">Scored {mine.score}{mine.bonus ? ` +${mine.bonus}` : ''}</Badge>
                    : overdue ? <Badge tone="red">Closed</Badge>
                    : <Badge tone="blue">Open</Badge>}
                </div>
                <h3 className="font-semibold text-ink-900">{qz.title}</h3>
                {session && <p className="text-xs text-ink-400 mt-1">From: {session.title}</p>}
                <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-3">
                  <Clock size={12} /> Due {formatDate(qz.deadline, { dateStyle: 'medium' })}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-ink-100">
                  {qz.form_url && !mine && (
                    <a href={qz.form_url} target="_blank" rel="noreferrer" className="btn-primary btn-sm flex-1">
                      <ExternalLink size={14} /> Open form
                    </a>
                  )}
                  {mine && <span className="text-xs text-mint-500 flex items-center gap-1"><CheckCircle2 size={13} /> Completed</span>}
                  {['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(role) && (
                    <button onClick={() => setScoring(qz.id)} className="btn-secondary btn-sm flex-1"><Save size={13} /> Enter scores</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scoring && <ScoringModal quizId={scoring} onClose={() => setScoring(null)} push={push} />}
    </div>
  );
}

function ScoringModal({ quizId, onClose, push }: { quizId: string; onClose: () => void; push: (t: 'success' | 'error' | 'info', m: string) => void }) {
  const { data: quizzes } = useQuizzes();
  const { data: scores } = useQuizScores();
  const { data: members } = useMembers();
  const quiz = quizzes.find((q) => q.id === quizId);
  const [values, setValues] = useState<Record<string, { score: string; bonus: string }>>(
    Object.fromEntries(members.map((m) => {
      const existing = scores.find((s) => s.quiz_id === quizId && s.member_id === m.id);
      return [m.id, { score: existing ? String(existing.score) : '', bonus: existing ? String(existing.bonus) : '' }];
    }))
  );

  const save = async () => {
    const rows = members.map((m) => {
      const v = values[m.id];
      if (v.score === '' && v.bonus === '') return null;
      return { quiz_id: quizId, member_id: m.id, score: Number(v.score) || 0, bonus: Number(v.bonus) || 0 };
    }).filter(Boolean) as { quiz_id: string; member_id: string; score: number; bonus: number }[];
    if (rows.length === 0) { push('info', 'Enter at least one score'); return; }
    const { error } = await supabase.from('quiz_scores').upsert(rows, { onConflict: 'quiz_id,member_id' });
    if (error) { push('error', error.message); return; }
    push('success', 'Quiz scores saved');
    onClose();
  };

  if (!quiz) return null;

  return (
    <Modal open onClose={onClose} title={`Score: ${quiz.title}`} width="max-w-xl" footer={<>
      <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
      <button className="btn-primary btn-md" onClick={save}><Save size={14} /> Save scores</button>
    </>}>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50">
            <Avatar src={m.avatar_url} name={m.name} size={30} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-800 truncate">{m.name}</p>
              <p className="text-xs text-ink-500">{m.position}</p>
            </div>
            <input type="number" min="0" max="10" placeholder="Score" value={values[m.id].score} onChange={(e) => setValues((v) => ({ ...v, [m.id]: { ...v[m.id], score: e.target.value } }))} className="input !w-20 !h-8 text-center" />
            <input type="number" placeholder="Bonus" value={values[m.id].bonus} onChange={(e) => setValues((v) => ({ ...v, [m.id]: { ...v[m.id], bonus: e.target.value } }))} className="input !w-20 !h-8 text-center" />
          </div>
        ))}
      </div>
    </Modal>
  );
}

import { useMemo, useState, useEffect, useRef } from 'react';
import { Star, Search, ExternalLink, Clock, CheckCircle2, Lock, Save, Plus, Pencil, Trash2, GraduationCap, Award, StickyNote } from 'lucide-react';
import { Breadcrumbs } from '../components/Router';
import { Badge, SectionHeader, EmptyState, formatDate, daysUntil, Avatar, Modal, Field } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useQuizzes, useSessions, useQuizScores, useMembers, useSections } from '../lib/hooks';
import { supabase, type Quiz, type QuizScore } from '../lib/supabase';
import { useToast } from '../components/Toast';

const MANAGE_ROLES = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'];

function isQuizOpen(quiz: Quiz): boolean {
  if (!quiz.start_datetime) return true; // no start time = always open
  return new Date(quiz.start_datetime) <= new Date();
}

export function QuizzesPage() {
  const { data: quizzes, refetch } = useQuizzes();
  const { data: sessions } = useSessions();
  const { data: scores } = useQuizScores();
  const { data: members } = useMembers();
  const { profile, role } = useAuth();
  const { push } = useToast();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [gradingQuizId, setGradingQuizId] = useState<string | null>(null);

  const canManage = MANAGE_ROLES.includes(role);
  const filtered = quizzes.filter((qz) => qz.title.toLowerCase().includes(q.toLowerCase()));

  const now = new Date();
  const openQuizzes = filtered.filter((qz) => isQuizOpen(qz) && daysUntil(qz.deadline) >= 0);
  const lockedQuizzes = filtered.filter((qz) => !isQuizOpen(qz));
  const closedQuizzes = filtered.filter((qz) => isQuizOpen(qz) && daysUntil(qz.deadline) < 0);

  const myScore = (quizId: string) => scores.find((s) => s.quiz_id === quizId && s.member_id === profile?.id);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quiz and all its scores?')) return;
    await supabase.from('quiz_scores').delete().eq('quiz_id', id);
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Quiz deleted');
    refetch();
  };

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Quizzes' }]} />
      <SectionHeader
        title="Quizzes"
        description="Take quizzes and track your scores"
        action={canManage && (
          <button className="btn-primary btn-md" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> New Quiz
          </button>
        )}
      />

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quizzes..." className="input !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Star size={22} />} title="No quizzes yet" description="Quizzes will appear here once created." /></div>
      ) : (
        <div className="space-y-8">
          {openQuizzes.length > 0 && (
            <QuizSection title="Open Quizzes" accent="bg-mint-500" quizzes={openQuizzes}
              sessions={sessions} scores={scores} myScore={myScore}
              canManage={canManage} onEdit={setEditQuiz}
              onDelete={handleDelete} onGrade={setGradingQuizId} />
          )}
          {lockedQuizzes.length > 0 && (
            <QuizSection title="Scheduled — Not Open Yet" accent="bg-amber-400" quizzes={lockedQuizzes}
              sessions={sessions} scores={scores} myScore={myScore}
              canManage={canManage} onEdit={setEditQuiz}
              onDelete={handleDelete} onGrade={setGradingQuizId} />
          )}
          {closedQuizzes.length > 0 && (
            <QuizSection title="Closed Quizzes" accent="bg-ink-300" quizzes={closedQuizzes}
              sessions={sessions} scores={scores} myScore={myScore}
              canManage={canManage} onEdit={setEditQuiz}
              onDelete={handleDelete} onGrade={setGradingQuizId} />
          )}
        </div>
      )}

      <QuizFormModal
        open={createOpen || !!editQuiz}
        onClose={() => { setCreateOpen(false); setEditQuiz(null); }}
        onSaved={() => { refetch(); setCreateOpen(false); setEditQuiz(null); }}
        quiz={editQuiz}
      />

      {gradingQuizId && (
        <ScoringModal quizId={gradingQuizId} onClose={() => setGradingQuizId(null)} push={push} />
      )}
    </div>
  );
}

function QuizSection({ title, accent, quizzes, sessions, scores, myScore, canManage, onEdit, onDelete, onGrade }: {
  title: string; accent: string; quizzes: Quiz[];
  sessions: { id: string; title: string }[];
  scores: QuizScore[];
  myScore: (id: string) => QuizScore | undefined;
  canManage: boolean;
  onEdit: (q: Quiz) => void;
  onDelete: (id: string) => void;
  onGrade: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`w-1 h-5 rounded-full ${accent}`} />
        <span className="text-sm font-semibold text-ink-700">{title}</span>
        <span className="text-xs text-ink-400">({quizzes.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {quizzes.map((qz) => {
          const session = sessions.find((s) => s.id === qz.session_id);
          const mine = myScore(qz.id);
          const open = isQuizOpen(qz);
          const overdue = daysUntil(qz.deadline) < 0;
          const gradedCount = scores.filter((s) => s.quiz_id === qz.id).length;
          return (
            <QuizCard
              key={qz.id}
              quiz={qz}
              session={session}
              mine={mine}
              open={open}
              overdue={overdue}
              gradedCount={gradedCount}
              canManage={canManage}
              onEdit={() => onEdit(qz)}
              onDelete={() => onDelete(qz.id)}
              onGrade={() => onGrade(qz.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function QuizCard({ quiz, session, mine, open, overdue, gradedCount, canManage, onEdit, onDelete, onGrade }: {
  quiz: Quiz; session?: { title: string };
  mine?: QuizScore; open: boolean; overdue: boolean; gradedCount: number;
  canManage: boolean;
  onEdit: () => void; onDelete: () => void; onGrade: () => void;
}) {
  return (
    <div className="card card-hover flex flex-col">
      <div className={`h-1 w-full rounded-t-2xl ${open && !overdue ? 'bg-mint-500' : !open ? 'bg-amber-400' : 'bg-ink-300'}`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          {mine
            ? <Badge tone="mint"><CheckCircle2 size={10} /> Score: {mine.score}{mine.bonus ? ` +${mine.bonus}` : ''}</Badge>
            : !open ? <Badge tone="amber"><Lock size={10} /> Scheduled</Badge>
            : overdue ? <Badge tone="neutral">Closed</Badge>
            : <Badge tone="blue">Open</Badge>}
          {canManage && gradedCount > 0 && (
            <span className="text-xs text-mint-500 flex items-center gap-1"><Award size={11} /> {gradedCount} graded</span>
          )}
        </div>

        <h3 className="font-semibold text-ink-900 leading-snug">{quiz.title}</h3>
        {quiz.description && <p className="text-xs text-ink-500 mt-1 line-clamp-2">{quiz.description}</p>}
        {session && <p className="text-xs text-ink-400 mt-1">From: {session.title}</p>}

        <div className="space-y-1 mt-3 text-xs text-ink-500">
          {quiz.start_datetime && !open && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <Lock size={11} /> Opens: {new Date(quiz.start_datetime).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          )}
          {quiz.start_datetime && open && (
            <span className="flex items-center gap-1 text-mint-600">
              <CheckCircle2 size={11} /> Opened: {new Date(quiz.start_datetime).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} /> Closes: {formatDate(quiz.deadline, { dateStyle: 'medium' })}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-100">
          {quiz.form_url && open && !overdue && !mine ? (
            <a href={quiz.form_url} target="_blank" rel="noreferrer" className="btn-primary btn-sm flex-1 justify-center">
              <ExternalLink size={13} /> Open Form
            </a>
          ) : quiz.form_url && !open ? (
            <button disabled className="btn-secondary btn-sm flex-1 justify-center opacity-60 cursor-not-allowed">
              <Lock size={13} /> Not Open Yet
            </button>
          ) : mine ? (
            <span className="text-xs text-mint-500 flex items-center gap-1 flex-1"><CheckCircle2 size={13} /> Completed</span>
          ) : null}

          {canManage && (
            <>
              <button onClick={onGrade} className="btn-secondary btn-sm !px-2.5" title="Grade">
                <GraduationCap size={14} />
              </button>
              <button onClick={onEdit} className="btn-ghost btn-sm !px-2"><Pencil size={14} /></button>
              <button onClick={onDelete} className="btn-ghost btn-sm !px-2 text-brand-600 hover:bg-brand-50"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuizFormModal({ open, onClose, onSaved, quiz }: {
  open: boolean; onClose: () => void; onSaved: () => void; quiz?: Quiz | null;
}) {
  const { activeCommittee } = useAuth();
  const { push } = useToast();
  const { data: sessions } = useSessions();
  const { data: sections } = useSections();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (quiz) {
      setTitle(quiz.title); setDesc(quiz.description ?? '');
      setFormUrl(quiz.form_url ?? ''); setDeadline(quiz.deadline?.slice(0, 10) ?? '');
      setSessionId(quiz.session_id ?? ''); setSectionId(quiz.section_id ?? '');
      if (quiz.start_datetime) {
        const d = new Date(quiz.start_datetime);
        setStartDate(d.toISOString().slice(0, 10));
        setStartTime(d.toTimeString().slice(0, 5));
      } else { setStartDate(''); setStartTime(''); }
    } else {
      setTitle(''); setDesc(''); setFormUrl('');
      setStartDate(new Date().toISOString().slice(0, 10)); setStartTime('09:00');
      setDeadline(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      setSessionId(''); setSectionId('');
    }
  }, [open, quiz]);

  const save = async () => {
    if (!title.trim()) { push('error', 'Add a title'); return; }
    if (!activeCommittee) { push('error', 'No active workspace'); return; }
    setSaving(true);
    const startDatetime = startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : null;
    const payload = {
      title, description: desc || null, form_url: formUrl || null,
      start_datetime: startDatetime,
      deadline: deadline || new Date().toISOString().slice(0, 10),
      committee_id: activeCommittee.id,
      session_id: sessionId || null,
      section_id: sectionId || null,
    };
    const { error } = quiz
      ? await supabase.from('quizzes').update(payload).eq('id', quiz.id)
      : await supabase.from('quizzes').insert(payload);
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', quiz ? 'Quiz updated' : 'Quiz created');
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quiz ? 'Edit Quiz' : 'New Quiz'}
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : quiz ? 'Save Changes' : 'Create'}
        </button>
      </>}
    >
      <div className="space-y-4">
        {activeCommittee && (
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-brand-50 border border-brand-200/60 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: activeCommittee.color }} />
            <span className="font-medium text-brand-700">{activeCommittee.name}</span>
          </div>
        )}
        <Field label="Title" value={title} onChange={setTitle} placeholder="Quiz title" />
        <Field label="Description (optional)" value={desc} onChange={setDesc} placeholder="Brief description" textarea />
        <Field label="Google Form URL" value={formUrl} onChange={setFormUrl} placeholder="https://forms.google.com/..." />

        <div className="p-3 rounded-xl bg-ink-50 border border-ink-200 space-y-3">
          <p className="text-xs font-semibold text-ink-600">Quiz Schedule</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens — Date" value={startDate} onChange={setStartDate} type="date" />
            <Field label="Opens — Time" value={startTime} onChange={setStartTime} type="time" />
          </div>
          <Field label="Closes — Date" value={deadline} onChange={setDeadline} type="date" />
          <p className="text-xs text-ink-400">The form link is disabled until the Open date/time.</p>
        </div>

        <Field
          label="Session (optional)"
          value={sessionId}
          onChange={setSessionId}
          options={[
            { value: '', label: 'No session' },
            ...sessions.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
        {sections.length > 0 && (
          <Field
            label="Section (optional)"
            value={sectionId}
            onChange={setSectionId}
            options={[
              { value: '', label: 'All sections' },
              ...sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        )}
      </div>
    </Modal>
  );
}

interface GradeEntry { score: string; bonus: string; }

function ScoringModal({ quizId, onClose, push }: {
  quizId: string;
  onClose: () => void;
  push: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const { data: quizzes } = useQuizzes();
  const { data: scores, refetch } = useQuizScores();
  const { data: members } = useMembers();
  const quiz = quizzes.find((q) => q.id === quizId);
  const [values, setValues] = useState<Record<string, GradeEntry>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    const next: Record<string, GradeEntry> = {};
    for (const m of members) {
      const existing = scores.find((s) => s.quiz_id === quizId && s.member_id === m.id);
      next[m.id] = {
        score: existing ? String(existing.score) : '',
        bonus: existing ? String(existing.bonus) : '',
      };
    }
    setValues(next);
    initializedRef.current = true;
  }, [members, scores, quizId]);

  const update = (memberId: string, field: keyof GradeEntry, value: string) => {
    setValues((v) => ({ ...v, [memberId]: { ...v[memberId], [field]: value } }));
    setDirty((d) => ({ ...d, [memberId]: true }));
  };

  const save = async () => {
    const editedIds = members.filter((m) => dirty[m.id]).map((m) => m.id);
    if (editedIds.length === 0) { push('info', 'No changes'); onClose(); return; }
    setSaving(true);
    const rows = editedIds.map((mid) => {
      const v = values[mid] ?? { score: '0', bonus: '0' };
      return { quiz_id: quizId, member_id: mid, score: Number(v.score) || 0, bonus: Number(v.bonus) || 0 };
    });
    const { error } = await supabase.from('quiz_scores').upsert(rows, { onConflict: 'quiz_id,member_id' });
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', `${rows.length} ${rows.length === 1 ? 'score' : 'scores'} saved`);
    refetch();
    onClose();
  };

  if (!quiz) return null;
  const gradedIds = new Set(scores.filter((s) => s.quiz_id === quizId).map((s) => s.member_id));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Grade: ${quiz.title}`}
      width="max-w-xl"
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Scores'}
        </button>
      </>}
    >
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {members.length === 0 && (
          <p className="text-sm text-ink-500 text-center py-8">No members to grade.</p>
        )}
        {members.map((m) => {
          const v = values[m.id] ?? { score: '', bonus: '' };
          return (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-ink-100 hover:bg-ink-50">
              <Avatar src={m.avatar_url} name={m.name} size={30} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-800 truncate">{m.name}</p>
                {gradedIds.has(m.id) && <span className="text-xs text-mint-500 flex items-center gap-1"><CheckCircle2 size={10} /> Graded</span>}
              </div>
              <input
                type="number" min="0" max="100" placeholder="Score"
                value={v.score}
                onChange={(e) => update(m.id, 'score', e.target.value)}
                className="input !w-20 !h-8 text-center"
              />
              <input
                type="number" min="0" placeholder="Bonus"
                value={v.bonus}
                onChange={(e) => update(m.id, 'bonus', e.target.value)}
                className="input !w-20 !h-8 text-center"
              />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Star, Search, ExternalLink, Lock, Plus, Pencil, Trash2,
  GraduationCap, Award, CheckCircle2, AlertCircle, CalendarDays,
  ChevronRight, Clock, StickyNote,
} from 'lucide-react';
import { Breadcrumbs } from '../components/Router';
import {
  Badge, SectionHeader, EmptyState, formatDate, daysUntil,
  Avatar, Modal, Field,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { useQuizzes, useSessions, useQuizScores, useMembers, useSections } from '../lib/hooks';
import { supabase, type Quiz, type QuizScore, type Session } from '../lib/supabase';
import { useToast } from '../components/Toast';

const MANAGE_ROLES = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'];

function isQuizOpen(quiz: Quiz): boolean {
  if (!quiz.start_datetime) return true;
  return new Date(quiz.start_datetime) <= new Date();
}

// ─────────────────────────────────────────────────────────────
// QuizzesPage — list view
// ─────────────────────────────────────────────────────────────
export function QuizzesPage() {
  const { profile } = useAuth();
  const { push } = useToast();
  const { data: quizzes, loading, refetch } = useQuizzes();
  const { data: sessions } = useSessions();
  const { data: scores } = useQuizScores();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null);
  const [gradingQuizId, setGradingQuizId] = useState<string | null>(null);

  const role = profile?.role ?? 'member';
  const canManage = MANAGE_ROLES.includes(role);

  const filtered = quizzes.filter((qz) =>
    qz.title.toLowerCase().includes(q.toLowerCase()),
  );

  // Open = start_datetime passed AND deadline >= today
  const openQuizzes = filtered.filter((qz) => isQuizOpen(qz) && daysUntil(qz.deadline) >= 0);
  // Locked = start_datetime hasn't passed yet
  const lockedQuizzes = filtered.filter((qz) => !isQuizOpen(qz));
  // Closed = deadline past
  const closedQuizzes = filtered.filter((qz) => isQuizOpen(qz) && daysUntil(qz.deadline) < 0);

  const myScore = (quizId: string): QuizScore | undefined =>
    scores.find((s) => s.quiz_id === quizId && s.member_id === profile?.id);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quiz and all its grades? This cannot be undone.')) return;
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
        action={
          canManage ? (
            <button className="btn-primary btn-md" onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> New Quiz
            </button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search quizzes…"
          className="input !pl-9"
        />
      </div>

      {!loading && quizzes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Star size={22} />}
            title="No quizzes yet"
            description={
              canManage ? 'Create a quiz to get started.' : 'Quizzes will appear here once created.'
            }
            action={
              canManage ? (
                <button className="btn-primary btn-md" onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> New Quiz
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-8">
          {openQuizzes.length > 0 && (
            <QuizSection
              title="Open Quizzes"
              accent="bg-mint-500"
              quizzes={openQuizzes}
              sessions={sessions}
              scores={scores}
              myScore={myScore}
              canManage={canManage}
              isMember={role === 'member'}
              onEdit={setEditQuiz}
              onDelete={handleDelete}
              onGrade={setGradingQuizId}
            />
          )}
          {lockedQuizzes.length > 0 && (
            <QuizSection
              title="Scheduled — Not Open Yet"
              accent="bg-amber-400"
              quizzes={lockedQuizzes}
              sessions={sessions}
              scores={scores}
              myScore={myScore}
              canManage={canManage}
              isMember={role === 'member'}
              onEdit={setEditQuiz}
              onDelete={handleDelete}
              onGrade={setGradingQuizId}
            />
          )}
          {closedQuizzes.length > 0 && (
            <QuizSection
              title="Closed Quizzes"
              accent="bg-ink-300"
              quizzes={closedQuizzes}
              sessions={sessions}
              scores={scores}
              myScore={myScore}
              canManage={canManage}
              isMember={role === 'member'}
              onEdit={setEditQuiz}
              onDelete={handleDelete}
              onGrade={setGradingQuizId}
            />
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
        <GradingModal
          quizId={gradingQuizId}
          onClose={() => setGradingQuizId(null)}
          onSaved={() => setGradingQuizId(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QuizSection — grouped list
// ─────────────────────────────────────────────────────────────
interface QuizSectionProps {
  title: string;
  accent: string;
  quizzes: Quiz[];
  sessions: Session[];
  scores: QuizScore[];
  myScore: (id: string) => QuizScore | undefined;
  canManage: boolean;
  isMember: boolean;
  onEdit: (q: Quiz) => void;
  onDelete: (id: string) => void;
  onGrade: (id: string) => void;
}

function QuizSection({
  title, accent, quizzes, sessions, scores, myScore,
  canManage, isMember, onEdit, onDelete, onGrade,
}: QuizSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`w-1 h-5 rounded-full ${accent}`} />
        <span className="text-sm font-semibold text-ink-700">{title}</span>
        <span className="text-xs text-ink-400">({quizzes.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {quizzes.map((qz) => (
          <QuizCard
            key={qz.id}
            quiz={qz}
            session={sessions.find((s) => s.id === qz.session_id)}
            mine={myScore(qz.id)}
            gradedCount={scores.filter((s) => s.quiz_id === qz.id).length}
            canManage={canManage}
            isMember={isMember}
            onEdit={() => onEdit(qz)}
            onDelete={() => onDelete(qz.id)}
            onGrade={() => onGrade(qz.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QuizCard
// ─────────────────────────────────────────────────────────────
interface QuizCardProps {
  quiz: Quiz;
  session?: Session;
  mine?: QuizScore;
  gradedCount: number;
  canManage: boolean;
  isMember: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onGrade: () => void;
}

function QuizCard({
  quiz, session, mine, gradedCount, canManage, isMember,
  onEdit, onDelete, onGrade,
}: QuizCardProps) {
  const open = isQuizOpen(quiz);
  const overdue = daysUntil(quiz.deadline) < 0;
  const total = mine != null ? Number(mine.score) + Number(mine.bonus) : null;

  const stripeColor = !open ? 'bg-amber-400' : overdue ? 'bg-ink-300' : 'bg-mint-500';

  return (
    <div className="card card-hover flex flex-col">
      <div className={`h-1 w-full rounded-t-2xl ${stripeColor}`} />
      <div className="p-5 flex flex-col flex-1 gap-0">

        {/* Status badges */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          {!open ? (
            <Badge tone="amber"><Lock size={10} /> Scheduled</Badge>
          ) : overdue ? (
            <Badge tone="neutral">Closed</Badge>
          ) : (
            <Badge tone="blue">Open</Badge>
          )}
          {canManage && gradedCount > 0 && (
            <span className="text-xs text-mint-500 flex items-center gap-1">
              <Award size={11} /> {gradedCount} graded
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-ink-900 leading-snug">{quiz.title}</h3>
        {quiz.description && (
          <p className="text-xs text-ink-500 mt-1 line-clamp-2">{quiz.description}</p>
        )}

        {/* Session link */}
        {session && (
          <p className="text-xs text-ink-400 mt-1 flex items-center gap-1">
            <ChevronRight size={10} />
            {session.title}
          </p>
        )}

        {/* Schedule */}
        <div className="mt-3 space-y-1 text-xs">
          {quiz.start_datetime && !open && (
            <p className="text-amber-600 font-medium flex items-center gap-1">
              <Lock size={11} />
              Opens{' '}
              {new Date(quiz.start_datetime).toLocaleString('en', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
          {quiz.start_datetime && open && (
            <p className="text-mint-600 flex items-center gap-1">
              <CheckCircle2 size={11} />
              Opened{' '}
              {new Date(quiz.start_datetime).toLocaleString('en', {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
          <p className="text-ink-500 flex items-center gap-1">
            <CalendarDays size={11} />
            Closes {formatDate(quiz.deadline, { dateStyle: 'medium' })}
          </p>
        </div>

        {/* Member grade display */}
        {isMember && (
          <div className="mt-3 pt-3 border-t border-ink-100">
            {mine != null ? (
              <p className="text-xs font-medium text-ink-700">
                Your grade:{' '}
                <span className="font-semibold text-mint-600">{total}</span>
                {Number(mine.bonus) > 0 && (
                  <span className="text-ink-400 ml-1">(+{mine.bonus} bonus)</span>
                )}
              </p>
            ) : (
              <p className="text-xs text-ink-400 flex items-center gap-1">
                <AlertCircle size={11} /> Not graded yet
              </p>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-100">
          {quiz.form_url && open && !overdue ? (
            <a
              href={quiz.form_url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary btn-sm flex-1 justify-center"
            >
              <ExternalLink size={13} /> Open Quiz
            </a>
          ) : !open ? (
            <button
              disabled
              className="btn-secondary btn-sm flex-1 justify-center opacity-60 cursor-not-allowed"
            >
              <Lock size={13} /> Not Open Yet
            </button>
          ) : overdue ? (
            <span className="text-xs text-ink-400 flex-1">Quiz closed</span>
          ) : (
            <span className="text-xs text-ink-400 flex-1">No form link</span>
          )}

          {canManage && (
            <>
              <button
                onClick={onGrade}
                className="btn-secondary btn-sm !px-2.5"
                title="Grade Quiz"
              >
                <GraduationCap size={14} />
              </button>
              <button onClick={onEdit} className="btn-ghost btn-sm !px-2" title="Edit">
                <Pencil size={14} />
              </button>
              <button
                onClick={onDelete}
                className="btn-ghost btn-sm !px-2 text-brand-600 hover:bg-brand-50"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QuizFormModal — create & edit
// ─────────────────────────────────────────────────────────────
interface QuizFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  quiz?: Quiz | null;
}

export function QuizFormModal({ open, onClose, onSaved, quiz }: QuizFormModalProps) {
  const { activeCommittee } = useAuth();
  const { push } = useToast();
  const { data: allSessions } = useSessions();
  const { data: sections } = useSections();

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [deadline, setDeadline] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter sessions to active committee; if a section is chosen,
  // include sessions that either have no section or match the section.
  const availableSessions = useMemo(() => {
    return allSessions.filter((s) => {
      if (s.committee_id !== activeCommittee?.id) return false;
      if (sectionId && s.section_id && s.section_id !== sectionId) return false;
      return true;
    });
  }, [allSessions, activeCommittee?.id, sectionId]);

  useEffect(() => {
    if (!open) return;
    if (quiz) {
      setTitle(quiz.title);
      setDesc(quiz.description ?? '');
      setFormUrl(quiz.form_url ?? '');
      setDeadline(quiz.deadline ?? '');
      setSessionId(quiz.session_id ?? '');
      setSectionId(quiz.section_id ?? '');
      if (quiz.start_datetime) {
        const d = new Date(quiz.start_datetime);
        setStartDate(d.toISOString().slice(0, 10));
        setStartTime(
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        );
      } else {
        setStartDate('');
        setStartTime('09:00');
      }
    } else {
      setTitle('');
      setDesc('');
      setFormUrl('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setStartTime('09:00');
      setDeadline(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      setSessionId('');
      setSectionId('');
    }
  }, [open, quiz]);

  const save = async () => {
    if (!title.trim()) { push('error', 'Title is required'); return; }
    if (!activeCommittee) { push('error', 'No active workspace selected'); return; }
    if (!sessionId) { push('error', 'Please link this quiz to a session'); return; }
    if (!deadline) { push('error', 'Closing date is required'); return; }

    setSaving(true);
    const startDatetime =
      startDate && startTime
        ? new Date(`${startDate}T${startTime}:00`).toISOString()
        : null;

    const payload = {
      title: title.trim(),
      description: desc.trim() || null,
      form_url: formUrl.trim() || null,
      start_datetime: startDatetime,
      deadline,
      committee_id: activeCommittee.id,
      session_id: sessionId,
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
      footer={
        <>
          <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-md" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : quiz ? 'Save Changes' : 'Create Quiz'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Committee badge */}
        {activeCommittee && (
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-brand-50 border border-brand-200/60 text-sm">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: activeCommittee.color }}
            />
            <span className="font-medium text-brand-700">{activeCommittee.name}</span>
          </div>
        )}

        <Field label="Title" value={title} onChange={setTitle} placeholder="Quiz title" />
        <Field
          label="Description (optional)"
          value={desc}
          onChange={setDesc}
          placeholder="Brief description of this quiz"
          textarea
        />
        <Field
          label="Google Form URL"
          value={formUrl}
          onChange={setFormUrl}
          placeholder="https://forms.google.com/…"
        />

        {/* Section picker first so it filters the sessions dropdown */}
        {sections.length > 0 && (
          <Field
            label="Section (optional)"
            value={sectionId}
            onChange={(v) => { setSectionId(v); setSessionId(''); }}
            options={[
              { value: '', label: 'All sections' },
              ...sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        )}

        <Field
          label="Session"
          value={sessionId}
          onChange={setSessionId}
          options={[
            { value: '', label: 'Select a session…' },
            ...availableSessions.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />

        {/* Schedule block */}
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">
            Schedule
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Opens — Date" value={startDate} onChange={setStartDate} type="date" />
            <Field label="Opens — Time" value={startTime} onChange={setStartTime} type="time" />
          </div>
          <Field label="Closes — Date" value={deadline} onChange={setDeadline} type="date" />
          <p className="text-xs text-ink-400">
            The Google Form link will be locked until the opening date and time.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// GradingModal — mirrors TaskDetailsPage GradingModal exactly
// ─────────────────────────────────────────────────────────────
interface GradeEntry {
  score: string;
  bonus: string;
}

interface GradingModalProps {
  quizId: string;
  onClose: () => void;
  onSaved: () => void;
}

function GradingModal({ quizId, onClose, onSaved }: GradingModalProps) {
  const { push } = useToast();
  const { profile, activeCommittee } = useAuth();
  const { data: quizzes } = useQuizzes();
  const { data: scores, refetch: refetchScores } = useQuizScores();
  const { data: allMembers } = useMembers();

  const quiz = quizzes.find((q) => q.id === quizId);

  // Only grade members of the quiz's committee (role = member)
  const committeeMembers = useMemo(() => {
    const cid = quiz?.committee_id ?? activeCommittee?.id;
    return allMembers.filter((m) => m.committee_id === cid && m.role === 'member');
  }, [allMembers, quiz, activeCommittee]);

  const [entries, setEntries] = useState<Record<string, GradeEntry>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || committeeMembers.length === 0) return;
    const init: Record<string, GradeEntry> = {};
    for (const m of committeeMembers) {
      const existing = scores.find((s) => s.quiz_id === quizId && s.member_id === m.id);
      init[m.id] = {
        score: existing ? String(existing.score) : '',
        bonus: existing ? String(existing.bonus) : '',
      };
    }
    setEntries(init);
    initializedRef.current = true;
  }, [committeeMembers, scores, quizId]);

  const updateEntry = (memberId: string, field: keyof GradeEntry, value: string) => {
    setEntries((prev) => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));
    setDirty((prev) => ({ ...prev, [memberId]: true }));
  };

  const handleSave = async () => {
    const dirtyIds = committeeMembers.filter((m) => dirty[m.id]).map((m) => m.id);
    if (dirtyIds.length === 0) {
      push('info', 'No changes to save');
      onClose();
      return;
    }
    setSaving(true);
    const rows = dirtyIds.map((mid) => {
      const e = entries[mid] ?? { score: '0', bonus: '0' };
      return {
        quiz_id: quizId,
        member_id: mid,
        score: Math.max(0, Number(e.score) || 0),
        bonus: Math.max(0, Number(e.bonus) || 0),
      };
    });
    const { error } = await supabase
      .from('quiz_scores')
      .upsert(rows, { onConflict: 'quiz_id,member_id' });
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', `${rows.length} ${rows.length === 1 ? 'grade' : 'grades'} saved`);
    refetchScores();
    onSaved();
  };

  const gradedIds = new Set(scores.filter((s) => s.quiz_id === quizId).map((s) => s.member_id));

  if (!quiz) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Grade Quiz: ${quiz.title}`}
      width="max-w-2xl"
      footer={
        <>
          <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-md" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Grades'}
          </button>
        </>
      }
    >
      <div className="space-y-3 max-h-[62vh] overflow-y-auto pr-1">
        {committeeMembers.length === 0 && (
          <p className="text-sm text-ink-500 text-center py-10">
            No members found in this committee.
          </p>
        )}
        {committeeMembers.map((m) => {
          const e = entries[m.id] ?? { score: '', bonus: '' };
          const isGraded = gradedIds.has(m.id);
          return (
            <div
              key={m.id}
              className="p-4 rounded-xl border border-ink-200/70 bg-ink-50/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <Avatar src={m.avatar_url} name={m.name} size={32} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-ink-800 block truncate">{m.name}</span>
                  <span className="text-xs text-ink-500">{m.position}</span>
                </div>
                {isGraded && (
                  <Badge tone="mint">
                    <CheckCircle2 size={10} /> Graded
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={e.score}
                    onChange={(ev) => updateEntry(m.id, 'score', ev.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Bonus</label>
                  <input
                    type="number"
                    min="0"
                    value={e.bonus}
                    onChange={(ev) => updateEntry(m.id, 'bonus', ev.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

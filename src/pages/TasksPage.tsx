import { useMemo, useState, useEffect } from 'react';
import { ClipboardList, Search, ExternalLink, Clock, ArrowLeft, CalendarDays, GraduationCap, Award, StickyNote } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Badge, SubmissionTypeBadge, SectionHeader, EmptyState, formatDate, daysUntil, Avatar, Modal } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useTasks, useSessions, useTaskGrades, useMembers } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import type { TaskGrade } from '../lib/supabase';

const GRADING_ROLES = ['admin', 'team_leader', 'vice_team_leader', 'hr'];

export function TasksPage() {
  const { data: tasks } = useTasks();
  const { data: sessions } = useSessions();
  const { profile } = useAuth();
  const [q, setQ] = useState('');

  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Tasks' }]} />
      <SectionHeader title="Tasks" description="Educational assignments from your sessions" />
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks..." className="input !pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<ClipboardList size={22} />} title="No tasks found" description="Try a different search." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const session = sessions.find((s) => s.id === t.session_id);
            return (
              <Link key={t.id} to={`/tasks/${t.id}`} className="card card-hover p-5 block group">
                <div className="flex items-center justify-between mb-2">
                  <SubmissionTypeBadge type={t.submission_type} />
                  <DeadlineChip deadline={t.deadline} />
                </div>
                <h3 className="font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">{t.title}</h3>
                <p className="text-sm text-ink-500 mt-1 line-clamp-2">{t.description ?? ''}</p>
                {session && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-500">
                    <CalendarDays size={12} />
                    <span className="font-medium text-ink-600">{session.title}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeadlineChip({ deadline }: { deadline: string }) {
  const d = daysUntil(deadline);
  const color = d < 0 ? 'text-brand-600' : d <= 2 ? 'text-amber-600' : 'text-ink-500';
  return (
    <span className={`text-xs flex items-center gap-1 ${color}`}>
      <Clock size={12} />
      {d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : `${d}d left`}
    </span>
  );
}

export function TaskDetailsPage({ id }: { id: string }) {
  const { data: tasks } = useTasks();
  const { data: sessions } = useSessions();
  const { data: grades } = useTaskGrades();
  const { data: members } = useMembers();
  const { profile, activeCommittee } = useAuth();

const role = profile?.role ?? "member";
  const { push } = useToast();
  const [gradingOpen, setGradingOpen] = useState(false);


  const task = tasks.find((t) => t.id === id);
  const session = sessions.find((s) => s.id === task?.session_id);
  const taskGrades = grades.filter((g) => g.task_id === id);

    const canGrade = GRADING_ROLES.includes(role);

  const committeeMembers = useMemo(() => {
    if (!activeCommittee) return [];
    return members.filter((m) => m.committee_id === activeCommittee.id && m.role === 'member');
  }, [members, activeCommittee]);

  if (!task) return <div className="card"><EmptyState icon={<ClipboardList size={22} />} title="Task not found" description="This task may have been removed." action={<Link to="/tasks" className="btn-primary btn-md">Back to tasks</Link>} /></div>;


  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Tasks', to: '/tasks' }, { label: task.title }]} />
      <Link to="/tasks" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors"><ArrowLeft size={15} /> Back to tasks</Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <SubmissionTypeBadge type={task.submission_type} />
              {session && <Badge tone="neutral">{session.title}</Badge>}
            </div>
            <h1 className="text-xl font-semibold text-ink-900 tracking-tight">{task.title}</h1>
            <p className="text-sm text-ink-600 leading-relaxed mt-3">{task.description ?? 'No description provided.'}</p>
            <div className="flex items-center gap-1.5 text-sm text-ink-500 mt-4 pt-4 border-t border-ink-100">
              <CalendarDays size={14} /> Due {formatDate(task.deadline, { dateStyle: 'full' })}
            </div>
          </div>

          {/* Submission section - read-only for members */}
          <div className="card p-6">
            <h3 className="font-semibold text-ink-900 mb-4">Submission</h3>
            {task.submission_url ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3"><ExternalLink size={26} className="text-blue-600" /></div>
                <p className="text-sm text-ink-600 mb-4">Click the link below to open the submission form and submit your answers.</p>
                <a href={task.submission_url} target="_blank" rel="noreferrer" className="btn-primary btn-lg">
                  <ExternalLink size={16} /> Open Submission
                </a>
              </div>
            ) : (
              <p className="text-sm text-ink-500">No submission link provided.</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Type"><SubmissionTypeBadge type={task.submission_type} /></Row>
              <Row label="Deadline"><span className="text-ink-800 font-medium">{formatDate(task.deadline, { dateStyle: 'medium' })}</span></Row>
              <Row label="Session">
                {session ? (
                  <span className="text-ink-800 font-medium">{session.title}</span>
                ) : (
                  <span className="text-ink-400">No session</span>
                )}
              </Row>
            </dl>
          </div>

          {/* Grading button for leaders */}
          {canGrade && (
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-3">Evaluation</h3>
              <p className="text-sm text-ink-500 mb-4">Grade this task by assigning points, bonus, and notes for each member of your committee.</p>
              <button className="btn-primary btn-md w-full" onClick={() => setGradingOpen(true)}>
                <GraduationCap size={16} /> Grade Task
              </button>
              {taskGrades.length > 0 && (
                <p className="text-xs text-mint-500 mt-3 flex items-center gap-1">
                  <Award size={12} /> {taskGrades.length} member{taskGrades.length === 1 ? '' : 's'} graded
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {canGrade && (
        <GradingModal
          open={gradingOpen}
          onClose={() => setGradingOpen(false)}
          taskId={id}
          taskTitle={task.title}
          members={committeeMembers}
          existingGrades={taskGrades}
          push={push}
        />
      )}
    </div>
  );
}

interface GradeEntry {
  points: string;
  bonus: string;
  leader_note: string;
}

function GradingModal({ open, onClose, taskId, taskTitle, members, existingGrades, push }: {
  open: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  members: { id: string; name: string; avatar_url: string | null }[];
  existingGrades: TaskGrade[];
  push: (t: 'success' | 'error' | 'info', m: string) => void;
}) {
  const [entries, setEntries] = useState<Record<string, GradeEntry>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, GradeEntry> = {};
    for (const m of members) {
      const existing = existingGrades.find((g) => g.member_id === m.id);
      next[m.id] = {
        points: existing ? String(existing.points) : '0',
        bonus: existing ? String(existing.bonus) : '0',
        leader_note: existing?.leader_note ?? '',
      };
    }
    setEntries(next);
  }, [open, members, existingGrades]);

  const updateField = (memberId: string, field: keyof GradeEntry, value: string) => {
    setEntries((prev) => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    const rows = members.map((m) => {
      const e = entries[m.id] ?? { points: '0', bonus: '0', leader_note: '' };
      return {
        task_id: taskId,
        member_id: m.id,
        points: Math.max(0, parseInt(e.points) || 0),
        bonus: Math.max(0, parseInt(e.bonus) || 0),
        leader_note: e.leader_note,
      };
    });

    const { error } = await supabase
      .from('task_grades')
      .upsert(rows, { onConflict: 'task_id,member_id' });

    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', 'Scores saved');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Grade: ${taskTitle}`}
      width="max-w-2xl"
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Scores'}
        </button>
      </>}
    >
      {members.length === 0 ? (
        <p className="text-sm text-ink-500 text-center py-8">No members in this committee to grade.</p>
      ) : (
        <div className="space-y-4">
          {members.map((m) => {
            const e = entries[m.id] ?? { points: '0', bonus: '0', leader_note: '' };
            return (
              <div key={m.id} className="p-4 rounded-xl border border-ink-200/70 bg-ink-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar src={m.avatar_url} name={m.name} size={32} />
                  <span className="font-medium text-ink-800">{m.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Points</label>
                    <input
                      type="number"
                      min="0"
                      value={e.points}
                      onChange={(ev) => updateField(m.id, 'points', ev.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Bonus</label>
                    <input
                      type="number"
                      min="0"
                      value={e.bonus}
                      onChange={(ev) => updateField(m.id, 'bonus', ev.target.value)}
                      className="input"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-ink-600 mb-1 flex items-center gap-1">
                    <StickyNote size={11} /> Leader Note
                  </label>
                  <textarea
                    rows={2}
                    value={e.leader_note}
                    onChange={(ev) => updateField(m.id, 'leader_note', ev.target.value)}
                    placeholder="Optional feedback..."
                    className="input !h-auto py-2 resize-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-ink-100 last:border-0">
      <dt className="text-ink-500">{label}</dt><dd>{children}</dd>
    </div>
  );
}

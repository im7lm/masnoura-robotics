import { useMemo, useState, useEffect, useRef } from 'react';
import {
  ClipboardList,
  Search,
  ExternalLink,
  Clock,
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  Award,
  StickyNote,
  CheckCircle2,
  Hourglass,
  Pencil,
  Trash2,
  BookOpen,
  Video,
  Lock
} from 'lucide-react';import { Link, Breadcrumbs, useRouter } from '../components/Router';
import { Badge, SectionHeader, EmptyState, formatDate, daysUntil, Avatar, Modal } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useTasks, useSessions, useTaskGrades, useMembers } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { TaskFormModal } from '../components/TaskFormModal';
import type { TaskGrade, Task } from '../lib/supabase';

const GRADING_ROLES = ['admin', 'team_leader', 'vice_team_leader', 'hr', 'director'];
const MANAGE_ROLES = ['admin', 'team_leader', 'vice_team_leader', 'hr', 'director'];

export function TasksPage() {
  const { data: tasks, refetch: refetchTasks } = useTasks();
  const { data: sessions } = useSessions();
  const { data: grades } = useTaskGrades();
  const { profile } = useAuth();
  const [q, setQ] = useState('');

  const filtered = tasks.filter((t) =>
  t.title.toLowerCase().includes(q.toLowerCase())
);

const today = new Date();
today.setHours(0, 0, 0, 0);

const currentTasks = filtered.filter((task) => {
  const session = sessions.find((s) => s.id === task.session_id);
  

  return (
    !session?.is_locked &&
    new Date(task.deadline) >= today
  );
});


const upcomingTasks = filtered.filter((task) => {
  const session = sessions.find((s) => s.id === task.session_id);
  

  return session?.is_locked;
});

const previousTasks = filtered.filter((task) => {
  const session = sessions.find((s) => s.id === task.session_id);

  return (
    !session?.is_locked &&
    new Date(task.deadline) < today
  );
});


  const isMember = profile?.role === 'member';

  const renderTaskSection = (
  title: string,
  color: string,
  list: typeof filtered
) => {
  if (!list.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-1.5 h-6 rounded-full ${color}`} />
        <h2 className="text-lg font-semibold text-ink-900">
          {title}
        </h2>

        <Badge tone="amber">
          {list.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((t) => {
          const session = sessions.find((s) => s.id === t.session_id);
          const myGrade = isMember
            ? grades.find(
                (g) =>
                  g.task_id === t.id &&
                  g.member_id === profile?.id
              )
            : null;

          return (
            <Link
              key={t.id}
              to={`/tasks/${t.id}`}
              className="card card-hover p-5 block group"
            >
              <div className="flex items-center justify-between mb-2">
                <DeadlineChip deadline={t.deadline} />
              </div>

              <h3 className="font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">
                {t.title}
              </h3>

              <p className="text-sm text-ink-500 mt-1 line-clamp-2">
                {t.description ?? ""}
              </p>

              {session && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-ink-500">
                  <Video size={12} />
                  <span className="font-medium text-ink-600">
                    {session.title}
                  </span>
                </div>
              )}

              {isMember && (
                <div className="mt-3 pt-3 border-t border-ink-100">
                  {myGrade ? (
                    <Badge tone="mint">
                      <CheckCircle2 size={11} />
                      Evaluated
                    </Badge>
                  ) : (
                    <Badge tone="amber">
                      <Hourglass size={11} />
                      Waiting
                    </Badge>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Tasks' }]} />
      <SectionHeader title="Tasks" description="Educational assignments from your sessions" />
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks..." className="input !pl-9" />
      </div>

{filtered.length === 0 ? (
  <div className="card">
    <EmptyState
      icon={<ClipboardList size={22} />}
      title="No tasks found"
      description="Try a different search."
    />
  </div>
) : (
  <div className="space-y-8">
    {renderTaskSection(
      "Current Tasks",
      "bg-green-500",
      currentTasks
    )}

    {renderTaskSection(
      "Upcoming Tasks",
      "bg-amber-500",
      upcomingTasks
    )}

    {renderTaskSection(
      "Previous Tasks",
      "bg-slate-400",
      previousTasks
    )}
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
  const { data: tasks, refetch: refetchTasks } = useTasks();
  const { data: sessions } = useSessions();
  const { data: grades, refetch: refetchGrades } = useTaskGrades();
  const { data: members } = useMembers();
  const { profile, activeCommittee } = useAuth();
  const role = profile?.role ?? 'member';
  const { push } = useToast();
  const { navigate } = useRouter();
  const [gradingOpen, setGradingOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const task = tasks.find((t) => t.id === id);
  const session = sessions.find((s) => s.id === task?.session_id);
  const isLocked = session?.is_locked ?? false;
  const taskGrades = grades.filter((g) => g.task_id === id);

  const canGrade = GRADING_ROLES.includes(role);
  const canManage = MANAGE_ROLES.includes(role);
  const isMember = role === 'member';
  const myGrade = taskGrades.find((g) => g.member_id === profile?.id);
  const myTotal = myGrade ? myGrade.points + myGrade.bonus : 0;

  const committeeMembers = useMemo(() => {
    if (!activeCommittee) return [];
    return members.filter((m) => m.committee_id === activeCommittee.id && m.role === 'member');
  }, [members, activeCommittee]);

  const refreshAll = async () => { await Promise.all([refetchTasks(), refetchGrades()]); };

  const handleDelete = async () => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Task deleted');
    setDeleteOpen(false);
    navigate('/tasks');
    refetchTasks();
  };

  if (!task) return <div className="card"><EmptyState icon={<ClipboardList size={22} />} title="Task not found" description="This task may have been removed." action={<Link to="/tasks" className="btn-primary btn-md">Back to tasks</Link>} /></div>;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Tasks', to: '/tasks' }, { label: task.title }]} />

      {/* Back nav + session chip */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/tasks" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">
          <ArrowLeft size={15} /> Back to tasks
        </Link>
        {session && (
          <>
            <span className="text-ink-300 text-sm">·</span>
            <Link
              to={`/sessions/${session.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 rounded-lg px-3 py-1 transition-colors"
            >
              <Video size={13} />
              {session.title}
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {isMember && (myGrade
                ? <Badge tone="mint"><CheckCircle2 size={11} /> Evaluated</Badge>
                : <Badge tone="amber"><Hourglass size={11} /> Waiting for Evaluation</Badge>)}
            </div>
            <h1 className="text-xl font-semibold text-ink-900 tracking-tight">{task.title}</h1>
            <p className="text-sm text-ink-600 leading-relaxed mt-3">{task.description ?? 'No description provided.'}</p>
            <div className="flex items-center gap-1.5 text-sm text-ink-500 mt-4 pt-4 border-t border-ink-100">
              <CalendarDays size={14} /> Due {formatDate(task.deadline, { dateStyle: 'full' })}
            </div>
          </div>

{/* Task Document */}
<div className="card p-6">
  <h3 className="font-semibold text-ink-900 mb-4">Task Document</h3>

  {task.document_url ? (
    <div className="flex flex-col items-center text-center py-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
        <BookOpen size={26} className="text-blue-600" />
      </div>

      <p className="text-sm text-ink-600 mb-4">
        Open the document that contains the assignment instructions.
      </p>

      {isLocked ? (
        <button
          disabled
          className="btn-primary btn-lg opacity-50 cursor-not-allowed"
        >
          <BookOpen size={16} />
          Available when session is unlocked
        </button>
      ) : (
        <a
          href={task.document_url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary btn-lg"
        >
          <BookOpen size={16} />
          Open Task Document
        </a>
      )}
    </div>
  ) : (
    <p className="text-sm text-ink-500">
      No task document has been uploaded yet.
    </p>
  )}
</div>
          

          {/* Submission */}
          <div className="card p-6">
            <h3 className="font-semibold text-ink-900 mb-4">Submission</h3>
            {task.submission_url ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3"><ExternalLink size={26} className="text-blue-600" /></div>
                <p className="text-sm text-ink-600 mb-4">Click the link below to open the submission form and submit your answers.</p>
{isLocked ? (
  <button
    disabled
    className="btn-primary btn-lg opacity-50 cursor-not-allowed"
  >
    <ExternalLink size={16} />
    Submission not available yet
  </button>
) : (
  <a
    href={task.submission_url}
    target="_blank"
    rel="noreferrer"
    className="btn-primary btn-lg"
  >
    <ExternalLink size={16} />
    Open Submission
  </a>
)}
              </div>
            ) : (
              <p className="text-sm text-ink-500">No submission link provided yet.</p>
            )}
          </div>

          {/* Member evaluation status */}
          {isMember && (
            <div className="card p-6">
              <h3 className="font-semibold text-ink-900 mb-4">Your Evaluation</h3>
              {myGrade ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-7 h-7 rounded-full bg-mint-100 flex items-center justify-center"><CheckCircle2 size={16} className="text-mint-600" /></span>
                    <span className="font-semibold text-mint-600">Evaluated</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-ink-50 text-center">
                      <p className="text-xs text-ink-500 mb-1">Points</p>
                      <p className="text-lg font-semibold text-ink-900">{myGrade.points}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-ink-50 text-center">
                      <p className="text-xs text-ink-500 mb-1">Bonus</p>
                      <p className="text-lg font-semibold text-ink-900">+{myGrade.bonus}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-brand-50 text-center">
                      <p className="text-xs text-brand-600 mb-1">Total Earned</p>
                      <p className="text-lg font-semibold text-brand-700">{myTotal}</p>
                    </div>
                  </div>
                  {myGrade.leader_note && (
                    <div className="p-3 rounded-xl bg-ink-50 border border-ink-100">
                      <p className="text-xs font-medium text-ink-600 mb-1">Leader Note</p>
                      <p className="text-sm text-ink-700 italic">{myGrade.leader_note}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <span className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"><Hourglass size={20} className="text-amber-500" /></span>
                  <div>
                    <p className="font-medium text-ink-800">Waiting for evaluation.</p>
                    <p className="text-sm text-ink-500">Your leader hasn't graded this task yet.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Deadline"><span className="text-ink-800 font-medium">{formatDate(task.deadline, { dateStyle: 'medium' })}</span></Row>
              <Row label="Session">
                {session ? (
                  <Link to={`/sessions/${session.id}`} className="text-brand-700 font-medium hover:underline">{session.title}</Link>
                ) : (
                  <span className="text-ink-400">No session</span>
                )}
              </Row>
            </dl>
          </div>

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

          {canManage && (
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-3">Manage Task</h3>
              <div className="flex flex-col gap-2">
                <button className="btn-secondary btn-md w-full" onClick={() => setEditOpen(true)}>
                  <Pencil size={15} /> Edit Task
                </button>
                <button className="btn-md w-full text-brand-600 border border-brand-200 hover:bg-brand-50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={15} /> Delete Task
                </button>
              </div>
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
          onSaved={refreshAll}
        />
      )}

      {canManage && (
        <>
          <TaskFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={refreshAll} task={task} />
          <Modal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title="Delete Task"
            width="max-w-md"
            footer={<>
              <button className="btn-secondary btn-md" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button className="btn-md bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-medium transition-colors" onClick={handleDelete}>Delete</button>
            </>}
          >
            <p className="text-sm text-ink-600">Are you sure you want to delete <span className="font-semibold text-ink-900">{task.title}</span>? This will also remove all grades for this task. This action cannot be undone.</p>
          </Modal>
        </>
      )}
    </div>
  );
}

interface GradeEntry { points: string; bonus: string; leader_note: string; }

function GradingModal({ open, onClose, taskId, taskTitle, members, existingGrades, push, onSaved }: {
  open: boolean; onClose: () => void; taskId: string; taskTitle: string;
  members: { id: string; name: string; avatar_url: string | null }[];
  existingGrades: TaskGrade[];
  push: (t: 'success' | 'error' | 'info', m: string) => void;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<Record<string, GradeEntry>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) { initializedRef.current = false; return; }
    if (initializedRef.current) return;
    const next: Record<string, GradeEntry> = {};
    for (const m of members) {
      const existing = existingGrades.find((g) => g.member_id === m.id);
      next[m.id] = { points: existing ? String(existing.points) : '', bonus: existing ? String(existing.bonus) : '', leader_note: existing?.leader_note ?? '' };
    }
    setEntries(next); setDirty({}); initializedRef.current = true;
  }, [open, members, existingGrades]);

  const updateField = (memberId: string, field: keyof GradeEntry, value: string) => {
    setEntries((prev) => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }));
    setDirty((prev) => ({ ...prev, [memberId]: true }));
  };

  const save = async () => {
    setSaving(true);
    const editedIds = members.filter((m) => dirty[m.id]).map((m) => m.id);
    if (editedIds.length === 0) { push('info', 'No changes to save'); setSaving(false); onClose(); return; }
    const rows = editedIds.map((mid) => {
      const e = entries[mid] ?? { points: '', bonus: '', leader_note: '' };
      return { task_id: taskId, member_id: mid, points: Math.max(0, parseInt(e.points) || 0), bonus: Math.max(0, parseInt(e.bonus) || 0), leader_note: e.leader_note };
    });
    const { error } = await supabase.from('task_grades').upsert(rows, { onConflict: 'task_id,member_id' });
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', `${rows.length} ${rows.length === 1 ? 'grade' : 'grades'} saved`);
    onSaved(); onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Grade: ${taskTitle}`}
      width="max-w-2xl"
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Scores'}</button>
      </>}
    >
      {members.length === 0 ? (
        <p className="text-sm text-ink-500 text-center py-8">No members in this committee to grade.</p>
      ) : (
        <div className="space-y-4">
          {members.map((m) => {
            const e = entries[m.id] ?? { points: '', bonus: '', leader_note: '' };
            const isGraded = existingGrades.some((g) => g.member_id === m.id);
            return (
              <div key={m.id} className="p-4 rounded-xl border border-ink-200/70 bg-ink-50/30">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar src={m.avatar_url} name={m.name} size={32} />
                  <span className="font-medium text-ink-800">{m.name}</span>
                  {isGraded && <Badge tone="mint"><CheckCircle2 size={10} /> Graded</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Points</label>
                    <input type="number" min="0" value={e.points} onChange={(ev) => updateField(m.id, 'points', ev.target.value)} placeholder="0" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Bonus</label>
                    <input type="number" min="0" value={e.bonus} onChange={(ev) => updateField(m.id, 'bonus', ev.target.value)} placeholder="0" className="input" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-ink-600 mb-1 flex items-center gap-1"><StickyNote size={11} /> Leader Note</label>
                  <textarea rows={2} value={e.leader_note} onChange={(ev) => updateField(m.id, 'leader_note', ev.target.value)} placeholder="Optional feedback..." className="input !h-auto py-2 resize-none" />
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

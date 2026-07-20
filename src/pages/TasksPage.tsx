import { useMemo, useState } from 'react';
import { ClipboardList, Search, ExternalLink, FileUp, FileText, Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeft, Send, CalendarDays } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Badge, SubmissionTypeBadge, SectionHeader, EmptyState, formatDate, daysUntil, Progress, Avatar } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useTasks, useSessions, useTaskSubmissions, useMembers, useCommittees } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';

export function TasksPage() {
  const { data: tasks } = useTasks();
  const { data: sessions } = useSessions();
  const { data: submissions } = useTaskSubmissions();
  const { profile } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'submitted' | 'late' | 'missing'>('all');

  const mySubs = submissions.filter((s) => s.member_id === profile?.id);
  const filtered = tasks.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()));

  const statusOf = (taskId: string, deadline: string) => {
    const sub = mySubs.find((s) => s.task_id === taskId);
    if (sub?.submitted_at) return 'submitted';
    if (daysUntil(deadline) < 0) return 'late';
    return 'open';
  };

  const visible = filtered.filter((t) => {
    if (status === 'all') return true;
    const st = statusOf(t.id, t.deadline);
    return st === status || (status === 'missing' && st === 'late');
  });

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Tasks' }]} />
      <SectionHeader title="Tasks" description="Educational assignments from your sessions" />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks..." className="input !pl-9" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="input !w-auto">
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="submitted">Submitted</option>
          <option value="late">Late</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="card"><EmptyState icon={<ClipboardList size={22} />} title="No tasks found" description="Try a different filter." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((t) => {
            const session = sessions.find((s) => s.id === t.session_id);
            const st = statusOf(t.id, t.deadline);
            const sub = mySubs.find((s) => s.task_id === t.id);
            return (
              <Link key={t.id} to={`/tasks/${t.id}`} className="card card-hover p-5 block group">
                <div className="flex items-center justify-between mb-2">
                  <SubmissionTypeBadge type={t.submission_type} />
                  <StatusChip status={st} />
                </div>
                <h3 className="font-semibold text-ink-900 group-hover:text-brand-700 transition-colors">{t.title}</h3>
                <p className="text-sm text-ink-500 mt-1 line-clamp-2">{t.description ?? ''}</p>
                {session && <p className="text-xs text-ink-400 mt-2">From: {session.title}</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100">
                  <span className={`text-xs flex items-center gap-1 ${daysUntil(t.deadline) < 0 ? 'text-brand-600' : daysUntil(t.deadline) <= 2 ? 'text-amber-600' : 'text-ink-500'}`}>
                    <Clock size={12} /> {daysUntil(t.deadline) < 0 ? `${-daysUntil(t.deadline)}d overdue` : daysUntil(t.deadline) === 0 ? 'Due today' : `${daysUntil(t.deadline)}d left`}
                  </span>
                  {sub?.score !== undefined && sub.submitted_at && <span className="text-xs font-semibold text-mint-500">Scored {sub.score}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { tone: 'mint' | 'blue' | 'amber' | 'red'; icon: React.ReactNode; label: string }> = {
    open: { tone: 'blue', icon: <Clock size={11} />, label: 'Open' },
    submitted: { tone: 'mint', icon: <CheckCircle2 size={11} />, label: 'Submitted' },
    late: { tone: 'red', icon: <AlertCircle size={11} />, label: 'Late' },
    missing: { tone: 'amber', icon: <XCircle size={11} />, label: 'Missing' },
  };
  const s = map[status] ?? map.open;
  return <Badge tone={s.tone}>{s.icon} {s.label}</Badge>;
}

export function TaskDetailsPage({ id }: { id: string }) {
  const { data: tasks } = useTasks();
  const { data: sessions } = useSessions();
  const { data: submissions } = useTaskSubmissions();
  const { data: members } = useMembers();
  const { data: committees } = useCommittees();
  const { profile, role } = useAuth();
  const { push } = useToast();
  const [link, setLink] = useState('');

  const task = tasks.find((t) => t.id === id);
  const session = sessions.find((s) => s.id === task?.session_id);
  const mySub = submissions.find((s) => s.task_id === id && s.member_id === profile?.id);
  const taskSubs = submissions.filter((s) => s.task_id === id);

  if (!task) return <div className="card"><EmptyState icon={<ClipboardList size={22} />} title="Task not found" description="This task may have been removed." action={<Link to="/tasks" className="btn-primary btn-md">Back to tasks</Link>} /></div>;

  const submit = async () => {
    if (!profile) return;
    const payload = { task_id: id, member_id: profile.id, submitted_at: new Date().toISOString(), link: link || null };
    const { error } = await supabase.from('task_submissions').upsert(payload, { onConflict: 'task_id,member_id' });
    if (error) { push('error', error.message); return; }
    push('success', 'Submission recorded');
    setLink('');
  };

  const isGoogleForm = task.submission_type === 'google_form';
  const submissionUrl = task.submission_url;

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

          {/* Submission section */}
          <div className="card p-6">
            <h3 className="font-semibold text-ink-900 mb-4">Submission</h3>
            {mySub?.submitted_at ? (
              <div className="p-4 rounded-xl bg-mint-50 border border-mint-200/60 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-mint-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-800">Submitted on {formatDate(mySub.submitted_at, { dateStyle: 'medium' })}</p>
                  {mySub.link && <a href={mySub.link} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">{mySub.link}</a>}
                </div>
                <Badge tone="mint">Scored {mySub.score}{mySub.bonus ? ` +${mySub.bonus}` : ''}</Badge>
              </div>
            ) : isGoogleForm && submissionUrl ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3"><FileText size={26} className="text-blue-600" /></div>
                <p className="text-sm text-ink-600 mb-4">This task uses a Google Form. Click to open and submit your answers.</p>
                <a href={submissionUrl} target="_blank" rel="noreferrer" className="btn-primary btn-lg">
                  <ExternalLink size={16} /> Open Submission
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                {task.submission_type === 'file_upload' && (
                  <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 cursor-pointer transition-all text-sm text-ink-500">
                    <FileUp size={22} /><span>Click to upload your file</span>
                  </label>
                )}
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={task.submission_type === 'external_link' ? 'Paste your link here' : 'Paste submission link (optional)'} className="input" />
                <button className="btn-primary btn-md w-full" onClick={submit}><Send size={14} /> Submit</button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <Row label="Type"><SubmissionTypeBadge type={task.submission_type} /></Row>
              <Row label="Deadline"><span className="text-ink-800 font-medium">{formatDate(task.deadline, { dateStyle: 'medium' })}</span></Row>
              <Row label="Status">{mySub?.submitted_at ? <Badge tone="mint">Submitted</Badge> : daysUntil(task.deadline) < 0 ? <Badge tone="red">Late</Badge> : <Badge tone="blue">Open</Badge>}</Row>
              {session && <Row label="Session"><span className="text-ink-800">{session.title}</span></Row>}
            </dl>
          </div>

          {/* Leader/HR view: submissions across members */}
          {['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(role) && (
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-3">Submissions ({taskSubs.length})</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {taskSubs.map((s) => {
                  const m = members.find((x) => x.id === s.member_id);
                  if (!m) return null;
                  return (
                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-ink-50 transition-colors">
                      <Avatar src={m.avatar_url} name={m.name} size={26} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-800 truncate">{m.name}</p>
                        <p className="text-xs text-ink-500">{s.submitted_at ? formatDate(s.submitted_at, { dateStyle: 'medium' }) : 'Not submitted'}</p>
                      </div>
                      {s.submitted_at && <Badge tone="mint">{s.score}{s.bonus ? ` +${s.bonus}` : ''}</Badge>}
                    </div>
                  );
                })}
                {taskSubs.length === 0 && <p className="text-sm text-ink-500">No submissions yet.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-ink-100 last:border-0">
      <dt className="text-ink-500">{label}</dt><dd>{children}</dd>
    </div>
  );
}

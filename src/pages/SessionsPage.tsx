import { useState } from 'react';
import {
  Video, CalendarDays, ClipboardList, Star, Search,
  FolderOpen, Lock, Unlock, ArrowLeft, Pencil, Trash2, ExternalLink, AlertTriangle,
  Clock, History,
} from 'lucide-react';
import { Link, Breadcrumbs, useRouter } from '../components/Router';
import { Badge, SectionHeader, EmptyState, formatDate, Modal } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useSessions, useTasks, useQuizzes } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { SessionFormModal } from '../components/SessionFormModal';
import type { Session } from '../lib/supabase';

const MANAGE_ROLES = ['admin', 'director', 'team_leader', 'vice_team_leader'];

function isExpired(endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate) < today;
}

export function SessionsPage() {
  const { data: sessions, refetch } = useSessions();
  const { data: tasks } = useTasks();
  const { data: quizzes } = useQuizzes();
  const { profile } = useAuth();
  const [q, setQ] = useState('');

  const role = profile?.role ?? 'member';
  const canManage = MANAGE_ROLES.includes(role);

  const filtered = sessions.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));

  const current = filtered
    .filter((s) => !s.is_locked && !isExpired(s.end_date))
    .sort((a, b) => +new Date(b.end_date) - +new Date(a.end_date));

  const upcoming = filtered
    .filter((s) => s.is_locked)
    .sort((a, b) => +new Date(b.end_date) - +new Date(a.end_date));

  const previous = filtered
    .filter((s) => !s.is_locked && isExpired(s.end_date))
    .sort((a, b) => +new Date(b.end_date) - +new Date(a.end_date));

  const taskCountFor = (id: string) => tasks.filter((t) => t.session_id === id).length;
  const quizCountFor = (id: string) => quizzes.filter((qz) => qz.session_id === id).length;

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Sessions' }]} />
      <SectionHeader title="Sessions" description="Learning sessions with resources, tasks and quizzes" />

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions..." className="input !pl-9" />
      </div>

      {sessions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Video size={22} />}
            title="No sessions yet"
            description="Sessions will appear here once created by your team leaders."
          />
        </div>
      ) : (
        <div className="space-y-10">
          {/* Current Sessions */}
          <SessionSection
            icon={<Unlock size={16} className="text-mint-600" />}
            title="Current Sessions"
            accent="bg-mint-500"
            emptyMessage="No current sessions."
            sessions={current}
            taskCountFor={taskCountFor}
            quizCountFor={quizCountFor}
            canManage={canManage}
            role={role}
            refetch={refetch}
          />

          {/* Upcoming / Locked */}
          {upcoming.length > 0 && (
            <SessionSection
              icon={<Lock size={16} className="text-amber-600" />}
              title="Upcoming Sessions"
              accent="bg-amber-400"
              emptyMessage=""
              sessions={upcoming}
              taskCountFor={taskCountFor}
              quizCountFor={quizCountFor}
              canManage={canManage}
              role={role}
              refetch={refetch}
            />
          )}

          {/* Previous Sessions */}
          {previous.length > 0 && (
            <SessionSection
              icon={<History size={16} className="text-ink-500" />}
              title="Previous Sessions"
              accent="bg-ink-300"
              emptyMessage=""
              sessions={previous}
              taskCountFor={taskCountFor}
              quizCountFor={quizCountFor}
              canManage={canManage}
              role={role}
              refetch={refetch}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SessionSection({ icon, title, accent, emptyMessage, sessions, taskCountFor, quizCountFor, canManage, role, refetch }: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  emptyMessage: string;
  sessions: Session[];
  taskCountFor: (id: string) => number;
  quizCountFor: (id: string) => number;
  canManage: boolean;
  role: string;
  refetch: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`w-1 h-5 rounded-full ${accent}`} />
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
          {icon} {title}
        </span>
        <span className="text-xs text-ink-400 font-normal">({sessions.length})</span>
      </div>
      {sessions.length === 0 && emptyMessage ? (
        <p className="text-sm text-ink-400 pl-4">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              taskCount={taskCountFor(s.id)}
              quizCount={quizCountFor(s.id)}
              canManage={canManage}
              role={role}
              refetch={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionCard({ session, taskCount, quizCount, canManage, role, refetch }: {
  session: Session; taskCount: number; quizCount: number;
  canManage: boolean; role: string; refetch: () => void;
}) {
  const { push } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isMemberLocked = session.is_locked && !MANAGE_ROLES.includes(role);
  const expired = isExpired(session.end_date);

  const handleDelete = async () => {
    const { error } = await supabase.from('sessions').delete().eq('id', session.id);
    if (error) { push('error', error.message); return; }
    push('success', 'Session deleted');
    setDeleteOpen(false);
    refetch();
  };

  return (
    <div className={`card group flex flex-col transition-all duration-200 ${!isMemberLocked ? 'card-hover' : 'opacity-80'}`}>
      {/* Colored top accent */}
      <div className={`h-1 w-full rounded-t-2xl ${session.is_locked ? 'bg-amber-400' : expired ? 'bg-ink-300' : 'bg-mint-500'}`} />

      <div className="p-5 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {session.is_locked ? (
              <Badge tone="amber"><Lock size={10} className="mr-0.5" /> Locked</Badge>
            ) : expired ? (
              <Badge tone="neutral"><Clock size={10} className="mr-0.5" /> Ended</Badge>
            ) : (
              <Badge tone="mint"><Unlock size={10} className="mr-0.5" /> Available</Badge>
            )}
          </div>
          <span className="text-xs text-ink-400 flex items-center gap-1">
            <CalendarDays size={12} />
            {formatDate(session.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Title + description */}
        {isMemberLocked ? (
          <div>
            <h3 className="font-semibold text-ink-700 leading-snug">{session.title}</h3>
            {session.description && (
              <p className="text-sm text-ink-400 mt-1.5 line-clamp-2">{session.description}</p>
            )}
          </div>
        ) : (
          <Link to={`/sessions/${session.id}`} className="block group/title">
            <h3 className="font-semibold text-ink-900 group-hover/title:text-brand-700 transition-colors leading-snug">
              {session.title}
            </h3>
            {session.description && (
              <p className="text-sm text-ink-500 mt-1.5 line-clamp-2">{session.description}</p>
            )}
          </Link>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-ink-100 text-xs text-ink-500">
          <span className="flex items-center gap-1">
            <ClipboardList size={12} /> {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
          </span>
          <span className="flex items-center gap-1">
            <Star size={12} /> {quizCount} {quizCount === 1 ? 'quiz' : 'quizzes'}
          </span>
          {session.drive_folder_url && (
            <span className="flex items-center gap-1 ml-auto text-brand-600">
              <FolderOpen size={12} /> Drive
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="mt-3">
          {isMemberLocked ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <Lock size={12} /> This session is not available yet.
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to={`/sessions/${session.id}`} className="btn-primary btn-sm flex-1 justify-center">
                Open Session
              </Link>
              {canManage && (
                <>
                  <button onClick={() => setEditOpen(true)} className="btn-ghost btn-sm !px-2.5" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeleteOpen(true)} className="btn-ghost btn-sm !px-2.5 text-brand-600 hover:bg-brand-50" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          )}
          {/* Leaders can always access locked sessions */}
          {/* {session.is_locked && canManage && (
            <div className="flex items-center gap-2 mt-2">
              <Link to={`/sessions/${session.id}`} className="btn-secondary btn-sm flex-1 justify-center text-xs">
                Preview (Leader)
              </Link>
              <button onClick={() => setEditOpen(true)} className="btn-ghost btn-sm !px-2.5" title="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={() => setDeleteOpen(true)} className="btn-ghost btn-sm !px-2.5 text-brand-600 hover:bg-brand-50" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          )} */}
        </div>
      </div>

      <SessionFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={refetch} session={session} />
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Session"
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary btn-md" onClick={() => setDeleteOpen(false)}>Cancel</button>
            <button className="btn-md bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-medium transition-colors" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Are you sure you want to delete <span className="font-semibold text-ink-900">{session.title}</span>?
          All linked tasks and quizzes will lose their session reference. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

export function SessionDetailsPage({ id }: { id: string }) {
  const { data: sessions, refetch: refetchSessions } = useSessions();
  const { data: tasks } = useTasks();
  const { data: quizzes } = useQuizzes();
  const { profile } = useAuth();
  const { push } = useToast();
  const { navigate } = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const role = profile?.role ?? 'member';
  const canManage = MANAGE_ROLES.includes(role);
  const isMember = role === 'member';

  const session = sessions.find((s) => s.id === id);
  const sessionTasks = tasks.filter((t) => t.session_id === id);
  const sessionQuizzes = quizzes.filter((qz) => qz.session_id === id);

  // Access guard: members cannot view locked sessions
  if (session && session.is_locked && isMember) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Sessions', to: '/sessions' }, { label: 'Locked' }]} />
        <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">
          <ArrowLeft size={15} /> Back to sessions
        </Link>
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <Lock size={28} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-ink-900 mb-2">Session Not Available Yet</h2>
          <p className="text-sm text-ink-500 max-w-sm">This session has been locked by your team leader. Check back later when it becomes available.</p>
          <Link to="/sessions" className="btn-primary btn-md mt-6">Back to Sessions</Link>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card">
        <EmptyState
          icon={<Video size={22} />}
          title="Session not found"
          description="This session may have been removed."
          action={<Link to="/sessions" className="btn-primary btn-md">Back to sessions</Link>}
        />
      </div>
    );
  }

  const expired = isExpired(session.end_date);

  const handleDelete = async () => {
    const { error } = await supabase.from('sessions').delete().eq('id', session.id);
    if (error) { push('error', error.message); return; }
    push('success', 'Session deleted');
    setDeleteOpen(false);
    navigate('/sessions');
    refetchSessions();
  };

//   const isQuizAvailable = (startTime: string | null) => {
//   if (!startTime) return true;

//   return new Date() >= new Date(startTime);
// };

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Sessions', to: '/sessions' }, { label: session.title }]} />
      <Link to="/sessions" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">
        <ArrowLeft size={15} /> Back to sessions
      </Link>

      {/* Hero card */}
      <div className="card overflow-hidden">
        <div className={`h-1.5 w-full ${session.is_locked ? 'bg-amber-400' : expired ? 'bg-ink-300' : 'bg-mint-500'}`} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {session.is_locked ? (
                  <Badge tone="amber"><Lock size={10} className="mr-0.5" /> Locked</Badge>
                ) : expired ? (
                  <Badge tone="neutral"><Clock size={10} className="mr-0.5" /> Ended</Badge>
                ) : (
                  <Badge tone="mint"><Unlock size={10} className="mr-0.5" /> Available</Badge>
                )}
                <span className="text-xs text-ink-400 flex items-center gap-1">
                  <CalendarDays size={12} /> Ends {formatDate(session.end_date, { dateStyle: 'full' })}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-ink-900 tracking-tight leading-snug">{session.title}</h1>
              {session.description && (
                <p className="text-sm text-ink-600 mt-3 leading-relaxed max-w-2xl">{session.description}</p>
              )}
            </div>

            {canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <button className="btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn-sm border border-brand-200 text-brand-600 hover:bg-brand-50 rounded-lg font-medium transition-colors flex items-center gap-1.5 px-3 py-1.5" onClick={() => setDeleteOpen(true)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>

          {/* Drive Folder CTA */}
          {session.drive_folder_url ? (
            <div className="mt-6 pt-5 border-t border-ink-100">
              <a
                href={session.drive_folder_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 btn-primary btn-lg"
              >
                <FolderOpen size={18} />
                Open Drive Folder
                <ExternalLink size={14} className="opacity-70" />
              </a>
              <p className="text-xs text-ink-400 mt-2">Contains the recording, notes, and additional resources for this session.</p>
            </div>
          ) : (
            <div className="mt-6 pt-5 border-t border-ink-100">
              <div className="inline-flex items-center gap-2 text-sm text-ink-400 bg-ink-50 rounded-xl px-4 py-2.5">
                <FolderOpen size={16} /> No Drive folder linked yet.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tasks + Quizzes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <ClipboardList size={15} className="text-blue-600" />
            </span>
            Tasks
            {sessionTasks.length > 0 && (
              <span className="ml-auto text-xs font-medium text-ink-400 bg-ink-100 rounded-full px-2 py-0.5">{sessionTasks.length}</span>
            )}
          </h3>
          {sessionTasks.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8">
              <ClipboardList size={20} className="text-ink-300 mb-2" />
              <p className="text-sm text-ink-400">No tasks linked to this session yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessionTasks.map((t) => (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all group/item"
                >
                  <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <ClipboardList size={14} className="text-blue-600" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800 group-hover/item:text-brand-700 transition-colors truncate">{t.title}</p>
                    <p className="text-xs text-ink-400 mt-0.5">Due {formatDate(t.deadline, { dateStyle: 'medium' })}</p>
                  </div>
                  <ExternalLink size={13} className="text-ink-300 group-hover/item:text-brand-500 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <Star size={15} className="text-amber-600" />
            </span>
            Quizzes
            {sessionQuizzes.length > 0 && (
              <span className="ml-auto text-xs font-medium text-ink-400 bg-ink-100 rounded-full px-2 py-0.5">{sessionQuizzes.length}</span>
            )}
          </h3>
          {sessionQuizzes.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8">
              <Star size={20} className="text-ink-300 mb-2" />
              <p className="text-sm text-ink-400">No quizzes linked to this session yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              
{sessionQuizzes.map((qz) => {
  const available = !qz.start_time || new Date() >= new Date(qz.start_time);

  return (
    <div key={qz.id} className="flex items-center gap-3 p-3 rounded-xl border border-ink-200">
      <span className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
        <Star size={14} className="text-amber-600" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-800 truncate">
          {qz.title}
        </p>

        <p className="text-xs text-ink-400 mt-0.5">
          Due {formatDate(qz.deadline, { dateStyle: "medium" })}
        </p>

        {!available && (
          <p className="text-xs text-amber-600 mt-1">
            Quiz is not available yet
          </p>
        )}
      </div>

      {qz.form_url &&
        (available ? (
          <a
            href={qz.form_url}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:text-brand-700 transition-colors"
            title="Open quiz form"
          >
            <ExternalLink size={14} />
          </a>
        ) : (
          <button
            disabled
            className="text-gray-400 cursor-not-allowed"
            title="Quiz is not available yet"
          >
            <ExternalLink size={14} />
          </button>
        ))}
    </div>
  );
})}
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <>
          <SessionFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={refetchSessions} session={session} />
          <Modal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title="Delete Session"
            width="max-w-md"
            footer={
              <>
                <button className="btn-secondary btn-md" onClick={() => setDeleteOpen(false)}>Cancel</button>
                <button className="btn-md bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-medium transition-colors" onClick={handleDelete}>Delete</button>
              </>
            }
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-brand-600" />
              </div>
              <p className="text-sm text-ink-600 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-ink-900">{session.title}</span>?
                This will remove the session and all linked data. This action cannot be undone.
              </p>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

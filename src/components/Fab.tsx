import { useEffect, useState } from 'react';
import { Plus, ClipboardList, Star, Megaphone, X, GraduationCap } from 'lucide-react';
import { useToast } from './Toast';
import { Modal, Field } from './ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useRouter } from './Router';
import type { Role } from '../lib/supabase';

export function Fab() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'member';
  const { navigate } = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | 'session' | 'task' | 'quiz' | 'announcement'>(null);

  const canCreate = (r: Role) => ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(r);
  if (!canCreate(role)) return null;

  const actions = [
    { key: 'session' as const, label: 'New Session', icon: GraduationCap, roles: ['admin', 'director', 'team_leader', 'vice_team_leader'] },
    { key: 'task' as const, label: 'New Task', icon: ClipboardList, roles: ['admin', 'director', 'team_leader', 'vice_team_leader'] },
    { key: 'quiz' as const, label: 'New Quiz', icon: Star, roles: ['admin', 'director', 'team_leader', 'vice_team_leader'] },
    { key: 'announcement' as const, label: 'New Announcement', icon: Megaphone, roles: ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'] },
  ].filter((a) => a.roles.includes(role));

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {open && (
          <div className="flex flex-col items-end gap-1.5 animate-slide-up">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.key} onClick={() => { setModal(a.key); setOpen(false); }} className="flex items-center gap-2.5 pl-3 pr-4 h-11 rounded-xl bg-white border border-ink-200 shadow-soft hover:shadow-card hover:-translate-y-0.5 transition-all text-sm font-medium text-ink-700">
                  <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Icon size={15} /></span>
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
        <button onClick={() => setOpen((v) => !v)} className={`w-12 h-12 rounded-2xl bg-brand-600 text-white shadow-pop flex items-center justify-center hover:bg-brand-700 transition-all active:scale-95 ${open ? 'rotate-45' : ''}`} aria-label="Quick actions">
          {open ? <X size={22} /> : <Plus size={22} />}
        </button>
      </div>

      <CreateModal modal={modal} setModal={setModal} push={push} navigate={navigate} />
    </>
  );
}

function CreateModal({ modal, setModal, push, navigate }: { modal: string | null; setModal: (m: null) => void; push: (t: 'success' | 'error' | 'info', m: string) => void; navigate: (to: string) => void }) {
  const { activeCommittee, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('google_form');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!activeCommittee) { setSessions([]); return; }
    let active = true;
    supabase.from('sessions').select('id, title').eq('committee_id', activeCommittee.id).order('title')
      .then(({ data }) => { if (active) setSessions(data ?? []); });
    return () => { active = false; };
  }, [activeCommittee?.id]);

  const labels: Record<string, string> = { session: 'New Session', task: 'New Task', quiz: 'New Quiz', announcement: 'New Announcement' };
  const committeeId = activeCommittee?.id;

  const save = async () => {
    if (!title.trim()) { push('error', 'Add a title first'); return; }
    if (!committeeId) { push('error', 'No active workspace'); return; }
    if (modal === 'task' && !sessionId) { push('error', 'Select a session'); return; }
    if (modal === 'session') {
      const { error } = await supabase.from('sessions').insert({ title, description: desc, video_url: url || null, publish_date: deadline || new Date().toISOString().slice(0, 10), committee_id: committeeId });
      if (error) { push('error', error.message); return; }
      push('success', 'Session created'); navigate('/sessions');
    } else if (modal === 'task') {
      const { error } = await supabase.from('tasks').insert({ title, description: desc, deadline: deadline || new Date().toISOString().slice(0, 10), submission_type: type, submission_url: url || null, committee_id: committeeId, session_id: sessionId });
      if (error) { push('error', error.message); return; }
      push('success', 'Task created'); navigate('/tasks');
    } else if (modal === 'quiz') {
      const { error } = await supabase.from('quizzes').insert({ title, deadline: deadline || new Date().toISOString().slice(0, 10), form_url: url || null, committee_id: committeeId, session_id: sessionId || null });
      if (error) { push('error', error.message); return; }
      push('success', 'Quiz created'); navigate('/quizzes');
    } else if (modal === 'announcement') {
      const { error } = await supabase.from('announcements').insert({ title, body: desc, link_url: url || null, committee_id: committeeId, author_id: profile?.id ?? null, pinned: false });
      if (error) { push('error', error.message); return; }
      push('success', 'Announcement published'); navigate('/announcements');
    }
    setModal(null); setTitle(''); setDesc(''); setDeadline(''); setUrl(''); setType('google_form'); setSessionId('');
  };

  return (
    <Modal
      open={!!modal}
      onClose={() => setModal(null)}
      title={modal ? labels[modal] : ''}
      footer={<>
        <button className="btn-secondary btn-md" onClick={() => setModal(null)}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save}>Create</button>
      </>}
    >
      <div className="space-y-4">
        {activeCommittee && (
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-brand-50 border border-brand-200/60 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: activeCommittee.color }} />
            <span className="font-medium text-brand-700">Posting to {activeCommittee.name}</span>
          </div>
        )}
        <Field label="Title" value={title} onChange={setTitle} placeholder={`New ${modal ?? ''}`} />
        <Field label="Description" value={desc} onChange={setDesc} placeholder="Add details" textarea />
        {modal === 'task' && (
          <Field label="Session" value={sessionId} onChange={setSessionId} options={[
            { value: '', label: 'Select a session...' },
            ...sessions.map((s) => ({ value: s.id, label: s.title })),
          ]} />
        )}
        {modal === 'task' && (
          <Field label="Submission Type" value={type} onChange={setType} options={[{ value: 'google_form', label: 'Google Form' }, { value: 'external_link', label: 'External Link' }, { value: 'file_upload', label: 'File Upload' }]} />
        )}
        {(modal === 'task' || modal === 'quiz' || modal === 'session') && (
          <Field label={modal === 'session' ? 'Publish Date' : 'Deadline'} value={deadline} onChange={setDeadline} type="date" />
        )}
        <Field label={modal === 'announcement' ? 'Link URL' : modal === 'session' ? 'Video URL' : modal === 'quiz' ? 'Google Form URL' : 'Submission Link'} value={url} onChange={setUrl} placeholder="https://..." />
      </div>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { Modal, Field } from './ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import type { Task } from '../lib/supabase';

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  task?: Task | null;
}

export function TaskFormModal({ open, onClose, onSaved, task }: TaskFormModalProps) {
  const { activeCommittee } = useAuth();
  const { push } = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!task;

  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDesc(task.description ?? '');
      setDeadline(task.deadline ? task.deadline.slice(0, 10) : '');
      setDocumentUrl(task.document_url ?? '');
      setSubmissionUrl(task.submission_url ?? '');
      setSessionId(task.session_id ?? '');
    } else {
      setTitle(''); setDesc(''); setDeadline(''); setDocumentUrl(''); setSubmissionUrl(''); setSessionId('');
    }
  }, [open, task]);

  useEffect(() => {
    if (!activeCommittee) { setSessions([]); return; }
    let active = true;
    supabase.from('sessions').select('id, title').eq('committee_id', activeCommittee.id).order('title')
      .then(({ data }) => { if (active) setSessions(data ?? []); });
    return () => { active = false; };
  }, [activeCommittee?.id]);

  const save = async () => {
    if (!title.trim()) { push('error', 'Add a title first'); return; }
    if (!activeCommittee) { push('error', 'No active workspace'); return; }
    if (!sessionId) { push('error', 'Select a session'); return; }
    setSaving(true);
    const payload = {
      title,
      description: desc || null,
      deadline: deadline || new Date().toISOString().slice(0, 10),
      submission_type: 'google_form' as const,
      document_url: documentUrl || null,
      submission_url: submissionUrl || null,
      committee_id: activeCommittee.id,
      session_id: sessionId,
    };
    const { error } = isEdit
      ? await supabase.from('tasks').update(payload).eq('id', task!.id)
      : await supabase.from('tasks').insert(payload);
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', isEdit ? 'Task updated' : 'Task created');
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'New Task'}
      footer={
        <>
          <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
          <button className="btn-primary btn-md" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {activeCommittee && (
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-brand-50 border border-brand-200/60 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: activeCommittee.color }} />
            <span className="font-medium text-brand-700">{isEdit ? 'Editing in' : 'Posting to'} {activeCommittee.name}</span>
          </div>
        )}
        <Field label="Title" value={title} onChange={setTitle} placeholder="Task title" />
        <Field label="Description" value={desc} onChange={setDesc} placeholder="Describe the assignment" textarea />
        <Field label="Session" value={sessionId} onChange={setSessionId} options={[
          { value: '', label: 'Select a session...' },
          ...sessions.map((s) => ({ value: s.id, label: s.title })),
        ]} />
        <Field label="Deadline" value={deadline} onChange={setDeadline} type="date" />
        <Field label="Task Document URL" value={documentUrl} onChange={setDocumentUrl} placeholder="https://docs.google.com/..." />
        <Field label="Submission Link" value={submissionUrl} onChange={setSubmissionUrl} placeholder="https://forms.google.com/..." />
      </div>
    </Modal>
  );
}

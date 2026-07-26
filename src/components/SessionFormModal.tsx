import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Modal, Field } from './ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import type { Session } from '../lib/supabase';

interface SessionFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  session?: Session | null;
}

export function SessionFormModal({ open, onClose, onSaved, session }: SessionFormModalProps) {
  const { activeCommittee } = useAuth();
  const { push } = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [endDate, setEndDate] = useState('');
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!session;

  // Load sections for the active committee
  useEffect(() => {
    if (!activeCommittee) { setSections([]); return; }
    let active = true;
    supabase.from('sections').select('id, name').eq('committee_id', activeCommittee.id).order('name')
      .then(({ data }) => { if (active) setSections(data ?? []); });
    return () => { active = false; };
  }, [activeCommittee?.id, open]);

  useEffect(() => {
    if (!open) return;
    if (session) {
      setTitle(session.title);
      setDesc(session.description ?? '');
      setEndDate(session.end_date ? session.end_date.slice(0, 10) : '');
      setDriveFolderUrl(session.drive_folder_url ?? '');
      setIsLocked(session.is_locked);
      setSectionId(session.section_id ?? '');
    } else {
      setTitle(''); setDesc(''); setEndDate(''); setDriveFolderUrl(''); setIsLocked(false); setSectionId('');
    }
  }, [open, session]);

  const save = async () => {
    if (!title.trim()) { push('error', 'Add a title first'); return; }
    if (!activeCommittee) { push('error', 'No active workspace'); return; }
    setSaving(true);
    const payload = {
      title,
      description: desc || null,
      end_date: endDate || new Date().toISOString().slice(0, 10),
      drive_folder_url: driveFolderUrl || null,
      is_locked: isLocked,
      committee_id: activeCommittee.id,
      section_id: sectionId || null,
    };
    const { error } = isEdit
      ? await supabase.from('sessions').update(payload).eq('id', session!.id)
      : await supabase.from('sessions').insert(payload);
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', isEdit ? 'Session updated' : 'Session created');
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Session' : 'New Session'}
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
            <span className="font-medium text-brand-700">
              {isEdit ? 'Editing in' : 'Posting to'} {activeCommittee.name}
            </span>
          </div>
        )}

        <Field label="Title" value={title} onChange={setTitle} placeholder="Session title" />
        <Field label="Description" value={desc} onChange={setDesc} placeholder="What is this session about?" textarea />
        <Field label="End Date" value={endDate} onChange={setEndDate} type="date" />
        <Field label="Drive Folder URL" value={driveFolderUrl} onChange={setDriveFolderUrl} placeholder="https://drive.google.com/..." />

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

        {/* Visibility toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-ink-200 bg-ink-50/40">
          <div className="flex items-center gap-2.5">
            {isLocked
              ? <Lock size={16} className="text-amber-600 shrink-0" />
              : <Unlock size={16} className="text-mint-600 shrink-0" />}
            <div>
              <p className="text-sm font-medium text-ink-800">Session Available to Members</p>
              <p className="text-xs text-ink-500 mt-0.5">
                {isLocked ? 'Members cannot access this session.' : 'Members can open this session normally.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!isLocked}
            onClick={() => setIsLocked((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              isLocked ? 'bg-amber-400' : 'bg-mint-500'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                isLocked ? 'translate-x-0' : 'translate-x-5'
              }`}
            />
          </button>
        </div>
      </div>
    </Modal>
  );
}

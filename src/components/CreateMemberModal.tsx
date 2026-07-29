import { useEffect, useState } from 'react';
import { Modal, Field } from './ui';
import { useToast } from './Toast';
import { supabase, type Role } from '../lib/supabase';
import type { Committee } from '../lib/supabase';

interface Props {
  /** When provided the committee field is hidden and this value is used automatically. */
  lockedCommitteeId?: string;
  /** All committees (used in the dropdown when not locked). */
  committees: Committee[];
  onClose: () => void;
  onCreated: () => void;
}

export function CreateMemberModal({ lockedCommitteeId, committees, onClose, onCreated }: Props) {
  const { push } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [committeeId, setCommitteeId] = useState(lockedCommitteeId ?? '');
  const [sectionId, setSectionId] = useState('');
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Sync committeeId if the locked value changes (e.g. workspace switch while modal open)
  useEffect(() => {
    if (lockedCommitteeId !== undefined) setCommitteeId(lockedCommitteeId);
  }, [lockedCommitteeId]);

  useEffect(() => {
    if (!committeeId) { setSections([]); setSectionId(''); return; }
    supabase.from('sections').select('id, name').eq('committee_id', committeeId).order('name')
      .then(({ data }) => setSections(data ?? []));
    setSectionId('');
  }, [committeeId]);

  const isMemberRole = role === 'member';

  const create = async () => {
    if (!name || !email || !password) { push('error', 'Fill all required fields'); return; }
    if (isMemberRole && !committeeId) { push('error', 'Members must be assigned a committee'); return; }
    setCreating(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          name, email, password, role,
          committee_id: committeeId || null,
          section_id: (isMemberRole && sectionId) ? sectionId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { push('error', data.error || 'Failed to create user'); return; }
      push('success', 'User created — they can now log in');
      onCreated();
    } catch (err) {
      push('error', (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create Member"
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={create} disabled={creating}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </>}
    >
      <div className="space-y-4">
        <Field label="Full Name" value={name} onChange={setName} placeholder="e.g. Ahmed Al-Rashid" />
        <Field label="Email" value={email} onChange={setEmail} placeholder="user@nexus.edu" type="email" />
        <Field label="Password" value={password} onChange={setPassword} placeholder="Min 6 characters" type="password" />

        <div>
          <label className="text-xs font-medium text-ink-600 mb-1.5 block">Role</label>
          <select
            value={role}
            onChange={(e) => { setRole(e.target.value as Role); if (!lockedCommitteeId) { setCommitteeId(''); setSectionId(''); } }}
            className="input"
          >
            <option value="member">Member</option>
            <option value="vice_team_leader">Vice Team Leader</option>
            <option value="team_leader">Team Leader</option>
            <option value="hr">HR</option>
            <option value="director">Director</option>
          </select>
        </div>

        {/* Committee: hidden when locked (auto-assigned), shown otherwise */}
        {lockedCommitteeId === undefined && (
          <div>
            <label className="text-xs font-medium text-ink-600 mb-1.5 block">
              Committee {isMemberRole ? '(required)' : '(optional)'}
            </label>
            <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className="input">
              <option value="">No committee</option>
              {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* Section: only when role=member and a committee is selected */}
        {isMemberRole && committeeId && (
          <div>
            <label className="text-xs font-medium text-ink-600 mb-1.5 block">Section (optional)</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input">
              <option value="">No section</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <p className="text-xs text-ink-400">The user can immediately log in with these credentials after creation.</p>
      </div>
    </Modal>
  );
}

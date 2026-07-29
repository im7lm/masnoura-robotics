import { useEffect, useState } from 'react';
import {
  Building2, Users, Shield, KeyRound, Plus, Trash2, Pencil,
  Save, X, ChevronDown, Layers,
} from 'lucide-react';
import { CreateMemberModal } from '../components/CreateMemberModal';
import type { LucideIcon } from 'lucide-react';
import { Badge, RoleBadge, SectionHeader, Avatar, Field, Modal, EmptyState } from '../components/ui';
import { Breadcrumbs } from '../components/Router';
import { useToast } from '../components/Toast';
import { useAuth, ROLE_LABELS, ROLE_PERMISSIONS } from '../lib/auth';
import { supabase, type Role, type Committee, type Member } from '../lib/supabase';

type Tab = 'committees' | 'users' | 'directors' | 'roles';
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'committees', label: 'Committees', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'directors', label: 'Directors', icon: Shield },
  { key: 'roles', label: 'Roles & Permissions', icon: KeyRound },
];

export function TeamManagementPage() {
  const [tab, setTab] = useState<Tab>('committees');
  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Team Management' }]} />
      <SectionHeader title="Team Management" description="The control center of the entire organization. Create committees, users, assign directors and leaders." />

      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 h-9 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-700'}`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'committees' && <CommitteesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'directors' && <DirectorsTab />}
      {tab === 'roles' && <RolesTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMITTEES TAB
// ─────────────────────────────────────────────────────────────────────────────
function CommitteesTab() {
  const { push } = useToast();
  const { committees, members, directorAssignments, hrAssignments, refreshGlobal } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Committee | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<'technical' | 'non_technical'>('technical');
  const [color, setColor] = useState('#E53935');
  const [directorId, setDirectorId] = useState('');

  const createCommittee = async () => {
    if (!name.trim()) { push('error', 'Committee name required'); return; }
    const { data, error } = await supabase.from('committees').insert({ name, type, color }).select().single();
    if (error) { push('error', error.message); return; }
    if (directorId) {
      const { error: dirErr } = await supabase.from('director_committees').insert({ director_id: directorId, committee_id: data.id });
      if (dirErr) push('error', 'Committee created, but director assignment failed');
    }
    push('success', 'Committee created');
    setShowCreate(false); setName(''); setType('technical'); setColor('#E53935'); setDirectorId('');
    refreshGlobal();
  };

  const deleteCommittee = async (id: string) => {
    if (!confirm('Delete this committee? All its sessions, tasks, and data will be removed.')) return;
    const { error } = await supabase.from('committees').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Committee deleted'); refreshGlobal();
  };

  const directors = members.filter((m) => m.role === 'director');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{committees.length} committees in the organization</p>
        <button className="btn-primary btn-md" onClick={() => setShowCreate(true)}><Plus size={15} /> New Committee</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {committees.map((c) => {
          const cMembers = members.filter((m) => m.committee_id === c.id);
          const cDirectorAssignments = directorAssignments.filter((d) => d.committee_id === c.id);
          const cDirectors = cDirectorAssignments.map((da) => members.find((m) => m.id === da.director_id)).filter(Boolean) as Member[];
          const teamLeader = cMembers.find((m) => m.role === 'team_leader') ?? null;
          const viceLeader = cMembers.find((m) => m.role === 'vice_team_leader') ?? null;
          // HR: look up via committee_hr junction
          const cHrIds = hrAssignments.filter((a) => a.committee_id === c.id).map((a) => a.hr_id);
          const cHrs = members.filter((m) => cHrIds.includes(m.id));
          const memberCount = cMembers.filter((m) => m.role === 'member').length;

          return (
            <CommitteeCard
              key={c.id}
              committee={c}
              directors={cDirectors}
              teamLeader={teamLeader}
              viceLeader={viceLeader}
              hrs={cHrs}
              memberCount={memberCount}
              allMembers={members}
              onEdit={() => setEditing(c)}
              onDelete={() => deleteCommittee(c.id)}
              onRefresh={refreshGlobal}
            />
          );
        })}
      </div>

      {committees.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<Building2 size={22} />}
            title="No committees yet"
            description="Create your first committee to start building the organization."
            action={<button className="btn-primary btn-md" onClick={() => setShowCreate(true)}><Plus size={15} /> Create Committee</button>}
          />
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Committee" footer={<>
        <button className="btn-secondary btn-md" onClick={() => setShowCreate(false)}>Cancel</button>
        <button className="btn-primary btn-md" onClick={createCommittee}>Create</button>
      </>}>
        <div className="space-y-4">
          <Field label="Committee Name" value={name} onChange={setName} placeholder="e.g. Embedded Systems" />
          <div>
            <label className="text-xs font-medium text-ink-600 mb-1.5 block">Category</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setType('technical')} className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all ${type === 'technical' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
                <span className="w-2 h-2 rounded-full bg-brand-500" /> Technical
              </button>
              <button onClick={() => setType('non_technical')} className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-medium transition-all ${type === 'non_technical' ? 'border-mint-500 bg-mint-50 text-mint-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'}`}>
                <span className="w-2 h-2 rounded-full bg-mint-500" /> Non Technical
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 mb-1.5 block">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 rounded-xl border border-ink-200 cursor-pointer" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 mb-1.5 block">Director (optional)</label>
            <select value={directorId} onChange={(e) => setDirectorId(e.target.value)} className="input">
              <option value="">Assign an existing director or skip</option>
              {directors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.position}</option>)}
            </select>
          </div>
          <p className="text-xs text-ink-400">Team Leader, Vice Team Leader, and HR are assigned later from the committee card.</p>
        </div>
      </Modal>

      {editing && <EditCommitteeModal committee={editing} onClose={() => setEditing(null)} onSaved={refreshGlobal} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommitteeCard
// ─────────────────────────────────────────────────────────────────────────────
function CommitteeCard({
  committee, directors, teamLeader, viceLeader, hrs, memberCount, allMembers, onEdit, onDelete, onRefresh,
}: {
  committee: Committee;
  directors: Member[];
  teamLeader: Member | null;
  viceLeader: Member | null;
  hrs: Member[];
  memberCount: number;
  allMembers: Member[];
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const { push } = useToast();
  const [assigning, setAssigning] = useState<null | 'team_leader' | 'vice_team_leader'>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [manageHrs, setManageHrs] = useState(false);

  // Assign TL / VTL: single-slot role stored on members.role + members.committee_id
  const assignSingleRole = async (role: 'team_leader' | 'vice_team_leader') => {
    if (!selectedUserId) { push('error', 'Select a user'); return; }
    // Demote existing holder back to member
    await supabase.from('members').update({ role: 'member' }).eq('committee_id', committee.id).eq('role', role);
    const { error } = await supabase.from('members').update({ role, committee_id: committee.id }).eq('id', selectedUserId);
    if (error) { push('error', error.message); return; }
    push('success', `${ROLE_LABELS[role]} assigned`);
    setAssigning(null); setSelectedUserId('');
    onRefresh();
  };

  // Remove TL / VTL assignment (demote to member)
  const removeSingleRole = async (role: 'team_leader' | 'vice_team_leader', memberId: string) => {
    const { error } = await supabase.from('members').update({ role: 'member', committee_id: null }).eq('id', memberId);
    if (error) { push('error', error.message); return; }
    push('success', `${ROLE_LABELS[role]} removed`);
    onRefresh();
  };

  // Only show users with the matching role in TL/VTL dropdowns
  const candidatesByRole: Record<string, Member[]> = {
    team_leader: allMembers.filter((m) => m.role === 'team_leader'),
    vice_team_leader: allMembers.filter((m) => m.role === 'vice_team_leader'),
  };
  const candidates = assigning ? (candidatesByRole[assigning] ?? []) : [];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold text-lg" style={{ background: committee.color }}>
            {committee.name[0]}
          </span>
          <div>
            <h3 className="font-semibold text-ink-900">{committee.name}</h3>
            <p className="text-xs text-ink-500 capitalize">{committee.type.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="w-8 h-8 rounded-lg hover:bg-ink-100 flex items-center justify-center text-ink-400 hover:text-ink-700 transition-colors"><Pencil size={14} /></button>
          <button onClick={onDelete} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-ink-400 hover:text-brand-600 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        <RoleRow label="Director" members={directors} />
        <RemovableRoleRow
          label="Team Leader"
          member={teamLeader}
          onAssign={() => { setAssigning('team_leader'); setSelectedUserId(''); }}
          onRemove={teamLeader ? () => removeSingleRole('team_leader', teamLeader.id) : undefined}
        />
        <RemovableRoleRow
          label="Vice Team Leader"
          member={viceLeader}
          onAssign={() => { setAssigning('vice_team_leader'); setSelectedUserId(''); }}
          onRemove={viceLeader ? () => removeSingleRole('vice_team_leader', viceLeader.id) : undefined}
        />

        {/* HR: multi-slot — click "Manage HRs" to open the dedicated modal */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-ink-500 mt-0.5 shrink-0">HR</span>
          <div className="flex flex-col items-end gap-1 min-w-0">
            {hrs.length === 0 ? (
              <span className="text-xs text-ink-400">Not assigned</span>
            ) : (
              hrs.map((hr) => (
                <div key={hr.id} className="flex items-center gap-1.5">
                  <Avatar src={hr.avatar_url} name={hr.name} size={20} />
                  <span className="text-xs font-medium text-ink-800 truncate">{hr.name}</span>
                </div>
              ))
            )}
            <button
              onClick={() => setManageHrs(true)}
              className="text-xs text-brand-600 hover:underline mt-0.5"
            >
              Manage HRs
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-ink-100">
          <span className="text-xs text-ink-500">Members</span>
          <span className="text-sm font-semibold text-ink-800">{memberCount}</span>
        </div>
      </div>

      {/* Inline TL / VTL assign panel */}
      {assigning && (
        <div className="flex gap-2 p-2 rounded-xl bg-ink-50 animate-slide-down mb-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="input flex-1 !h-9 text-sm"
          >
            <option value="">
              {candidates.length === 0
                ? `No ${assigning.replace(/_/g, ' ')} users found — create one in the Users tab`
                : 'Select user…'}
            </option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>{m.name} — {m.position}</option>
            ))}
          </select>
          <button className="btn-primary btn-sm" onClick={() => assignSingleRole(assigning)} disabled={!selectedUserId}>Assign</button>
          <button className="btn-secondary btn-sm" onClick={() => setAssigning(null)}>Cancel</button>
        </div>
      )}

      <div className="flex gap-2 mt-2 pt-3 border-t border-ink-100">
        <button onClick={() => { setAssigning('team_leader'); setSelectedUserId(''); }} className="btn-secondary btn-sm flex-1 justify-center text-xs">Assign TL</button>
        <button onClick={() => { setAssigning('vice_team_leader'); setSelectedUserId(''); }} className="btn-secondary btn-sm flex-1 justify-center text-xs">Assign VTL</button>
        <button onClick={() => setManageHrs(true)} className="btn-secondary btn-sm flex-1 justify-center text-xs">Manage HRs</button>
      </div>
      <div className="mt-2">
        <ManageSectionsButton committeeId={committee.id} committeeName={committee.name} />
      </div>

      {/* Manage HRs modal */}
      {manageHrs && (
        <ManageHrsModal
          committee={committee}
          assignedHrs={hrs}
          allMembers={allMembers}
          onClose={() => setManageHrs(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ManageHrsModal — dedicated modal for HR ↔ committee assignments
// Only shows users with role = 'hr'
// ─────────────────────────────────────────────────────────────────────────────
function ManageHrsModal({
  committee, assignedHrs, allMembers, onClose, onRefresh,
}: {
  committee: Committee;
  assignedHrs: Member[];
  allMembers: Member[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { push } = useToast();
  const [selectedHrId, setSelectedHrId] = useState('');
  const [saving, setSaving] = useState(false);

  // All HR users that are NOT yet assigned to this committee
  const availableHrs = allMembers.filter(
    (m) => m.role === 'hr' && !assignedHrs.find((a) => a.id === m.id),
  );

  const addHr = async () => {
    if (!selectedHrId) { push('error', 'Select an HR user'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('committee_hr')
      .upsert({ hr_id: selectedHrId, committee_id: committee.id }, { onConflict: 'hr_id,committee_id' });
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', 'HR added to committee');
    setSelectedHrId('');
    onRefresh();
  };

  const removeHr = async (hrMemberId: string) => {
    const { error } = await supabase
      .from('committee_hr')
      .delete()
      .eq('hr_id', hrMemberId)
      .eq('committee_id', committee.id);
    if (error) { push('error', error.message); return; }
    // If this HR has no more committee assignments, clear their committee_id
    const { data: remaining } = await supabase
      .from('committee_hr')
      .select('id')
      .eq('hr_id', hrMemberId);
    if ((remaining ?? []).length === 0) {
      await supabase.from('members').update({ committee_id: null }).eq('id', hrMemberId);
    }
    push('success', 'HR removed from committee');
    onRefresh();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Manage HRs — ${committee.name}`}
      width="max-w-md"
      footer={<button className="btn-secondary btn-md" onClick={onClose}>Close</button>}
    >
      <div className="space-y-4">
        {/* Current HR assignments */}
        <div>
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Assigned HRs</p>
          {assignedHrs.length === 0 ? (
            <p className="text-sm text-ink-400 py-2">No HRs assigned yet.</p>
          ) : (
            <div className="space-y-1.5">
              {assignedHrs.map((hr) => (
                <div key={hr.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-ink-100 bg-ink-50/40">
                  <Avatar src={hr.avatar_url} name={hr.name} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-800">{hr.name}</p>
                    <p className="text-xs text-ink-400">{hr.email}</p>
                  </div>
                  <button
                    onClick={() => removeHr(hr.id)}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-ink-400 hover:text-brand-600 transition-colors shrink-0"
                    title="Remove from committee"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add HR */}
        <div className="pt-3 border-t border-ink-100">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Add HR</p>
          {availableHrs.length === 0 ? (
            <p className="text-sm text-ink-400">
              No more HR users available.{' '}
              <span className="text-ink-500">Create a user with the HR role in the Users tab.</span>
            </p>
          ) : (
            <div className="flex gap-2">
              <select
                value={selectedHrId}
                onChange={(e) => setSelectedHrId(e.target.value)}
                className="input flex-1"
              >
                <option value="">Select HR user…</option>
                {availableHrs.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.position}</option>
                ))}
              </select>
              <button
                className="btn-primary btn-md"
                onClick={addHr}
                disabled={saving || !selectedHrId}
              >
                {saving ? '…' : <><Plus size={14} /> Add</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// Single-member role row with optional remove
function RemovableRoleRow({
  label, member, onAssign, onRemove,
}: {
  label: string;
  member: Member | null;
  onAssign: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      <div className="flex items-center gap-1.5">
        {member ? (
          <>
            <Avatar src={member.avatar_url} name={member.name} size={20} />
            <span className="text-xs font-medium text-ink-800">{member.name}</span>
            {onRemove && (
              <button onClick={onRemove} className="text-ink-300 hover:text-brand-600 transition-colors" title={`Remove ${label}`}>
                <X size={12} />
              </button>
            )}
          </>
        ) : (
          <span className="text-xs text-ink-400">Not assigned</span>
        )}
        <button onClick={onAssign} className="text-xs text-brand-600 hover:underline ml-1">
          {member ? 'Change' : 'Assign'}
        </button>
      </div>
    </div>
  );
}

function RoleRow({ label, members }: { label: string; members: Member[] }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {members.length > 0 ? members.map((m) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <Avatar src={m.avatar_url} name={m.name} size={20} />
            <span className="text-xs font-medium text-ink-800">{m.name}</span>
          </div>
        )) : (
          <span className="text-xs text-ink-400">Not assigned</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage Sections
// ─────────────────────────────────────────────────────────────────────────────
function ManageSectionsButton({ committeeId, committeeName }: { committeeId: string; committeeName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-secondary btn-sm w-full justify-center text-xs" onClick={() => setOpen(true)}>
        <Layers size={13} /> Manage Sections
      </button>
      <SectionsModal open={open} onClose={() => setOpen(false)} committeeId={committeeId} committeeName={committeeName} />
    </>
  );
}

function SectionsModal({ open, onClose, committeeId, committeeName }: {
  open: boolean; onClose: () => void; committeeId: string; committeeName: string;
}) {
  const { push } = useToast();
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('sections').select('id, name').eq('committee_id', committeeId).order('name');
    setSections(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (open) { load(); setNewName(''); setEditingId(null); } }, [open, committeeId]);

  const addSection = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('sections').insert({ committee_id: committeeId, name: newName.trim() });
    setAdding(false);
    if (error) { push('error', error.message); return; }
    push('success', 'Section added');
    setNewName('');
    load();
  };

  const saveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    const { error } = await supabase.from('sections').update({ name: editingName.trim() }).eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Section renamed');
    setEditingId(null);
    load();
  };

  const deleteSection = async (id: string) => {
    if (!confirm('Delete this section? Members in it will lose their section assignment.')) return;
    const { error } = await supabase.from('sections').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Section deleted');
    load();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Sections — ${committeeName}`} width="max-w-md"
      footer={<button className="btn-secondary btn-md" onClick={onClose}>Close</button>}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSection()}
            placeholder="New section name…" className="input flex-1" />
          <button className="btn-primary btn-md px-3" onClick={addSection} disabled={adding || !newName.trim()}>
            <Plus size={15} />
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-ink-400 py-4 text-center">Loading…</p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-ink-400 py-4 text-center">No sections yet. Add one above.</p>
        ) : (
          <div className="space-y-1.5">
            {sections.map((s) => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-ink-100 bg-ink-50/40">
                {editingId === s.id ? (
                  <>
                    <input value={editingName} onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="input flex-1 !h-8 text-sm" autoFocus />
                    <button onClick={() => saveEdit(s.id)} className="btn-primary btn-sm !px-2"><Save size={13} /></button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost btn-sm !px-2"><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-ink-800">{s.name}</span>
                    <button onClick={() => { setEditingId(s.id); setEditingName(s.name); }} className="btn-ghost btn-sm !px-2"><Pencil size={13} /></button>
                    <button onClick={() => deleteSection(s.id)} className="btn-ghost btn-sm !px-2 text-brand-600 hover:bg-brand-50"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function EditCommitteeModal({ committee, onClose, onSaved }: { committee: Committee; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const [name, setName] = useState(committee.name);
  const [type, setType] = useState(committee.type);
  const [color, setColor] = useState(committee.color);

  const save = async () => {
    const { error } = await supabase.from('committees').update({ name, type, color }).eq('id', committee.id);
    if (error) { push('error', error.message); return; }
    push('success', 'Committee updated'); onClose(); onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Edit Committee" footer={<>
      <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
      <button className="btn-primary btn-md" onClick={save}>Save</button>
    </>}>
      <div className="space-y-4">
        <Field label="Name" value={name} onChange={setName} />
        <div>
          <label className="text-xs font-medium text-ink-600 mb-1.5 block">Category</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'technical' | 'non_technical')} className="input">
            <option value="technical">Technical</option>
            <option value="non_technical">Non Technical</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-600 mb-1.5 block">Color</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 rounded-xl border border-ink-200 cursor-pointer" />
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS TAB — create, edit, delete
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab() {
  const { push } = useToast();
  const { members, committees, refreshGlobal } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Delete via edge function — removes auth user + member row + related records
  const confirmDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({ member_id: deletingId }),
      });
      const data = await res.json();
      if (!res.ok) { push('error', data.error || 'Failed to delete user'); return; }
      push('success', 'User deleted');
      setDeletingId(null);
      refreshGlobal();
    } catch (err) {
      push('error', (err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{members.length} users in the organization</p>
        <button className="btn-primary btn-md" onClick={() => setShowCreate(true)}><Plus size={15} /> New User</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Committee</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {members.map((m) => {
              const c = committees.find((c) => c.id === m.committee_id);
              return (
                <tr key={m.id} className="hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={m.avatar_url} name={m.name} size={32} />
                      <div>
                        <p className="font-medium text-ink-800">{m.name}</p>
                        <p className="text-xs text-ink-400">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-3 text-ink-600">{c?.name ?? '—'}</td>
                  <td className="px-4 py-3"><Badge tone={m.status === 'active' ? 'mint' : 'neutral'}>{m.status}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingMember(m)}
                        className="w-8 h-8 rounded-lg hover:bg-ink-100 flex items-center justify-center text-ink-400 hover:text-ink-700 transition-colors"
                        title="Edit user"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingId(m.id)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-ink-400 hover:text-brand-600 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateMemberModal
          committees={committees}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refreshGlobal(); }}
        />
      )}

      {/* Edit User Modal */}
      {editingMember && (
        <EditUserModal
          member={editingMember}
          committees={committees}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); refreshGlobal(); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete User"
        width="max-w-md"
        footer={<>
          <button className="btn-secondary btn-md" onClick={() => setDeletingId(null)} disabled={deleting}>Cancel</button>
          <button
            className="btn-md bg-brand-600 text-white hover:bg-brand-700 rounded-lg font-medium transition-colors px-4"
            onClick={confirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </>}
      >
        <p className="text-sm text-ink-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-ink-900">
            {members.find((m) => m.id === deletingId)?.name ?? 'this user'}
          </span>?
          This will permanently remove their account, grades, and all related records. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit User Modal
// ─────────────────────────────────────────────────────────────────────────────
function EditUserModal({
  member, committees, onClose, onSaved,
}: {
  member: Member;
  committees: Committee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<Role>(member.role);
  const [committeeId, setCommitteeId] = useState(member.committee_id ?? '');
  const [sectionId, setSectionId] = useState(member.section_id ?? '');
  const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const isMember = role === 'member';

  // Load sections when committee changes
  useEffect(() => {
    if (!committeeId) { setSections([]); if (isMember) setSectionId(''); return; }
    supabase.from('sections').select('id, name').eq('committee_id', committeeId).order('name')
      .then(({ data }) => setSections(data ?? []));
  }, [committeeId]);

  // Clear section when role is not member
  useEffect(() => {
    if (!isMember) setSectionId('');
  }, [role]);

  const save = async () => {
    if (!name.trim()) { push('error', 'Name is required'); return; }
    if (isMember && !committeeId) { push('error', 'Members must have a committee'); return; }
    setSaving(true);

    const updates: Record<string, string | null> = {
      name: name.trim(),
      role,
      committee_id: committeeId || null,
      section_id: (isMember && sectionId) ? sectionId : null,
    };

    const { error } = await supabase.from('members').update(updates).eq('id', member.id);
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', 'User updated');
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit User"
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </>}
    >
      <div className="space-y-4">
        {/* Current user chip */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-ink-50 border border-ink-100">
          <Avatar src={member.avatar_url} name={member.name} size={36} />
          <div>
            <p className="text-sm font-medium text-ink-800">{member.name}</p>
            <p className="text-xs text-ink-400">{member.email}</p>
          </div>
        </div>

        <Field label="Full Name" value={name} onChange={setName} placeholder="Full name" />

        <div>
          <label className="text-xs font-medium text-ink-600 mb-1.5 block">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
            <option value="member">Member</option>
            <option value="vice_team_leader">Vice Team Leader</option>
            <option value="team_leader">Team Leader</option>
            <option value="hr">HR</option>
            <option value="director">Director</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-ink-600 mb-1.5 block">
            Committee {isMember ? '(required)' : '(optional)'}
          </label>
          <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className="input">
            <option value="">No committee</option>
            {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {isMember && committeeId && (
          <div>
            <label className="text-xs font-medium text-ink-600 mb-1.5 block">Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="input">
              <option value="">No section</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTORS TAB
// ─────────────────────────────────────────────────────────────────────────────
function DirectorsTab() {
  const { push } = useToast();
  const { members, committees, directorAssignments, refreshGlobal } = useAuth();
  const [directorId, setDirectorId] = useState('');
  const [committeeId, setCommitteeId] = useState('');

  const assign = async () => {
    if (!directorId || !committeeId) { push('error', 'Select director and committee'); return; }
    const { error } = await supabase.from('director_committees').insert({ director_id: directorId, committee_id: committeeId });
    if (error) { push('error', error.message); return; }
    push('success', 'Director assigned to committee');
    setCommitteeId(''); refreshGlobal();
  };

  const removeAssignment = async (id: string) => {
    const { error } = await supabase.from('director_committees').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Assignment removed'); refreshGlobal();
  };

  const directors = members.filter((m) => m.role === 'director');

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-2">Director Assignments</h3>
        <p className="text-sm text-ink-500 mb-4">Assign directors to supervise one or more committees. Directors can switch between their assigned workspaces.</p>

        {directors.length === 0 && (
          <div className="p-4 rounded-xl bg-ink-50 text-sm text-ink-500 mb-4">
            No directors yet. Create a user with the Director role in the Users tab first.
          </div>
        )}

        <div className="space-y-3 mb-4">
          {directors.map((d) => {
            const dComms = directorAssignments
              .filter((a) => a.director_id === d.id)
              .map((a) => committees.find((c) => c.id === a.committee_id))
              .filter(Boolean);
            return (
              <div key={d.id} className="p-3 rounded-xl border border-ink-200">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar src={d.avatar_url} name={d.name} size={36} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-900">{d.name}</p>
                    <p className="text-xs text-ink-500">{d.position}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-12">
                  {dComms.length === 0 && <span className="text-xs text-ink-400">No committees assigned</span>}
                  {dComms.map((c) => {
                    const a = directorAssignments.find((x) => x.director_id === d.id && x.committee_id === c!.id);
                    return (
                      <span key={c!.id} className="chip bg-ink-100 text-ink-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: c!.color }} />
                        {c!.name}
                        <button onClick={() => a && removeAssignment(a.id)} className="text-ink-400 hover:text-brand-600">
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-4 border-t border-ink-100">
          <select value={directorId} onChange={(e) => setDirectorId(e.target.value)} className="input flex-1">
            <option value="">Select director…</option>
            {directors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={committeeId} onChange={(e) => setCommitteeId(e.target.value)} className="input flex-1">
            <option value="">Select committee…</option>
            {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-primary btn-md" onClick={assign}><Plus size={14} /> Assign</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES TAB
// ─────────────────────────────────────────────────────────────────────────────
function RolesTab() {
  const { members } = useAuth();
  const roles: Role[] = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr', 'member'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {roles.map((r) => {
        const count = members.filter((m) => m.role === r).length;
        return (
          <div key={r} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RoleBadge role={r} />
                <span className="text-xs text-ink-400">{count} {count === 1 ? 'user' : 'users'}</span>
              </div>
            </div>
            <ul className="space-y-1.5">
              {ROLE_PERMISSIONS[r].map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                  <span className="w-1 h-1 rounded-full bg-ink-400 mt-2 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

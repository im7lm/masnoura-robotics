import { useMemo, useState } from 'react';
import { Search, ArrowUpDown, Download, UserPlus, ChevronRight, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Avatar, Badge, StatusBadge, RoleBadge, SectionHeader, Progress, EmptyState, formatDate } from '../components/ui';
import { Link, Breadcrumbs } from '../components/Router';
import { useToast } from '../components/Toast';
import { useMembers, useCommittees, useMemberScores } from '../lib/hooks';
import { useAuth, ROLE_LABELS } from '../lib/auth';
import { CreateMemberModal } from '../components/CreateMemberModal';
import { supabase } from '../lib/supabase';
import type { Role } from '../lib/supabase';

export function MembersPage() {
  const { push } = useToast();
  const { activeCommittee, committees: allCommittees, refreshGlobal } = useAuth();
  const { data: members } = useMembers();
  const { data: committees } = useCommittees();
  const { data: scores } = useMemberScores();
  const [q, setQ] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('All');
  const [role, setRole] = useState<'All' | Role>('All');
  const [sort, setSort] = useState<'name' | 'points' | 'attendance'>('points');
  const [showAddMember, setShowAddMember] = useState(false);

  const filtered = useMemo(() => {
    let r = members.filter((m) =>
      m.name.toLowerCase().includes(q.toLowerCase()) &&
      (committeeFilter === 'All' || committees.find((c) => c.id === m.committee_id)?.name === committeeFilter) &&
      (role === 'All' || m.role === role)
    );
    r = [...r].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'attendance') return (scores.find((s) => s.member_id === b.id)?.attendance_rate ?? 0) - (scores.find((s) => s.member_id === a.id)?.attendance_rate ?? 0);
      return (scores.find((s) => s.member_id === b.id)?.total_points ?? 0) - (scores.find((s) => s.member_id === a.id)?.total_points ?? 0);
    });
    return r;
  }, [members, q, committeeFilter, role, sort, committees, scores]);

  const handleExport = async () => {
    // Fetch sections once for name lookups
    const committeeIds = [...new Set(filtered.map((m) => m.committee_id).filter(Boolean) as string[])];
    const { data: sections } = committeeIds.length
      ? await supabase.from('sections').select('id, name').in('committee_id', committeeIds)
      : { data: [] };
    const sectionMap = Object.fromEntries((sections ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));

    const rows = filtered.map((m) => ({
      Name: m.name,
      Email: m.email,
      Role: ROLE_LABELS[m.role] ?? m.role,
      Committee: committees.find((c) => c.id === m.committee_id)?.name ?? '',
      Section: m.section_id ? (sectionMap[m.section_id] ?? '') : '',
      Position: m.position,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');

    const committeeName = activeCommittee?.name.replace(/\s+/g, '_') ?? 'Members';
    XLSX.writeFile(wb, `${committeeName}_Members.xlsx`);
    push('success', `Exported ${rows.length} member${rows.length !== 1 ? 's' : ''}`);
  };

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Members' }]} />
      <SectionHeader
        title="Members"
        description={`${members.length} people across ${committees.length} committees`}
        action={<div className="flex gap-2">
          <button className="btn-secondary btn-md" onClick={handleExport}><Download size={15} /> Export</button>
          <button className="btn-primary btn-md" onClick={() => setShowAddMember(true)}><UserPlus size={15} /> Add Member</button>
        </div>}
      />

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name..." className="input !pl-9" />
          </div>
          <select value={committeeFilter} onChange={(e) => setCommitteeFilter(e.target.value)} className="input !w-auto">
            <option>All</option>
            {committees.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={role} onChange={(e) => setRole(e.target.value as any)} className="input !w-auto">
            <option value="All">All roles</option>
            <option value="admin">Admin</option><option value="hr">HR</option><option value="team_leader">Team Leader</option><option value="member">Member</option>
          </select>
          <div className="relative">
            <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="input !pl-9 !w-auto">
              <option value="points">Sort: Points</option>
              <option value="name">Name</option>
              <option value="attendance">Attendance</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Users size={22} />} title="No members found" description="Try adjusting your filters." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200/70 bg-ink-50/50 text-left">
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Member</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Committee</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Joined</th>
                  {/* <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Attendance</th> */}
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Points</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const score = scores.find((s) => s.member_id === m.id);
                  const committee_ = committees.find((c) => c.id === m.committee_id);
                  return (
                    <tr key={m.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60 transition-colors group">
                      <td className="px-5 py-3">
                        <Link to={`/members/${m.id}`} className="flex items-center gap-3">
                          <Avatar src={m.avatar_url} name={m.name} size={36} />
                          <div>
                            <p className="font-medium text-ink-800 group-hover:text-brand-700 transition-colors">{m.name}</p>
                            <p className="text-xs text-ink-500">{m.position}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3"><RoleBadge role={m.role} /></td>
                      <td className="px-5 py-3">{committee_ ? <Badge tone="neutral">{committee_.name}</Badge> : <span className="text-ink-400">—</span>}</td>
                      <td className="px-5 py-3 text-ink-500">{formatDate(m.join_date, { month: 'short', year: 'numeric' })}</td>
                      {/* <td className="px-5 py-3">
                        <div className="flex items-center gap-2 w-28">
                          <Progress value={score?.attendance_rate ?? 0} tone={(score?.attendance_rate ?? 0) >= 80 ? 'mint' : 'amber'} />
                          <span className="text-xs font-medium text-ink-600 w-8">{score?.attendance_rate ?? 0}%</span>
                        </div>
                      </td> */}
                      <td className="px-5 py-3"><span className="text-sm font-semibold text-ink-900">{score?.total_points ?? 0}</span></td>
                      <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <Link to={`/members/${m.id}`} className="text-ink-300 group-hover:text-brand-600 transition-colors inline-flex"><ChevronRight size={16} /></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddMember && (
        <CreateMemberModal
          lockedCommitteeId={activeCommittee?.id}
          committees={allCommittees}
          onClose={() => setShowAddMember(false)}
          onCreated={() => { setShowAddMember(false); refreshGlobal(); }}
        />
      )}
    </div>
  );
}

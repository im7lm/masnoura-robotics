import { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, Clock, XCircle, Save, Search, CalendarDays } from 'lucide-react';
import { Breadcrumbs } from '../components/Router';
import { Avatar, Badge, AttendanceBadge, SectionHeader, EmptyState, formatDate, Progress } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useSessions, useMembers, useAttendance } from '../lib/hooks';
import { supabase, type AttendanceStatus } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { DonutChart } from '../components/Charts';

export function AttendancePage() {
  const { role } = useAuth();
  const { push } = useToast();
  const { data: sessions } = useSessions();
  const { data: members } = useMembers();
  const { data: attendance, refetch } = useAttendance();
  const [q, setQ] = useState('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => +new Date(b.publish_date) - +new Date(a.publish_date)), [sessions]);

  useEffect(() => {
    if (!selectedSession && sortedSessions.length) setSelectedSession(sortedSessions[0].id);
  }, [sortedSessions, selectedSession]);

  useEffect(() => {
    const r: Record<string, AttendanceStatus> = {};
    attendance.filter((a) => a.session_id === selectedSession).forEach((a) => { r[a.member_id] = a.status; });
    setRecords(r);
  }, [selectedSession, attendance]);

  const filteredMembers = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.status !== 'inactive');
  const activeMembers = members.filter((m) => m.status !== 'inactive');

  const present = Object.values(records).filter((s) => s === 'present').length;
  const late = Object.values(records).filter((s) => s === 'late').length;
  const absent = activeMembers.length - present - late;
  const rate = activeMembers.length ? Math.round(100 * (present + late * 0.5) / activeMembers.length) : 0;

  const canEdit = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(role);

  const setStatus = (memberId: string, status: AttendanceStatus) => {
    setRecords((r) => ({ ...r, [memberId]: status }));
  };

  const save = async () => {
    const rows = Object.entries(records).map(([member_id, status]) => ({ session_id: selectedSession, member_id, status }));
    if (rows.length === 0) { push('info', 'No attendance to save'); return; }
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'session_id,member_id' });
    if (error) { push('error', error.message); return; }
    push('success', 'Attendance saved');
    refetch();
  };

  const session = sessions.find((s) => s.id === selectedSession);

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Attendance' }]} />
      <SectionHeader
        title="Attendance"
        description={canEdit ? 'Record attendance for each session' : 'View attendance records'}
        action={canEdit && <button className="btn-primary btn-md" onClick={save}><Save size={15} /> Save attendance</button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <DonutChart segments={[{ value: rate, color: '#45A87A', label: 'Present' }, { value: Math.max(0, 100 - rate), color: '#F1F5F9', label: '' }]} size={120} thickness={14} />
          <div>
            <p className="text-xs text-ink-500">Session rate</p>
            <p className="text-2xl font-semibold text-ink-900">{rate}%</p>
            <p className="text-xs text-ink-500 mt-1">{activeMembers.length} members</p>
          </div>
        </div>
        <StatBox label="Present" value={present} icon={<CheckCircle2 size={18} />} tone="text-mint-500 bg-mint-100" />
        <StatBox label="Late" value={late} icon={<Clock size={18} />} tone="text-amber-600 bg-amber-50" />
        <StatBox label="Absent" value={absent} icon={<XCircle size={18} />} tone="text-brand-600 bg-red-50" />
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} className="input !w-auto">
            {sortedSessions.map((s) => <option key={s.id} value={s.id}>{s.title} — {formatDate(s.publish_date, { dateStyle: 'medium' })}</option>)}
          </select>
          {session && <Badge tone="neutral"><CalendarDays size={11} /> {formatDate(session.publish_date, { dateStyle: 'full' })}</Badge>}
          <div className="relative ml-auto w-full sm:w-auto sm:min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members..." className="input !pl-9" />
          </div>
        </div>
      </div>

      {sortedSessions.length === 0 ? (
        <div className="card"><EmptyState icon={<CalendarDays size={22} />} title="No sessions" description="Create a session first to record attendance." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200/70 bg-ink-50/50 text-left">
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Member</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Committee</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Overall Rate</th>
                  <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Today</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const memberAttendance = attendance.filter((a) => a.member_id === m.id);
                  const mpresent = memberAttendance.filter((a) => a.status === 'present').length;
                  const mlate = memberAttendance.filter((a) => a.status === 'late').length;
                  const mtotal = memberAttendance.length;
                  const mrate = mtotal ? Math.round(100 * (mpresent + mlate * 0.5) / mtotal) : 0;
                  const current = records[m.id] ?? 'absent';
                  return (
                    <tr key={m.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={m.avatar_url} name={m.name} size={32} />
                          <div>
                            <p className="font-medium text-ink-800">{m.name}</p>
                            <p className="text-xs text-ink-500">{m.position}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><Badge tone="neutral">{m.committee_id ? 'Committee' : '—'}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 w-28">
                          <Progress value={mrate} tone={mrate >= 80 ? 'mint' : 'amber'} />
                          <span className="text-xs font-medium text-ink-600 w-8">{mrate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            {(['present', 'late', 'absent'] as AttendanceStatus[]).map((st) => (
                              <button key={st} onClick={() => setStatus(m.id, st)}
                                className={`px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${current === st
                                  ? st === 'present' ? 'bg-mint-500 text-white' : st === 'late' ? 'bg-amber-500 text-white' : 'bg-brand-600 text-white'
                                  : 'bg-ink-100 text-ink-500 hover:bg-ink-200'}`}>
                                {st === 'present' ? 'P' : st === 'late' ? 'L' : 'A'}
                              </button>
                            ))}
                          </div>
                        ) : <AttendanceBadge status={current} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="card p-5 flex items-center gap-3">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>{icon}</span>
      <div>
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-2xl font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}

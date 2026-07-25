import { useMemo, useState, useEffect } from 'react';
import { Video, CalendarDays, Clock, Search, Plus, Save, ExternalLink, CheckCircle2, XCircle, Pencil, Trash2, Users, Link2 } from 'lucide-react';
import { Breadcrumbs } from '../components/Router';
import { Avatar, Badge, SectionHeader, EmptyState, formatDate, Modal, Field, Progress } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useMeetings, useMeetingAttendance, useMembers, useSections } from '../lib/hooks';
import { supabase, type AttendanceStatus, type Meeting } from '../lib/supabase';
import { useToast } from '../components/Toast';

const MANAGE_ROLES = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'];

function meetingDateTime(m: Meeting): Date {
  return new Date(`${m.meeting_date}T${m.meeting_time}`);
}

function isPast(m: Meeting) { return meetingDateTime(m) < new Date(); }

export function MeetingsPage() {
  const { profile, activeCommittee } = useAuth();
  const { push } = useToast();
  const { data: meetings, refetch } = useMeetings();
  const { data: members } = useMembers();
  const { data: attendance, refetch: refetchAttendance } = useMeetingAttendance();
  const { data: sections } = useSections();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [attendanceMeeting, setAttendanceMeeting] = useState<Meeting | null>(null);

  const role = profile?.role ?? 'member';
  const canManage = MANAGE_ROLES.includes(role);

  const filtered = meetings.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));
  const upcoming = filtered.filter((m) => !isPast(m)).sort((a, b) => +meetingDateTime(a) - +meetingDateTime(b));
  const past = filtered.filter((m) => isPast(m)).sort((a, b) => +meetingDateTime(b) - +meetingDateTime(a));

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this meeting?')) return;
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) { push('error', error.message); return; }
    push('success', 'Meeting deleted');
    refetch();
  };

  const totalMeetings = meetings.length;
  const myAttendance = attendance.filter((a) => a.member_id === profile?.id);
  const myPresent = myAttendance.filter((a) => a.status === 'present').length;
  const myRate = myAttendance.length ? Math.round(100 * myPresent / myAttendance.length) : 0;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Meetings' }]} />
      <SectionHeader
        title="Meetings"
        description="Team meetings and attendance tracking"
        action={canManage && (
          <button className="btn-primary btn-md" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> New Meeting
          </button>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Meetings" value={totalMeetings} icon={<Video size={18} />} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Upcoming" value={upcoming.length} icon={<Clock size={18} />} tone="bg-amber-50 text-amber-600" />
        <StatCard label="My Attendance Rate" value={`${myRate}%`} icon={<CheckCircle2 size={18} />} tone="bg-mint-100 text-mint-500" />
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings..." className="input !pl-9" />
      </div>

      {meetings.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Video size={22} />} title="No meetings yet" description="Create a meeting to get started." />
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <MeetingSection
              title="Upcoming Meetings"
              accent="bg-blue-500"
              meetings={upcoming}
              sections={sections}
              attendance={attendance}
              members={members}
              canManage={canManage}
              profileId={profile?.id}
              onEdit={setEditMeeting}
              onDelete={handleDelete}
              onAttendance={setAttendanceMeeting}
            />
          )}
          {past.length > 0 && (
            <MeetingSection
              title="Past Meetings"
              accent="bg-ink-300"
              meetings={past}
              sections={sections}
              attendance={attendance}
              members={members}
              canManage={canManage}
              profileId={profile?.id}
              onEdit={setEditMeeting}
              onDelete={handleDelete}
              onAttendance={setAttendanceMeeting}
            />
          )}
        </div>
      )}

      <MeetingFormModal
        open={createOpen || !!editMeeting}
        onClose={() => { setCreateOpen(false); setEditMeeting(null); }}
        onSaved={() => { refetch(); setCreateOpen(false); setEditMeeting(null); }}
        meeting={editMeeting}
      />

      {attendanceMeeting && (
        <AttendanceModal
          meeting={attendanceMeeting}
          members={members}
          attendance={attendance}
          onClose={() => setAttendanceMeeting(null)}
          onSaved={() => { refetchAttendance(); setAttendanceMeeting(null); }}
        />
      )}
    </div>
  );
}

function MeetingSection({ title, accent, meetings, sections, attendance, members, canManage, profileId, onEdit, onDelete, onAttendance }: {
  title: string; accent: string; meetings: Meeting[];
  sections: { id: string; name: string }[];
  attendance: { meeting_id: string; member_id: string; status: AttendanceStatus }[];
  members: { id: string }[];
  canManage: boolean; profileId?: string;
  onEdit: (m: Meeting) => void;
  onDelete: (id: string) => void;
  onAttendance: (m: Meeting) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`w-1 h-5 rounded-full ${accent}`} />
        <span className="text-sm font-semibold text-ink-700">{title}</span>
        <span className="text-xs text-ink-400">({meetings.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {meetings.map((m) => {
          const section = sections.find((s) => s.id === m.section_id);
          const meetingAtt = attendance.filter((a) => a.meeting_id === m.id);
          const present = meetingAtt.filter((a) => a.status === 'present').length;
          const myStatus = meetingAtt.find((a) => a.member_id === profileId)?.status;
          const past = isPast(m);
          return (
            <div key={m.id} className="card card-hover flex flex-col">
              <div className={`h-1 w-full rounded-t-2xl ${past ? 'bg-ink-300' : 'bg-blue-500'}`} />
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <Badge tone={past ? 'neutral' : 'blue'}>{past ? 'Past' : 'Upcoming'}</Badge>
                  {myStatus && (
                    <Badge tone={myStatus === 'present' ? 'mint' : myStatus === 'late' ? 'amber' : 'red'}>
                      {myStatus}
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-ink-900 leading-snug">{m.title}</h3>
                {m.description && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{m.description}</p>}
                {section && (
                  <span className="mt-2 text-xs text-ink-500 flex items-center gap-1">
                    <Users size={11} /> {section.name}
                  </span>
                )}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
                  <span className="flex items-center gap-1"><CalendarDays size={12} /> {formatDate(m.meeting_date, { dateStyle: 'medium' })}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {m.meeting_time.slice(0, 5)}</span>
                </div>
                {past && meetingAtt.length > 0 && (
                  <div className="mt-2 text-xs text-ink-500">
                    {present}/{members.length} present
                  </div>
                )}
                <div className="flex items-center gap-2 mt-4">
                  {m.meeting_link && (
                    <a href={m.meeting_link} target="_blank" rel="noreferrer" className="btn-primary btn-sm flex-1 justify-center">
                      <Link2 size={13} /> Join
                    </a>
                  )}
                  {canManage && (
                    <>
                      <button onClick={() => onAttendance(m)} className="btn-secondary btn-sm flex-1 justify-center text-xs">
                        <Users size={13} /> Attendance
                      </button>
                      <button onClick={() => onEdit(m)} className="btn-ghost btn-sm !px-2"><Pencil size={14} /></button>
                      <button onClick={() => onDelete(m.id)} className="btn-ghost btn-sm !px-2 text-brand-600 hover:bg-brand-50"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MeetingFormModal({ open, onClose, onSaved, meeting }: {
  open: boolean; onClose: () => void; onSaved: () => void; meeting?: Meeting | null;
}) {
  const { activeCommittee } = useAuth();
  const { push } = useToast();
  const { data: sections } = useSections();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [link, setLink] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (meeting) {
      setTitle(meeting.title); setDesc(meeting.description ?? '');
      setLink(meeting.meeting_link ?? ''); setDate(meeting.meeting_date);
      setTime(meeting.meeting_time.slice(0, 5)); setSectionId(meeting.section_id ?? '');
    } else {
      setTitle(''); setDesc(''); setLink('');
      setDate(new Date().toISOString().slice(0, 10)); setTime('09:00'); setSectionId('');
    }
  }, [open, meeting]);

  const save = async () => {
    if (!title.trim()) { push('error', 'Add a title'); return; }
    if (!activeCommittee) { push('error', 'No active workspace'); return; }
    if (!date) { push('error', 'Select a date'); return; }
    setSaving(true);
    const payload = {
      committee_id: activeCommittee.id,
      section_id: sectionId || null,
      title, description: desc || null,
      meeting_link: link || null,
      meeting_date: date,
      meeting_time: time || '00:00',
    };
    const { error } = meeting
      ? await supabase.from('meetings').update(payload).eq('id', meeting.id)
      : await supabase.from('meetings').insert(payload);
    setSaving(false);
    if (error) { push('error', error.message); return; }
    push('success', meeting ? 'Meeting updated' : 'Meeting created');
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meeting ? 'Edit Meeting' : 'New Meeting'}
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : meeting ? 'Save Changes' : 'Create'}
        </button>
      </>}
    >
      <div className="space-y-4">
        {activeCommittee && (
          <div className="flex items-center gap-2 px-3 h-9 rounded-xl bg-brand-50 border border-brand-200/60 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: activeCommittee.color }} />
            <span className="font-medium text-brand-700">{activeCommittee.name}</span>
          </div>
        )}
        <Field label="Title" value={title} onChange={setTitle} placeholder="Meeting title" />
        <Field label="Description" value={desc} onChange={setDesc} placeholder="What's this meeting about?" textarea />
        <Field label="Meeting Link (Zoom / Google Meet)" value={link} onChange={setLink} placeholder="https://..." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" value={date} onChange={setDate} type="date" />
          <Field label="Time" value={time} onChange={setTime} type="time" />
        </div>
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
      </div>
    </Modal>
  );
}

function AttendanceModal({ meeting, members, attendance, onClose, onSaved }: {
  meeting: Meeting;
  members: { id: string; name: string; avatar_url: string | null; position: string }[];
  attendance: { meeting_id: string; member_id: string; status: AttendanceStatus }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { activeCommittee } = useAuth();
  const { push } = useToast();
  const existing = attendance.filter((a) => a.meeting_id === meeting.id);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>(() => {
    const r: Record<string, AttendanceStatus> = {};
    existing.forEach((a) => { r[a.member_id] = a.status; });
    return r;
  });

  const save = async () => {
    if (!activeCommittee) return;
    const rows = members.map((m) => ({
      meeting_id: meeting.id,
      member_id: m.id,
      committee_id: activeCommittee.id,
      status: records[m.id] ?? 'absent',
    }));
    const { error } = await supabase.from('meeting_attendance').upsert(rows, { onConflict: 'meeting_id,member_id' });
    if (error) { push('error', error.message); return; }
    push('success', 'Attendance saved');
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Attendance — ${meeting.title}`}
      width="max-w-xl"
      footer={<>
        <button className="btn-secondary btn-md" onClick={onClose}>Cancel</button>
        <button className="btn-primary btn-md" onClick={save}><Save size={14} /> Save</button>
      </>}
    >
      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {members.map((m) => {
          const status = records[m.id] ?? 'absent';
          return (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-ink-50">
              <Avatar src={m.avatar_url} name={m.name} size={30} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-800 truncate">{m.name}</p>
                <p className="text-xs text-ink-500">{m.position}</p>
              </div>
              <div className="flex gap-1">
                {(['present', 'late', 'absent'] as AttendanceStatus[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => setRecords((r) => ({ ...r, [m.id]: st }))}
                    className={`px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
                      status === st
                        ? st === 'present' ? 'bg-mint-500 text-white'
                          : st === 'late' ? 'bg-amber-500 text-white'
                          : 'bg-brand-600 text-white'
                        : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                    }`}
                  >
                    {st === 'present' ? 'P' : st === 'late' ? 'L' : 'A'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {members.length === 0 && <p className="text-sm text-ink-500 text-center py-8">No members in this committee.</p>}
      </div>
    </Modal>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: string }) {
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

import { useState } from 'react';
import { Pin, Image as ImageIcon, FileText, Link2, Plus, Send, Megaphone } from 'lucide-react';
import { Badge, SectionHeader, EmptyState, Avatar, formatDate, Field, Modal } from '../components/ui';
import { Breadcrumbs } from '../components/Router';
import { useToast } from '../components/Toast';
import { useAnnouncements, useMembers } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function AnnouncementsPage() {
  const { push } = useToast();
  const { data: items, refetch } = useAnnouncements();
  const { data: members } = useMembers();
  const { role, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState('');
  const [file, setFile] = useState('');
  const [pinned, setPinned] = useState(false);

  const canPost = ['admin', 'director', 'team_leader', 'vice_team_leader', 'hr'].includes(role);
  const pinnedItems = items.filter((a) => a.pinned);
  const rest = items.filter((a) => !a.pinned);

  const publish = async () => {
    if (!title.trim() || !body.trim()) { push('error', 'Title and body are required'); return; }
    const { error } = await supabase.from('announcements').insert({
      author_id: profile?.id ?? null, title, body,
      link_url: link || null, image_url: image || null, file_url: file || null, pinned,
    });
    if (error) { push('error', error.message); return; }
    push('success', 'Announcement published');
    setOpen(false); setTitle(''); setBody(''); setLink(''); setImage(''); setFile(''); setPinned(false);
    refetch();
  };

  const togglePin = async (id: string, val: boolean) => {
    const { error } = await supabase.from('announcements').update({ pinned: !val }).eq('id', id);
    if (error) { push('error', error.message); return; }
    refetch();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Announcements' }]} />
      <SectionHeader
        title="Announcements"
        description="Team-wide updates and pinned posts"
        action={canPost && <button className="btn-primary btn-md" onClick={() => setOpen(true)}><Plus size={15} /> New Announcement</button>}
      />

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<Megaphone size={22} />} title="No announcements yet" description="Posts will appear here once published." /></div>
      ) : (
        <>
          {pinnedItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5"><Pin size={12} /> Pinned</p>
              <div className="space-y-3">{pinnedItems.map((a) => <Card key={a.id} a={a} members={members} canManage={canPost} onPin={() => togglePin(a.id, a.pinned)} />)}</div>
            </div>
          )}
          <div className="space-y-3">{rest.map((a) => <Card key={a.id} a={a} members={members} canManage={canPost} onPin={() => togglePin(a.id, a.pinned)} />)}</div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Announcement" width="max-w-lg" footer={<>
        <button className="btn-secondary btn-md" onClick={() => setOpen(false)}>Cancel</button>
        <button className="btn-primary btn-md" onClick={publish}><Send size={14} /> Publish</button>
      </>}>
        <div className="space-y-4">
          <Field label="Title" value={title} onChange={setTitle} placeholder="Announcement title" />
          <Field label="Body" value={body} onChange={setBody} placeholder="Share an update..." textarea />
          <Field label="Image URL (optional)" value={image} onChange={setImage} placeholder="https://..." />
          <Field label="File URL (optional)" value={file} onChange={setFile} placeholder="https://..." />
          <Field label="Link URL (optional)" value={link} onChange={setLink} placeholder="https://..." />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
            Pin this announcement
          </label>
        </div>
      </Modal>
    </div>
  );
}

function Card({ a, members, canManage, onPin }: { a: any; members: any[]; canManage: boolean; onPin: () => void }) {
  const author = members.find((m) => m.id === a.author_id);
  return (
    <div className="card card-hover overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <Avatar src={author?.avatar_url ?? null} name={author?.name ?? 'Unknown'} size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-ink-900">{author?.name ?? 'Unknown'}</span>
              {author?.role && <Badge tone="neutral">{author.role}</Badge>}
              {a.pinned && <Badge tone="brand"><Pin size={10} /> Pinned</Badge>}
              <span className="text-xs text-ink-400 ml-auto">{formatDate(a.created_at, { dateStyle: 'medium' })}</span>
            </div>
            <h3 className="text-base font-semibold text-ink-900 mt-2">{a.title}</h3>
            <p className="text-sm text-ink-600 leading-relaxed mt-1">{a.body}</p>
            {a.link_url && <a href={a.link_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline mt-2"><Link2 size={13} /> {a.link_url}</a>}
            {a.file_url && <div className="mt-2 inline-flex items-center gap-2 px-3 h-9 rounded-xl bg-ink-50 border border-ink-200 text-sm text-ink-700"><FileText size={14} className="text-ink-400" /> Attached file</div>}
          </div>
        </div>
      </div>
      {a.image_url && <img src={a.image_url} alt="" className="w-full max-h-72 object-cover" loading="lazy" />}
      {canManage && (
        <div className="px-5 py-2 border-t border-ink-100 flex justify-end">
          <button onClick={onPin} className="text-xs text-ink-500 hover:text-brand-600 flex items-center gap-1"><Pin size={12} /> {a.pinned ? 'Unpin' : 'Pin'}</button>
        </div>
      )}
    </div>
  );
}

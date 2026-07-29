import type { ReactNode } from 'react';
import type { MemberStatus, SubmissionType, Role } from '../lib/supabase';

export function Badge({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'mint' | 'amber' | 'blue' | 'red' | 'purple'; className?: string; }) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-700',
    mint: 'bg-mint-100 text-mint-500',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-700',
  };
  return <span className={`chip ${tones[tone]} ${className}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: MemberStatus }) {
  const map: Record<MemberStatus, 'mint' | 'amber' | 'neutral'> = { active: 'mint', on_leave: 'amber', inactive: 'neutral' };
  const dot = status === 'active' ? 'bg-mint-500' : status === 'on_leave' ? 'bg-amber-500' : 'bg-ink-400';
  return (
    <Badge tone={map[status]}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status === 'on_leave' ? 'On Leave' : status === 'inactive' ? 'Inactive' : 'Active'}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, 'brand' | 'purple' | 'blue' | 'neutral' | 'amber'> = {
    admin: 'brand', director: 'amber', team_leader: 'blue', vice_team_leader: 'blue', hr: 'purple', member: 'neutral',
  };
  const labels: Record<Role, string> = {
    admin: 'Admin', director: 'Director', team_leader: 'Team Leader', vice_team_leader: 'Vice TL', hr: 'HR', member: 'Member',
  };
  return <Badge tone={map[role]}>{labels[role]}</Badge>;
}

export function SubmissionTypeBadge({ type }: { type: SubmissionType }) {
  const map: Record<SubmissionType, 'blue' | 'mint' | 'amber'> = {
    google_form: 'blue', external_link: 'mint', file_upload: 'amber',
  };
  const labels: Record<SubmissionType, string> = {
    google_form: 'Google Form', external_link: 'External Link', file_upload: 'File Upload',
  };
  return <Badge tone={map[type]}>{labels[type]}</Badge>;
}

export function Avatar({ src, name, size = 36, className = '' }: { src: string | null; name: string; size?: number; className?: string }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('');
  return (
    <div
      className={`relative rounded-full overflow-hidden bg-ink-100 flex items-center justify-center text-ink-500 font-medium shrink-0 ring-1 ring-ink-200/60 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      title={name}
    >
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" /> : <span>{initials}</span>}
    </div>
  );
}

export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'mint' | 'amber' | 'blue' }) {
  const tones = { brand: 'bg-brand-600', mint: 'bg-mint-500', amber: 'bg-amber-500', blue: 'bg-blue-500' };
  return (
    <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
      <div className={`h-full ${tones[tone]} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-[22px] font-semibold text-ink-900 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-ink-100 flex items-center justify-center text-ink-400 mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-ink-800">{title}</h3>
      <p className="text-sm text-ink-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return <div className="card p-5"><div className="skeleton h-32 w-full" /></div>;
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative card w-full ${width} animate-scale-in max-h-[90vh] flex flex-col`}>
        <div className="px-6 py-4 border-b border-ink-200/70 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xs">Esc</button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-200/70 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = 'text', textarea, options }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; textarea?: boolean; options?: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-600 mb-1.5">{label}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input !h-auto py-2 resize-none" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" />
      )}
    </div>
  );
}

export function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Date(dateStr).toLocaleDateString('en', opts);
}

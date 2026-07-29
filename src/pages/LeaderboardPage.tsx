import { useMemo } from 'react';
import { Trophy, Award, CheckCircle2, Star } from 'lucide-react';
import { Link, Breadcrumbs } from '../components/Router';
import { Avatar, Badge, SectionHeader, EmptyState } from '../components/ui';
import { useMemberScores, useMembers } from '../lib/hooks';
import { useAuth } from '../lib/auth';

export function LeaderboardPage() {
  const { data: scores } = useMemberScores();
  const { data: members } = useMembers();
  const { profile, activeCommittee, role, availableCommittees } = useAuth();

  const ranked = useMemo(() => [...scores].sort((a, b) => b.total_points - a.total_points), [scores]);
  const top10 = ranked.slice(0, 10);
  const best = ranked[0];
  const myRank = ranked.findIndex((s) => s.member_id === profile?.id) + 1;

  if (ranked.length === 0) return <div className="card"><EmptyState icon={<Trophy size={22} />} title="No scores yet" description="The leaderboard fills as HR records evaluation data." /></div>;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/dashboard' }, { label: 'Leaderboard' }]} />
      <SectionHeader title="Leaderboard" description="Members ranked by automatically calculated final scores" />

      {/* Best member highlight */}
      {best && (() => {
        const bm = members.find((m) => m.id === best.member_id);
        return (
          <div className="card p-6 bg-gradient-to-br from-amber-50 via-white to-mint-50/50 border-amber-200/60">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={18} className="text-amber-600" />
              <Badge tone="amber">Best Member</Badge>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar src={bm?.avatar_url ?? null} name={best.name} size={72} className="ring-4 ring-white shadow-soft" />
              <div className="flex-1">
                <Link to={`/members/${best.member_id}`} className="text-xl font-semibold text-ink-900 hover:text-brand-700 transition-colors">{best.name}</Link>
                <p className="text-sm text-ink-500">{bm?.position ?? ''}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1.5 text-ink-600"><CheckCircle2 size={14} className="text-blue-600" /> {best.tasks_completed} tasks</span>
                  <span className="flex items-center gap-1.5 text-ink-600"><Star size={14} className="text-purple-600" /> {best.quizzes_completed} quizzes</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-ink-500">Total Points</p>
                <p className="text-4xl font-semibold text-amber-700">{best.total_points}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* My rank card */}
      {profile && (
        <div className="card p-4 flex items-center gap-3">
          <span className="text-sm text-ink-500">Your position</span>
          <Badge tone={myRank <= 3 ? 'amber' : 'neutral'}>Rank #{myRank || '—'} of {ranked.length}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <Avatar src={profile.avatar_url} name={profile.name} size={28} />
            <span className="text-sm font-medium text-ink-800">{profile.name}</span>
            <span className="text-sm font-semibold text-brand-600">{ranked.find((s) => s.member_id === profile.id)?.total_points ?? 0} pts</span>
          </div>
        </div>
      )}

      {/* Top 10 table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-200/70 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900 flex items-center gap-2"><Award size={16} className="text-amber-600" /> Top 10 Members</h3>
          <span className="text-xs text-ink-500">Updated live from evaluation data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200/70 bg-ink-50/50 text-left">
                <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Rank</th>
                <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Member</th>
                <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider">Points</th>
                <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider hidden md:table-cell">Tasks</th>
                <th className="px-5 py-3 font-medium text-xs text-ink-500 uppercase tracking-wider hidden md:table-cell">Quizzes</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((s, i) => {
                const m = members.find((x) => x.id === s.member_id);
                const isMe = s.member_id === profile?.id;
                return (
                  <tr key={s.member_id} className={`border-b border-ink-100 last:border-0 hover:bg-ink-50/60 transition-colors ${isMe ? 'bg-brand-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <span className="text-lg font-semibold">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-ink-500 text-sm">{i + 1}</span>}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Link to={`/members/${s.member_id}`} className="flex items-center gap-3 group">
                        <Avatar src={m?.avatar_url ?? null} name={s.name} size={32} />
                        <div>
                          <p className="font-medium text-ink-800 group-hover:text-brand-700 transition-colors">{s.name}</p>
                          <p className="text-xs text-ink-500">{m?.position ?? ''}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3"><span className="text-base font-semibold text-ink-900">{s.total_points}</span></td>
                    <td className="px-5 py-3 text-ink-700 hidden md:table-cell">{s.tasks_completed}</td>
                    <td className="px-5 py-3 text-ink-700 hidden md:table-cell">{s.quizzes_completed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

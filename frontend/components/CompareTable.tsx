import Image from 'next/image';
import type { Profile } from '@/lib/api';

interface CompareTableProps {
  profiles: Profile[];
}

type MetricDef = {
  label: string;
  key: keyof Profile;
  format?: (v: unknown, p: Profile) => React.ReactNode;
  higherIsBetter?: boolean;
  isNumber?: boolean;
};

const METRICS: MetricDef[] = [
  { label: 'Account Type', key: 'account_type' },
  { label: 'Followers', key: 'followers', higherIsBetter: true, isNumber: true,
    format: (v) => (v as number).toLocaleString() },
  { label: 'Following', key: 'following', isNumber: true,
    format: (v) => (v as number).toLocaleString() },
  { label: 'Public Repos', key: 'public_repos', higherIsBetter: true, isNumber: true,
    format: (v) => (v as number).toLocaleString() },
  { label: 'Primary Language', key: 'primary_language',
    format: (v) => v ? <span className="font-mono text-amber-400 text-xs">{v as string}</span> : '—' },
  { label: 'Total Stars ★', key: 'total_stars', higherIsBetter: true, isNumber: true,
    format: (v) => (v as number).toLocaleString() },
  { label: 'Total Forks', key: 'total_forks', higherIsBetter: true, isNumber: true,
    format: (v) => (v as number).toLocaleString() },
  { label: 'Avg Stars/Repo', key: 'avg_stars_per_repo', higherIsBetter: true, isNumber: true,
    format: (v) => (v as number).toFixed(2) },
  { label: 'Account Age', key: 'account_age_days', higherIsBetter: true, isNumber: true,
    format: (v) => `${(v as number).toLocaleString()}d` },
  { label: 'Most Starred Repo', key: 'most_starred_repo',
    format: (v) => v ? <span className="font-mono text-xs">{v as string}</span> : '—' },
  { label: 'README Profile', key: 'has_readme_profile',
    format: (v) => v ? <span className="text-green-400">✓ Yes</span> : <span className="text-[#333]">✗ No</span> },
  { label: 'Last Push', key: 'last_active_date',
    format: (v) => v ? new Date(v as string).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—' },
];

function getWinner(profiles: Profile[], metric: MetricDef): string | null {
  if (!metric.isNumber || !metric.higherIsBetter) return null;
  const vals = profiles.map((p) => Number(p[metric.key]) || 0);
  const max = Math.max(...vals);
  if (vals.filter((v) => v === max).length > 1) return null; // tie
  const winnerIdx = vals.indexOf(max);
  return profiles[winnerIdx].username;
}

export default function CompareTable({ profiles }: CompareTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-[#333] font-mono text-xs uppercase tracking-widest border-b border-white/5 bg-[#0f0f0f] w-40">
              Metric
            </th>
            {profiles.map((p) => (
              <th key={p.username} className="px-4 py-3 border-b border-white/5 bg-[#0f0f0f] min-w-36">
                <div className="flex flex-col items-center gap-2">
                  {p.avatar_url && (
                    <Image src={p.avatar_url} alt={p.username} width={40} height={40}
                      className="rounded-full border border-amber-400/20" />
                  )}
                  <div>
                    <p className="heading-editorial text-sm text-[#f0ece3] text-center">{p.name || p.username}</p>
                    <p className="font-mono text-xs text-[#444] text-center">@{p.username}</p>
                  </div>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((metric, i) => {
            const winner = getWinner(profiles, metric);
            return (
              <tr key={metric.key} className={i % 2 === 0 ? 'bg-[#0d0d0d]' : 'bg-[#111]'}>
                <td className="px-4 py-3 font-mono text-xs text-[#444] border-r border-white/5">
                  {metric.label}
                </td>
                {profiles.map((p) => {
                  const val = p[metric.key];
                  const isWinner = winner === p.username;
                  return (
                    <td key={p.username}
                      className={`px-4 py-3 text-center text-sm transition-colors ${isWinner ? 'text-amber-400 bg-amber-400/5' : 'text-[#888]'}`}>
                      {metric.format ? metric.format(val, p) : (val as string | number | null) ?? '—'}
                      {isWinner && <span className="ml-1 text-amber-400 text-xs">↑</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

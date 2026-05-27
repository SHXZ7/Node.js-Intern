import type { StatsResponse } from '@/lib/api';

interface StatsGridProps {
  stats: StatsResponse['data'];
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const items = [
    { label: 'Profiles Analyzed', value: stats.total_profiles.toLocaleString() },
    { label: 'Avg Followers', value: stats.avg_followers.toLocaleString() },
    { label: 'Avg Stars', value: stats.avg_stars.toLocaleString() },
    { label: 'Top Language', value: stats.most_common_language || '—' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="border border-white/5 bg-[#111] rounded-sm p-5 group hover:border-amber-400/10 transition-colors"
        >
          <p className="text-[#444] font-mono text-xs uppercase tracking-widest mb-2">{label}</p>
          <p className="stat-number text-2xl md:text-3xl font-bold text-[#f0ece3] group-hover:text-amber-400/90 transition-colors">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

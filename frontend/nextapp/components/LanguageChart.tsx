'use client';

interface LanguageChartProps {
  languages: [string, number][];
  total: number;
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f7df1e',
  TypeScript: '#3178c6',
  Python: '#3572a5',
  Java: '#b07219',
  Go: '#00add8',
  Rust: '#dea584',
  C: '#555555',
  'C++': '#f34b7d',
  Ruby: '#701516',
  PHP: '#4f5d95',
  Swift: '#fa7343',
  Kotlin: '#a97bff',
  Shell: '#89e051',
  CSS: '#563d7c',
  HTML: '#e34c26',
};

function getColor(lang: string): string {
  return LANG_COLORS[lang] || '#f59e0b';
}

export default function LanguageChart({ languages, total }: LanguageChartProps) {
  if (!languages.length) return null;

  return (
    <div className="space-y-4">
      {languages.map(([lang, count]) => {
        const pct = Math.round((count / total) * 100);
        const color = getColor(lang);
        return (
          <div key={lang}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="font-mono text-sm text-[#f0ece3]">{lang}</span>
              <span className="font-mono text-xs text-[#555]">
                {count} repo{count !== 1 ? 's' : ''} · {pct}%
              </span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full lang-bar"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  '--bar-width': `${pct}%`,
                } as React.CSSProperties}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { analyzeProfile, getProfile, type Profile } from '@/lib/api';
import LanguageChart from '@/components/LanguageChart';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const TIER_CONFIG = {
  Legend:   { color: '#f59e0b', bg: 'bg-amber-400/10 border-amber-400/30',   text: 'text-amber-400',   emoji: '⚡' },
  Elite:    { color: '#a78bfa', bg: 'bg-purple-400/10 border-purple-400/30', text: 'text-purple-400',  emoji: '🔮' },
  Senior:   { color: '#34d399', bg: 'bg-emerald-400/10 border-emerald-400/30', text: 'text-emerald-400', emoji: '🚀' },
  Rising:   { color: '#60a5fa', bg: 'bg-blue-400/10 border-blue-400/30',    text: 'text-blue-400',    emoji: '📈' },
  Newcomer: { color: '#6b6b6b', bg: 'bg-white/5 border-white/10',           text: 'text-[#888]',      emoji: '🌱' },
};

function StatBlock({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="p-5 border border-white/5 rounded-sm bg-[#111] flex flex-col gap-1 hover:border-white/10 transition-colors">
      <span className="text-[#444] text-xs font-mono uppercase tracking-widest">{label}</span>
      <span className="stat-number text-3xl font-bold text-[#f0ece3]">{value}</span>
      {sub && <span className="text-[#444] text-xs font-mono mt-0.5">{sub}</span>}
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[#444] text-xs font-mono uppercase tracking-widest">{label}</span>
      <span className={`font-mono text-sm ${highlight ? 'text-amber-400' : 'text-[#f0ece3]'}`}>{value}</span>
    </div>
  );
}

// ── Developer Score Arc ──────────────────────────────────────────────────
function DeveloperScoreRing({ score, tier }: { score: number; tier: Profile['developer_tier'] }) {
  const cfg = TIER_CONFIG[tier];
  const r = 52, cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 rounded-sm border ${cfg.bg}`}>
      <div className="relative">
        <svg width="128" height="128" viewBox="0 0 128 128">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          {/* Arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={cfg.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          {/* Score number */}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#f0ece3" fontSize="22" fontWeight="bold" fontFamily="monospace">
            {score}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#555" fontSize="11" fontFamily="monospace">
            / 100
          </text>
        </svg>
      </div>
      <div className="text-center">
        <div className={`font-mono text-lg font-bold ${cfg.text}`}>{cfg.emoji} {tier}</div>
        <div className="text-[#444] text-xs font-mono mt-1">Developer Tier</div>
      </div>
    </div>
  );
}

// ── Activity Bar ──────────────────────────────────────────────────────────
function ActivityBar({ label, value, max, color = '#f59e0b' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="font-mono text-xs text-[#888]">{label}</span>
        <span className="font-mono text-xs text-[#555]">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Topic Pill ────────────────────────────────────────────────────────────
function TopicPill({ topic }: { topic: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full border border-white/8 bg-white/3 text-[#888] font-mono text-xs hover:border-amber-400/20 hover:text-amber-400 transition-colors">
      #{topic}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────
function ProgressBar({ label, value, suffix = '%', color = '#4ade80' }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-[#555] w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs text-[#888] w-12 text-right shrink-0">{value}{suffix}</span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadProfile = async (forceAnalyze = false) => {
    setLoading(true);
    setError(null);
    try {
      if (forceAnalyze) {
        const res = await analyzeProfile(username);
        if (res.success) setProfile(res.data);
        else throw new Error(res.message || 'Analysis failed');
      } else {
        try {
          const res = await getProfile(username);
          if (res.success) setProfile(res.data);
        } catch {
          const res = await analyzeProfile(username);
          if (res.success) setProfile(res.data);
          else throw new Error(res.message || 'Analysis failed');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
      setReanalyzing(false);
    }
  };

  useEffect(() => { loadProfile(); }, [username]);

  const handleReanalyze = async () => { setReanalyzing(true); await loadProfile(true); };

  const addToCompare = () => {
    const existing = JSON.parse(localStorage.getItem('compareList') || '[]') as string[];
    if (!existing.includes(username)) existing.push(username);
    localStorage.setItem('compareList', JSON.stringify(existing.slice(-4)));
    router.push(`/compare?users=${existing.join(',')}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#555] font-mono text-sm">Analyzing @{username}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="heading-editorial text-4xl mb-4 text-amber-400">404</p>
          <h2 className="text-xl text-[#f0ece3] mb-2">Profile not found</h2>
          <p className="text-[#555] mb-8">{error}</p>
          <Link href="/" className="text-amber-400 hover:underline font-mono text-sm">← Back to search</Link>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const topLangs = Object.entries(profile.top_languages || {}).slice(0, 8);
  const totalLangRepos = topLangs.reduce((s, [, v]) => s + v, 0);
  const tierCfg = TIER_CONFIG[profile.developer_tier] || TIER_CONFIG.Newcomer;

  const maxActivity = Math.max(
    profile.recent_push_count,
    profile.recent_pr_count,
    profile.recent_issue_count,
    profile.recent_review_count,
    1
  );

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-12">
      {/* Nav */}
      <Link href="/" className="text-[#555] hover:text-amber-400 font-mono text-sm transition-colors mb-8 inline-flex items-center gap-2">
        ← Back
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="grain-overlay mt-6 mb-8 p-8 border border-white/5 rounded-sm bg-[#111] flex flex-col sm:flex-row gap-8 items-start">
        <div className="relative shrink-0">
          {profile.avatar_url && (
            <Image src={profile.avatar_url} alt={profile.username} width={96} height={96}
              className="rounded-full avatar-glow border-2 border-amber-400/30" />
          )}
          {profile.hireable === true && (
            <span className="absolute -bottom-1 -right-1 text-xs bg-emerald-500 text-black font-mono px-1.5 py-0.5 rounded-full">
              Hire
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="heading-editorial text-3xl md:text-4xl text-[#f0ece3]">{profile.name || profile.username}</h1>
            <span className={`font-mono text-xs px-2 py-0.5 rounded border ${tierCfg.bg} ${tierCfg.text}`}>
              {tierCfg.emoji} {profile.developer_tier}
            </span>
            {profile.primary_language && (
              <span className="font-mono text-xs px-2 py-0.5 rounded border border-white/8 text-[#888]">
                {profile.primary_language}
              </span>
            )}
          </div>

          <a href={profile.github_url || `https://github.com/${profile.username}`} target="_blank" rel="noopener noreferrer"
            className="font-mono text-sm text-[#555] hover:text-amber-400 transition-colors">
            @{profile.username} ↗
          </a>

          {profile.bio && <p className="text-[#888] mt-3 leading-relaxed max-w-lg text-sm">{profile.bio}</p>}

          <div className="flex flex-wrap gap-4 mt-4">
            {profile.location && <span className="text-xs text-[#555] font-mono">📍 {profile.location}</span>}
            {profile.company && <span className="text-xs text-[#555] font-mono">🏢 {profile.company}</span>}
            {profile.blog && (
              <a href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#555] font-mono hover:text-amber-400 transition-colors">
                🌐 {profile.blog}
              </a>
            )}
            {profile.twitter_username && (
              <a href={`https://twitter.com/${profile.twitter_username}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#555] font-mono hover:text-sky-400 transition-colors">
                𝕏 @{profile.twitter_username}
              </a>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={handleReanalyze} disabled={reanalyzing}
              className="px-4 py-2 text-sm font-mono bg-amber-400 text-black rounded-sm hover:bg-amber-300 disabled:opacity-50 transition-colors">
              {reanalyzing ? 'Scanning...' : '↻ Re-analyze'}
            </button>
            <button onClick={addToCompare}
              className="px-4 py-2 text-sm font-mono border border-white/10 text-[#888] hover:border-amber-400/30 hover:text-amber-400 rounded-sm transition-colors">
              ⇌ Compare
            </button>
          </div>
        </div>
      </div>

      {/* ── Developer Score + Core Stats ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-8">
        <div className="sm:col-span-1">
          <DeveloperScoreRing score={profile.developer_score} tier={profile.developer_tier} />
        </div>
        <div className="sm:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Followers" value={fmtK(profile.followers)} />
          <StatBlock label="Total Stars" value={fmtK(profile.total_stars)} sub={`avg ${profile.avg_stars_per_repo}/repo`} />
          <StatBlock label="Public Repos" value={fmt(profile.public_repos)} sub={`${profile.original_repo_count} original`} />
          <StatBlock label="Account Age" value={`${profile.account_age_days.toLocaleString()}d`}
            sub={`${Math.floor(profile.account_age_days / 365)}y ${Math.floor((profile.account_age_days % 365) / 30)}m`} />
        </div>
      </div>

      {/* ── Impact + Diversity ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatBlock label="Open Source Impact" value={fmtK(profile.open_source_impact)} sub="stars + forks + watchers" />
        <StatBlock label="Lang Diversity" value={profile.language_diversity_index} sub="unique languages" />
        <StatBlock label="Open Issues" value={fmt(profile.total_open_issues)} sub="community engagement" />
        <StatBlock label="Gists" value={fmt(profile.public_gists)} sub="code snippets" />
      </div>

      {/* ── AI Executive Review (Groq) ──────────────────────────────────── */}
      {profile.ai_analysis && (
        <section className="mb-8 p-6 border border-amber-500/20 bg-amber-500/5 rounded-sm relative overflow-hidden group">
          {/* Subtle glowing ambient element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -z-10 group-hover:bg-amber-500/10 transition-all duration-500" />
          
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 animate-pulse text-lg">✦</span>
              <h2 className="heading-editorial text-2xl text-[#f0ece3] tracking-wide">AI Executive Assessment</h2>
            </div>
            {profile.ai_analysis.persona && (
              <span className="font-mono text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full uppercase tracking-wider">
                {profile.ai_analysis.persona}
              </span>
            )}
          </div>

          {profile.ai_analysis.summary && (
            <p className="text-sm md:text-base text-[#d8d3c5] italic font-serif leading-relaxed mb-6 border-l-2 border-amber-400/40 pl-4 py-1">
              "{profile.ai_analysis.summary}"
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths & Standout Factors */}
            <div className="space-y-4">
              {profile.ai_analysis.strengths && profile.ai_analysis.strengths.length > 0 && (
                <div>
                  <h3 className="font-mono text-xs text-[#555] uppercase tracking-widest mb-2.5">Key Core Strengths</h3>
                  <ul className="space-y-2">
                    {profile.ai_analysis.strengths.map((str, idx) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-[#888] leading-relaxed">
                        <span className="text-emerald-400 shrink-0 select-none">✔</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.ai_analysis.standout_factors && profile.ai_analysis.standout_factors.length > 0 && (
                <div className="pt-2">
                  <h3 className="font-mono text-xs text-[#555] uppercase tracking-widest mb-2.5">Standout Distinction</h3>
                  <ul className="space-y-2">
                    {profile.ai_analysis.standout_factors.map((st, idx) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-[#888] leading-relaxed">
                        <span className="text-amber-400 shrink-0 select-none">★</span>
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Areas of Improvement & Career Guidance */}
            <div className="space-y-4">
              {profile.ai_analysis.weaknesses && profile.ai_analysis.weaknesses.length > 0 && (
                <div>
                  <h3 className="font-mono text-xs text-[#555] uppercase tracking-widest mb-2.5">Optimization Areas</h3>
                  <ul className="space-y-2">
                    {profile.ai_analysis.weaknesses.map((wk, idx) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-[#888] leading-relaxed">
                        <span className="text-amber-500/70 shrink-0 select-none">▲</span>
                        <span>{wk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {profile.ai_analysis.career_path && profile.ai_analysis.career_path.length > 0 && (
                <div className="pt-2">
                  <h3 className="font-mono text-xs text-[#555] uppercase tracking-widest mb-2.5">Suggested Career Paths</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profile.ai_analysis.career_path.map((path, idx) => (
                      <span key={idx} className="px-3 py-1 text-xs font-mono text-[#f0ece3] border border-white/5 bg-[#161616] rounded-sm hover:border-white/10 hover:text-amber-400 transition-colors">
                        🧭 {path}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Language Breakdown ────────────────────────────────────────── */}
      {topLangs.length > 0 && (
        <section className="mb-8 p-6 border border-white/5 rounded-sm bg-[#111]">
          <div className="flex justify-between items-baseline mb-6">
            <h2 className="heading-editorial text-xl text-[#f0ece3]">Language Distribution</h2>
            <span className="font-mono text-xs text-[#444]">{profile.language_diversity_index} languages</span>
          </div>
          <LanguageChart languages={topLangs} total={totalLangRepos} />
        </section>
      )}

      {/* ── Recent Activity (30 days) ─────────────────────────────────── */}
      <section className="mb-8 p-6 border border-white/5 rounded-sm bg-[#111]">
        <div className="flex justify-between items-baseline mb-6">
          <h2 className="heading-editorial text-xl text-[#f0ece3]">Activity (Last 30 Days)</h2>
          <span className={`font-mono text-sm ${profile.recent_events_count > 20 ? 'text-emerald-400' : profile.recent_events_count > 0 ? 'text-amber-400' : 'text-[#333]'}`}>
            {profile.recent_events_count} events
          </span>
        </div>
        <div className="space-y-4">
          <ActivityBar label="Push (commits)" value={profile.recent_push_count} max={maxActivity} color="#f59e0b" />
          <ActivityBar label="Pull Requests" value={profile.recent_pr_count} max={maxActivity} color="#a78bfa" />
          <ActivityBar label="Issues" value={profile.recent_issue_count} max={maxActivity} color="#60a5fa" />
          <ActivityBar label="PR Reviews" value={profile.recent_review_count} max={maxActivity} color="#34d399" />
          <ActivityBar label="Stars Given" value={profile.recent_star_given_count} max={maxActivity} color="#f472b6" />
        </div>
      </section>

      {/* ── Topics ───────────────────────────────────────────────────────*/}
      {profile.top_topics.length > 0 && (
        <section className="mb-8 p-6 border border-white/5 rounded-sm bg-[#111]">
          <h2 className="heading-editorial text-xl text-[#f0ece3] mb-5">Top Topics</h2>
          <div className="flex flex-wrap gap-2">
            {profile.top_topics.map((t) => <TopicPill key={t} topic={t} />)}
          </div>
        </section>
      )}

      {/* ── Quality Signals ───────────────────────────────────────────── */}
      <section className="mb-8 p-6 border border-white/5 rounded-sm bg-[#111]">
        <h2 className="heading-editorial text-xl text-[#f0ece3] mb-6">Code Quality Signals</h2>
        <div className="space-y-3">
          <ProgressBar label="Profile completeness" value={profile.profile_completeness_score} color="#f59e0b" />
          <ProgressBar label="Repos with description" value={profile.repos_with_description_pct} color="#4ade80" />
          <ProgressBar label="Repos with topics" value={profile.repos_with_topics > 0 ? Math.round((profile.repos_with_topics / profile.public_repos) * 100) : 0} color="#a78bfa" />
          <ProgressBar label="Original work" value={profile.public_repos > 0 ? Math.round((profile.original_repo_count / profile.public_repos) * 100) : 0} color="#60a5fa" />
        </div>
      </section>

      {/* ── Repo Highlights ──────────────────────────────────────────── */}
      <section className="mb-8 p-6 border border-white/5 rounded-sm bg-[#111]">
        <h2 className="heading-editorial text-xl text-[#f0ece3] mb-5">Repository Highlights</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <MiniStat label="Most Starred" value={profile.most_starred_repo || '—'} highlight />
          <MiniStat label="Most Forked" value={profile.most_forked_repo || '—'} highlight />
          <MiniStat label="License" value={profile.most_used_license || 'None'} />
          <MiniStat label="Total Forks" value={fmt(profile.total_forks)} />
          <MiniStat label="Total Watchers" value={fmt(profile.total_watchers)} />
          <MiniStat label="Forked Repos" value={`${profile.forked_repo_count} explored`} />
        </div>

        <div className="mt-5 pt-5 border-t border-white/5 flex flex-wrap gap-4">
          <span className={`flex items-center gap-2 text-xs font-mono ${profile.has_readme_profile ? 'text-emerald-400' : 'text-[#444]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${profile.has_readme_profile ? 'bg-emerald-400' : 'bg-[#333]'}`} />
            {profile.has_readme_profile ? 'Has profile README' : 'No profile README'}
          </span>
          {profile.last_active_date && (
            <span className="text-xs font-mono text-[#555]">
              Last push: {mounted ? new Date(profile.last_active_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </span>
          )}
          {profile.most_used_license && (
            <span className="text-xs font-mono text-[#555]">License: {profile.most_used_license}</span>
          )}
        </div>
      </section>

      {/* ── Following/Followers Ratio ─────────────────────────────────── */}
      <section className="p-6 border border-white/5 rounded-sm bg-[#111]">
        <h2 className="heading-editorial text-xl text-[#f0ece3] mb-5">Social Graph</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="stat-number text-3xl text-[#f0ece3]">{fmtK(profile.followers)}</p>
            <p className="text-xs text-[#444] font-mono mt-1">Followers</p>
          </div>
          <div className="text-center">
            <p className="stat-number text-3xl text-[#f0ece3]">{fmtK(profile.following)}</p>
            <p className="text-xs text-[#444] font-mono mt-1">Following</p>
          </div>
          <div className="text-center">
            <p className="stat-number text-3xl text-amber-400">
              {profile.following > 0 ? (profile.followers / profile.following).toFixed(1) : '∞'}×
            </p>
            <p className="text-xs text-[#444] font-mono mt-1">Follow Ratio</p>
          </div>
        </div>
      </section>
    </main>
  );
}

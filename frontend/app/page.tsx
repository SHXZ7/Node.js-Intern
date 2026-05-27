'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import ProfileCard from '@/components/ProfileCard';
import StatsGrid from '@/components/StatsGrid';
import { getAllProfiles, getStats, type Profile, type StatsResponse } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [recent, setRecent] = useState<Profile[]>([]);
  const [stats, setStats] = useState<StatsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [profilesRes, statsRes] = await Promise.allSettled([
        getAllProfiles({ limit: '12', sort: 'analyzed_at', order: 'desc' }),
        getStats(),
      ]);
      if (profilesRes.status === 'fulfilled') setRecent(profilesRes.value.data || []);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    } catch {
      // Non-critical — page still renders without data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSearch = (username: string) => {
    router.push(`/profile/${username.toLowerCase()}`);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 pt-24 pb-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-mono tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          GitHub Insight Engine
        </div>

        <h1 className="heading-editorial text-5xl md:text-7xl font-semibold text-[#f0ece3] mt-4 mb-6 leading-[1.1] max-w-3xl">
          Deep-scan any{' '}
          <span className="text-amber-400 italic">GitHub</span>{' '}
          developer profile
        </h1>

        <p className="text-[#6b6b6b] text-lg max-w-xl mb-12 leading-relaxed">
          Extract language stats, aggregate stars, activity timelines, and
          compare developers side-by-side — all backed by a live API.
        </p>

        <SearchBar onSearch={handleSearch} />
      </section>

      {/* Platform Stats */}
      {stats && (
        <section className="px-6 md:px-12 pb-16 max-w-6xl mx-auto w-full">
          <div className="flex items-baseline gap-3 mb-8">
            <h2 className="heading-editorial text-2xl text-[#f0ece3]">Platform Stats</h2>
            <span className="text-[#6b6b6b] text-sm font-mono">{stats.total_profiles} profiles analyzed</span>
          </div>
          <StatsGrid stats={stats} />
        </section>
      )}

      {/* Recently Analyzed */}
      {!loading && recent.length > 0 && (
        <section className="px-6 md:px-12 pb-20 max-w-6xl mx-auto w-full">
          <h2 className="heading-editorial text-2xl text-[#f0ece3] mb-6">Recently Analyzed</h2>
          <div className="flex gap-3 overflow-x-auto chip-scroll pb-2">
            {recent.map((profile) => (
              <ProfileCard
                key={profile.username}
                profile={profile}
                onClick={() => router.push(`/profile/${profile.username}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-[#333] text-xs font-mono">
        GitScope · Express.js + MongoDB Atlas · Node.js Intern Project
      </footer>
    </main>
  );
}

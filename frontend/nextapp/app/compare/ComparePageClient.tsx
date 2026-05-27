'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { compareProfiles, analyzeProfile, type Profile } from '@/lib/api';
import CompareTable from '@/components/CompareTable';

export default function ComparePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied] = useState(false);

  const usersParam = searchParams.get('users') || '';

  const loadComparison = useCallback(async (usersStr: string) => {
    const users = usersStr.split(',').map(u => u.trim()).filter(Boolean);
    if (users.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      // First try fetching from DB
      const res = await compareProfiles(users);
      if (res.success) {
        // If some are missing, analyze them
        const found = res.data.map(p => p.username);
        const missing = users.filter(u => !found.includes(u.toLowerCase()));
        if (missing.length > 0) {
          await Promise.allSettled(missing.map(u => analyzeProfile(u)));
          const res2 = await compareProfiles(users);
          if (res2.success) setProfiles(res2.data);
        } else {
          setProfiles(res.data);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to compare profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (usersParam) {
      setInputValue(usersParam);
      loadComparison(usersParam);
    }
  }, [usersParam, loadComparison]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const users = inputValue.split(',').map(u => u.trim()).filter(Boolean);
    if (users.length > 0) router.push(`/compare?users=${users.join(',')}`);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen max-w-6xl mx-auto px-6 py-12">
      <Link href="/" className="text-[#555] hover:text-amber-400 font-mono text-sm transition-colors mb-8 inline-flex items-center gap-2">
        ← Back
      </Link>

      <div className="mt-6 mb-10">
        <h1 className="heading-editorial text-4xl text-[#f0ece3] mb-2">Compare Board</h1>
        <p className="text-[#555] text-sm">Side-by-side developer comparison — amber ↑ marks the winner per metric</p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="torvalds, octocat, gvanrossum, addyosmani"
            className="flex-1 bg-[#111] border border-white/10 rounded-sm px-4 py-3 font-mono text-sm text-[#f0ece3] placeholder:text-[#333] transition-all"
          />
          <button type="submit"
            className="px-6 py-3 bg-amber-400 text-black font-mono text-sm rounded-sm hover:bg-amber-300 transition-colors shrink-0">
            Compare
          </button>
          {profiles.length > 0 && (
            <button type="button" onClick={copyUrl}
              className="px-4 py-3 border border-white/10 text-[#555] hover:text-amber-400 font-mono text-sm rounded-sm transition-colors shrink-0">
              {copied ? '✓ Copied' : '⇧ Share'}
            </button>
          )}
        </div>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="border border-red-500/20 bg-red-500/5 text-red-400 px-4 py-3 rounded-sm font-mono text-sm mb-6">
          {error}
        </div>
      )}

      {!loading && profiles.length > 0 && <CompareTable profiles={profiles} />}

      {!loading && !error && profiles.length === 0 && usersParam && (
        <div className="text-center py-20 text-[#333] font-mono">
          <p className="text-4xl mb-4">∅</p>
          <p>None of those profiles exist in the database yet.</p>
          <p className="text-sm mt-2 text-[#222]">Search for them first to analyze and store their data.</p>
        </div>
      )}

      {!usersParam && !loading && (
        <div className="text-center py-20 text-[#1a1a1a] font-mono">
          <p className="text-5xl mb-6">⇌</p>
          <p className="text-[#333]">Enter usernames above to compare developers</p>
        </div>
      )}
    </main>
  );
}

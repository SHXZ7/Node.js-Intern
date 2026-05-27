const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    // Client-side: use relative URL under Vercel multi-service routing prefix
    return '/_/backend';
  }
  // Server-side (SSR / Next.js Server Components):
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/_/backend`;
  }
  return 'http://localhost:3000';
};

const BASE = getApiBase();
export interface Profile {
  username: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  email: string | null;
  twitter_username: string | null;
  avatar_url: string | null;
  github_url: string | null;
  account_type: 'User' | 'Organization';
  hireable: boolean | null;

  // Core counts
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;

  // Engagement
  total_stars: number;
  total_forks: number;
  total_watchers: number;
  total_open_issues: number;
  open_source_impact: number;

  // Language
  top_languages: Record<string, number>;
  primary_language: string | null;
  language_diversity_index: number;

  // Topics
  top_topics: string[];

  // Activity
  account_age_days: number;
  last_active_date: string | null;
  has_readme_profile: boolean;

  // Repo insights
  most_starred_repo: string | null;
  most_forked_repo: string | null;
  avg_stars_per_repo: number;
  most_used_license: string | null;
  original_repo_count: number;
  forked_repo_count: number;
  repos_with_description_pct: number;
  repos_with_topics: number;

  // Recent activity (30d)
  recent_events_count: number;
  recent_push_count: number;
  recent_pr_count: number;
  recent_issue_count: number;
  recent_review_count: number;
  recent_star_given_count: number;

  // Computed scores
  profile_completeness_score: number;
  developer_score: number;
  developer_tier: 'Legend' | 'Elite' | 'Senior' | 'Rising' | 'Newcomer';

  // AI powered review (Groq)
  ai_analysis?: {
    persona: string | null;
    summary: string | null;
    strengths: string[];
    weaknesses: string[];
    standout_factors: string[];
    career_path: string[];
  } | null;

  analyzed_at: string;
  updated_at: string;
}

export interface PaginatedResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  data: Profile[];
}

export interface StatsResponse {
  success: boolean;
  data: {
    total_profiles: number;
    most_common_language: string | null;
    avg_followers: number;
    avg_stars: number;
    avg_repos: number;
    top_profiles_by_stars: Partial<Profile>[];
    language_distribution: Record<string, number>;
  };
}

export interface AnalyzeResponse {
  success: boolean;
  cached: boolean;
  message: string;
  data: Profile;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const analyzeProfile = (username: string): Promise<AnalyzeResponse> =>
  apiFetch(`${BASE}/api/profiles/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });

export const getProfile = (username: string): Promise<{ success: boolean; data: Profile }> =>
  apiFetch(`${BASE}/api/profiles/${username}`);

export const getAllProfiles = (params?: Record<string, string>): Promise<PaginatedResponse> =>
  apiFetch(`${BASE}/api/profiles?${new URLSearchParams(params || {})}`);

export const getStats = (): Promise<StatsResponse> =>
  apiFetch(`${BASE}/api/stats`);

export const compareProfiles = (usernames: string[]): Promise<{ success: boolean; data: Profile[] }> =>
  apiFetch(`${BASE}/api/profiles/compare?users=${usernames.join(',')}`);

export const deleteProfile = (username: string): Promise<{ success: boolean; message: string }> =>
  apiFetch(`${BASE}/api/profiles/${username}`, { method: 'DELETE' });

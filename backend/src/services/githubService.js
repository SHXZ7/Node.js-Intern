import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config({ override: true });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Pre-configured Axios client for GitHub API
const githubClient = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'github-analyzer-api',
    ...(GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {}),
  },
});

/**
 * Parse GitHub API errors into structured error objects
 */
const handleGitHubError = (error) => {
  if (error.response) {
    const { status, headers } = error.response;
    const remaining = headers['x-ratelimit-remaining'];
    const limit = headers['x-ratelimit-limit'];
    const resetTime = headers['x-ratelimit-reset'];

    if (status === 403 || status === 429) {
      const retryAfter = resetTime ? Math.max(0, Math.ceil(Number(resetTime) - Date.now() / 1000)) : 60;
      throw {
        code: 'RATE_LIMITED',
        message: `GitHub API rate limit exceeded (${remaining}/${limit}). Retry after ${retryAfter}s.`,
        retryAfter,
      };
    }
    if (status === 404) throw { code: 'USER_NOT_FOUND', message: 'GitHub user not found' };
  }
  throw error;
};

const checkRateLimitBefore = (headers) => {
  const remaining = headers['x-ratelimit-remaining'];
  const resetTime = headers['x-ratelimit-reset'];
  if (remaining !== undefined && Number(remaining) < 5) {
    const retryAfter = resetTime ? Math.max(0, Math.ceil(Number(resetTime) - Date.now() / 1000)) : 60;
    throw {
      code: 'RATE_LIMITED',
      message: 'GitHub API rate limit almost exhausted. Request blocked to prevent lockouts.',
      retryAfter,
    };
  }
};

/* ------------------------------------------------------------------ */

/**
 * Fetch core GitHub user profile
 */
export const fetchGitHubProfile = async (username) => {
  try {
    const response = await githubClient.get(`/users/${username}`);
    checkRateLimitBefore(response.headers);
    return response.data;
  } catch (error) {
    handleGitHubError(error);
  }
};

/**
 * Fetch user repositories — up to 200 repos (2 pages)
 */
export const fetchUserRepos = async (username) => {
  const repos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 2) {
    try {
      const response = await githubClient.get(`/users/${username}/repos`, {
        params: { per_page: 100, sort: 'pushed', page },
      });
      checkRateLimitBefore(response.headers);
      const data = response.data;
      repos.push(...data);
      hasMore = data.length === 100 && page === 1;
      page++;
    } catch (error) {
      handleGitHubError(error);
    }
  }
  return repos;
};

/**
 * Fetch recent public events — used for activity metrics (last 30 days)
 * Returns gracefully on error (non-critical, rate-limited endpoint)
 */
export const fetchUserEvents = async (username) => {
  try {
    const response = await githubClient.get(`/users/${username}/events/public`, {
      params: { per_page: 100 },
    });
    checkRateLimitBefore(response.headers);
    return response.data;
  } catch {
    // Events API fails gracefully — non-critical data
    return [];
  }
};

/* ------------------------------------------------------------------ */

/**
 * Compute a normalized 0-100 developer score based on multiple weighted signals.
 * Formula weights:
 *   - Impact (stars):         30 pts  — how impactful their code is
 *   - Reach (followers):      25 pts  — community recognition
 *   - Output (original repos): 20 pts  — creative output volume
 *   - Versatility (languages): 15 pts  — breadth of skills
 *   - Recency (events/30d):   10 pts  — still actively contributing
 */
const computeDeveloperScore = ({ total_stars, followers, original_repo_count, language_diversity_index, recent_events_count }) => {
  const clamp = (v, max) => Math.min(v / max, 1);

  const score =
    clamp(total_stars, 10000)  * 30 +
    clamp(followers, 5000)     * 25 +
    clamp(original_repo_count, 100) * 20 +
    clamp(language_diversity_index, 15) * 15 +
    clamp(recent_events_count, 80) * 10;

  return Math.round(score * 10) / 10; // one decimal place
};

/**
 * Determine developer tier based on score
 */
const getDeveloperTier = (score) => {
  if (score >= 85) return 'Legend';
  if (score >= 70) return 'Elite';
  if (score >= 50) return 'Senior';
  if (score >= 30) return 'Rising';
  return 'Newcomer';
};

/* ------------------------------------------------------------------ */

/**
 * Pure function: extract all insights from profile, repos, and events data.
 * No API calls inside — all computation is deterministic and testable.
 */
export const extractInsights = (profileData, reposData, eventsData = []) => {
  if (!profileData) throw new Error('Profile data is required for insight extraction');

  const repos = reposData || [];
  const events = eventsData || [];
  const public_repos = profileData.public_repos || 0;

  // ── Core Aggregates ──────────────────────────────────────────────
  const total_stars    = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const total_forks    = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
  const total_watchers = repos.reduce((s, r) => s + (r.watchers_count || 0), 0);
  const total_open_issues = repos.reduce((s, r) => s + (r.open_issues_count || 0), 0);

  // ── Repo Classification ──────────────────────────────────────────
  const original_repos = repos.filter((r) => !r.fork);
  const forked_repos   = repos.filter((r) => r.fork);
  const original_repo_count = original_repos.length;
  const forked_repo_count   = forked_repos.length;

  const repos_with_description = repos.filter((r) => r.description && r.description.trim().length > 0).length;
  const repos_with_topics      = repos.filter((r) => r.topics && r.topics.length > 0).length;
  const repos_with_description_pct =
    repos.length > 0 ? Math.round((repos_with_description / repos.length) * 100) : 0;

  // ── Language Insights ─────────────────────────────────────────────
  const languages = {};
  repos.forEach((r) => {
    if (r.language) languages[r.language] = (languages[r.language] || 0) + 1;
  });
  const sortedLanguages = Object.entries(languages).sort((a, b) => b[1] - a[1]);
  const top_languages = Object.fromEntries(sortedLanguages);
  const primary_language = sortedLanguages.length > 0 ? sortedLanguages[0][0] : null;
  const language_diversity_index = sortedLanguages.length; // unique languages used

  // ── Topics Extraction ─────────────────────────────────────────────
  const topicCounts = {};
  repos.forEach((r) => {
    (r.topics || []).forEach((t) => {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    });
  });
  const top_topics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);

  // ── License Distribution ──────────────────────────────────────────
  const licenseCounts = {};
  repos.forEach((r) => {
    const lic = r.license?.spdx_id || r.license?.name;
    if (lic && lic !== 'NOASSERTION') licenseCounts[lic] = (licenseCounts[lic] || 0) + 1;
  });
  const most_used_license = Object.entries(licenseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // ── Repository Highlights ─────────────────────────────────────────
  let most_starred_repo = null, maxStars = -1;
  let most_forked_repo  = null, maxForks = -1;

  repos.forEach((r) => {
    if ((r.stargazers_count || 0) > maxStars) { maxStars = r.stargazers_count; most_starred_repo = r.name; }
    if ((r.forks_count || 0) > maxForks)      { maxForks = r.forks_count;     most_forked_repo = r.name; }
  });

  const avg_stars_per_repo = public_repos > 0 ? parseFloat((total_stars / public_repos).toFixed(2)) : 0;

  // ── Open Source Impact Score ──────────────────────────────────────
  // Single metric combining stars + forks + watchers — total people touched by their code
  const open_source_impact = total_stars + total_forks + total_watchers;

  // ── Activity Dates ────────────────────────────────────────────────
  let lastActive = null;
  repos.forEach((r) => {
    if (r.pushed_at) {
      const d = new Date(r.pushed_at);
      if (!lastActive || d > lastActive) lastActive = d;
    }
  });
  const last_active_date = lastActive ? lastActive.toISOString().split('T')[0] : null;

  const createdDate     = new Date(profileData.created_at);
  const account_age_days = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));

  // ── Events / Activity Analysis (last 30 days) ─────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentEvents  = events.filter((e) => e.created_at && new Date(e.created_at) > thirtyDaysAgo);

  const recent_events_count = recentEvents.length;

  // Count by event type
  const eventTypeCounts = {};
  recentEvents.forEach((e) => {
    eventTypeCounts[e.type] = (eventTypeCounts[e.type] || 0) + 1;
  });

  const recent_push_count         = eventTypeCounts['PushEvent'] || 0;
  const recent_pr_count           = eventTypeCounts['PullRequestEvent'] || 0;
  const recent_issue_count        = eventTypeCounts['IssuesEvent'] || 0;
  const recent_review_count       = eventTypeCounts['PullRequestReviewEvent'] || 0;
  const recent_star_given_count   = eventTypeCounts['WatchEvent'] || 0;
  const recent_fork_given_count   = eventTypeCounts['ForkEvent'] || 0;

  // Profile completeness score (0-100): rewards filling in social/contact details
  const completenessFields = [
    profileData.name,
    profileData.bio,
    profileData.location,
    profileData.company,
    profileData.blog,
    profileData.email,
    profileData.twitter_username,
  ];
  const filled = completenessFields.filter((v) => v && String(v).trim().length > 0).length;
  const profile_completeness_score = Math.round((filled / completenessFields.length) * 100);

  // README profile check
  const has_readme_profile = repos.some(
    (r) => r.name && r.name.toLowerCase() === profileData.login.toLowerCase()
  );

  // ── Developer Score ───────────────────────────────────────────────
  const developer_score = computeDeveloperScore({
    total_stars,
    followers: profileData.followers || 0,
    original_repo_count,
    language_diversity_index,
    recent_events_count,
  });
  const developer_tier = getDeveloperTier(developer_score);

  // ── Assemble Final Object ─────────────────────────────────────────
  return {
    // Identity
    username:         profileData.login,
    name:             profileData.name || null,
    bio:              profileData.bio || null,
    location:         profileData.location || null,
    company:          profileData.company || null,
    blog:             profileData.blog || null,
    email:            profileData.email || null,
    twitter_username: profileData.twitter_username || null,
    avatar_url:       profileData.avatar_url || null,
    github_url:       profileData.html_url || null,
    account_type:     profileData.type || 'User',
    hireable:         profileData.hireable ?? null,

    // Core counts
    public_repos,
    public_gists:     profileData.public_gists || 0,
    followers:        profileData.followers || 0,
    following:        profileData.following || 0,

    // Engagement
    total_stars,
    total_forks,
    total_watchers,
    total_open_issues,
    open_source_impact,

    // Language
    top_languages,
    primary_language,
    language_diversity_index,

    // Topics
    top_topics,

    // Activity
    account_age_days,
    last_active_date,
    has_readme_profile,

    // Repo quality signals
    original_repo_count,
    forked_repo_count,
    repos_with_description_pct,
    repos_with_topics,
    most_starred_repo,
    most_forked_repo,
    avg_stars_per_repo,
    most_used_license,

    // Recent activity (30 days)
    recent_events_count,
    recent_push_count,
    recent_pr_count,
    recent_issue_count,
    recent_review_count,
    recent_star_given_count,

    // Computed scores
    profile_completeness_score,
    developer_score,
    developer_tier,
  };
};

// Local test runner
const isMain = process.argv[1] && import.meta.url && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  (async () => {
    try {
      console.log('Testing GitHub Service with username: torvalds...');
      const [profile, repos, events] = await Promise.all([
        fetchGitHubProfile('torvalds'),
        fetchUserRepos('torvalds'),
        fetchUserEvents('torvalds'),
      ]);
      const insights = extractInsights(profile, repos, events);
      console.log(JSON.stringify(insights, null, 2));
    } catch (error) {
      console.error('Test failed:', error);
    }
  })();
}

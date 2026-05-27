import { validationResult } from 'express-validator';
import Profile from '../models/Profile.js';
import AnalysisLog from '../models/AnalysisLog.js';
import { fetchGitHubProfile, fetchUserRepos, fetchUserEvents, extractInsights } from '../services/githubService.js';
import * as cache from '../services/cacheService.js';
import { generateAIAnalysis } from '../services/aiService.js';
import { pool } from '../config/db.js';

const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS) || 3600;

/**
 * Helper: validate express-validator result and throw on failure.
 */
const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw { type: 'validation', errors: errors.array() };
  }
};

/**
 * Helper: write an analysis log entry (fire-and-forget, non-blocking).
 */
const writeLog = (username, { response_ms, cache_hit, status, error_code, ip_address }) => {
  AnalysisLog.create({
    username: username.toLowerCase(),
    response_ms,
    cache_hit,
    status,
    error_code: error_code || null,
    ip_address: ip_address || null,
  }).catch((err) => console.error('[LOG ERROR]', err.message));
};

/* ============================================================
   POST /api/profiles/analyze
   ============================================================ */
export const analyzeProfile = async (req, res, next) => {
  const startTime = Date.now();
  try {
    handleValidationErrors(req);

    const username = req.body.username.toLowerCase().trim();
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const cacheKey = cache.profileKey(username);

    // --- Cache HIT ---
    const cached = cache.get(cacheKey);
    if (cached) {
      const ms = Date.now() - startTime;
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time', `${ms}ms`);
      writeLog(username, { response_ms: ms, cache_hit: true, status: 'success', ip_address: ip });
      return res.status(200).json({ success: true, cached: true, message: 'Profile served from cache', data: cached });
    }

    // --- Cache MISS: fetch from GitHub (profile + repos + events in parallel) ---
    const [profileData, reposData, eventsData] = await Promise.all([
      fetchGitHubProfile(username),
      fetchUserRepos(username),
      fetchUserEvents(username),   // non-critical: returns [] on failure
    ]);

    const insights = extractInsights(profileData, reposData, eventsData);
    // Always store with lowercase username
    insights.username = insights.username.toLowerCase();

    // Generate AI-powered review/insights via Groq
    try {
      insights.ai_analysis = await generateAIAnalysis(insights);
    } catch (aiError) {
      console.error('[AI CONTROLLER ERROR] AI analysis failed:', aiError.message);
    }

    const existing = await Profile.findOne({ username: insights.username });
    const isNew = !existing;

    const profile = await Profile.findOneAndUpdate(
      { username: insights.username },
      insights,
      { upsert: true, new: true }
    );

    // Store in cache
    cache.set(cacheKey, profile.toJSON ? profile.toJSON() : profile, CACHE_TTL);

    const ms = Date.now() - startTime;
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Response-Time', `${ms}ms`);
    writeLog(username, { response_ms: ms, cache_hit: false, status: 'success', ip_address: ip });

    return res.status(isNew ? 201 : 200).json({
      success: true,
      cached: false,
      message: isNew ? 'Profile analyzed and saved successfully' : 'Profile analyzed and updated successfully',
      data: profile,
    });
  } catch (error) {
    const ms = Date.now() - startTime;
    const username = req.body?.username?.toLowerCase() || 'unknown';
    const ip = req.ip || null;
    writeLog(username, {
      response_ms: ms,
      cache_hit: false,
      status: 'error',
      error_code: error.code || 'UNKNOWN',
      ip_address: ip,
    });
    next(error);
  }
};

/* ============================================================
   POST /api/profiles/analyze/batch
   ============================================================ */
export const batchAnalyze = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ success: false, error: 'usernames must be a non-empty array.' });
    }
    if (usernames.length > 10) {
      return res.status(400).json({ success: false, error: 'Maximum 10 usernames per batch request.' });
    }

    const ip = req.ip || null;

    const results = await Promise.allSettled(
      usernames.map(async (rawUsername) => {
        const username = rawUsername.toLowerCase().trim();
        const startTime = Date.now();
        const cacheKey = cache.profileKey(username);

        // Check cache first
        const cached = cache.get(cacheKey);
        if (cached) {
          writeLog(username, { response_ms: Date.now() - startTime, cache_hit: true, status: 'success', ip_address: ip });
          return { username, status: 'success', cached: true, data: cached };
        }

        const [profileData, reposData, eventsData] = await Promise.all([
          fetchGitHubProfile(username),
          fetchUserRepos(username),
          fetchUserEvents(username),
        ]);

        const insights = extractInsights(profileData, reposData, eventsData);
        insights.username = insights.username.toLowerCase();

        // Generate AI-powered review/insights via Groq
        try {
          insights.ai_analysis = await generateAIAnalysis(insights);
        } catch (aiError) {
          console.error(`[AI BATCH ERROR] AI analysis failed for ${username}:`, aiError.message);
        }

        const profile = await Profile.findOneAndUpdate(
          { username: insights.username },
          insights,
          { upsert: true, new: true }
        );

        const profileObj = profile.toJSON ? profile.toJSON() : profile;
        cache.set(cacheKey, profileObj, CACHE_TTL);
        writeLog(username, { response_ms: Date.now() - startTime, cache_hit: false, status: 'success', ip_address: ip });
        return { username, status: 'success', cached: false, data: profileObj };
      })
    );

    const formatted = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const username = usernames[i]?.toLowerCase() || 'unknown';
      const err = r.reason;
      writeLog(username, { response_ms: 0, cache_hit: false, status: 'error', error_code: err?.code || 'UNKNOWN', ip_address: ip });
      return { username, status: 'error', error: err?.message || 'Unknown error', code: err?.code || 'UNKNOWN' };
    });

    return res.status(200).json({ success: true, results: formatted });
  } catch (error) {
    next(error);
  }
};

/* ============================================================
   GET /api/profiles  (with language, min_stars, search filters)
   ============================================================ */
export const getAllProfiles = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const sort = req.query.sort || 'analyzed_at';
    const order = req.query.order || 'desc';

    const sortMap = {
      followers: 'followers',
      total_stars: 'total_stars',
      stars: 'total_stars',
      public_repos: 'public_repos',
      repos: 'public_repos',
      analyzed_at: 'analyzed_at',
    };
    const sortBy = sortMap[sort] || 'analyzed_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 1 : -1;

    // Build filter query
    const filter = {};

    if (req.query.language) {
      filter.primary_language = { $regex: new RegExp(`^${req.query.language}$`, 'i') };
    }

    if (req.query.min_stars) {
      const minStars = parseInt(req.query.min_stars);
      if (!isNaN(minStars)) filter.total_stars = { $gte: minStars };
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [{ username: searchRegex }, { name: searchRegex }];
    }

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      Profile.countDocuments(filter),
      Profile.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit),
    ]);

    return res.status(200).json({ success: true, total, page, limit, data });
  } catch (error) {
    next(error);
  }
};

/* ============================================================
   GET /api/profiles/:username
   ============================================================ */
export const getProfile = async (req, res, next) => {
  try {
    handleValidationErrors(req);
    const username = req.params.username.toLowerCase();
    const profile = await Profile.findOne({ username });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: `Profile for '${username}' has not been analyzed yet. POST /api/profiles/analyze first.`,
      });
    }
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ============================================================
   DELETE /api/profiles/:username
   ============================================================ */
export const deleteProfile = async (req, res, next) => {
  try {
    handleValidationErrors(req);
    const username = req.params.username.toLowerCase();

    const result = await Profile.findOneAndDelete({ username });
    if (!result) {
      return res.status(404).json({ success: false, error: 'Profile not found or already deleted.' });
    }

    // Evict from cache
    cache.del(cache.profileKey(username));

    return res.status(200).json({ success: true, message: 'Profile deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

/* ============================================================
   GET /api/profiles/compare
   ============================================================ */
export const compareProfiles = async (req, res, next) => {
  try {
    handleValidationErrors(req);
    const { users } = req.query;

    if (!users) {
      return res.status(400).json({ success: false, error: "Query param 'users' required. Example: ?users=torvalds,octocat" });
    }

    const userList = users.split(',').map((u) => u.trim().toLowerCase()).filter(Boolean);

    if (userList.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide at least one valid username.' });
    }

    const profiles = await Profile.find({ username: { $in: userList } });
    return res.status(200).json({ success: true, data: profiles });
  } catch (error) {
    next(error);
  }
};

/* ============================================================
   GET /api/stats
   ============================================================ */
export const getStats = async (req, res, next) => {
  try {
    const [
      [aggregatesRows],
      [topByStarsRows],
      [languageDistRows]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total_profiles, AVG(followers) as avg_followers, AVG(total_stars) as avg_stars, AVG(public_repos) as avg_repos FROM github_profiles'),
      pool.query('SELECT username, name, avatar_url, total_stars, followers, primary_language FROM github_profiles ORDER BY total_stars DESC LIMIT 5'),
      pool.query('SELECT primary_language as _id, COUNT(*) as count FROM github_profiles WHERE primary_language IS NOT NULL GROUP BY primary_language ORDER BY count DESC LIMIT 15')
    ]);

    const agg = aggregatesRows[0] || {};
    const languageMap = {};
    languageDistRows.forEach((l) => { languageMap[l._id] = l.count; });

    // Format topByStars to include mock .toJSON helper to maintain backwards compatibility
    const top_profiles_by_stars = topByStarsRows.map(p => ({
      ...p,
      toJSON() { return this; }
    }));

    return res.status(200).json({
      success: true,
      data: {
        total_profiles: Number(agg.total_profiles) || 0,
        most_common_language: languageDistRows[0]?._id || null,
        avg_followers: Math.round(Number(agg.avg_followers) || 0),
        avg_stars: Math.round(Number(agg.avg_stars) || 0),
        avg_repos: Math.round(Number(agg.avg_repos) || 0),
        top_profiles_by_stars,
        language_distribution: languageMap,
      },
    });
  } catch (error) {
    next(error);
  }
};

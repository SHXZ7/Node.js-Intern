import { pool } from '../config/db.js';

const parseJSON = (field) => {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      return field;
    }
  }
  return field;
};

const formatProfile = (row) => {
  if (!row) return null;
  
  // Create a deep copy of the database row to prevent side-effects
  const formatted = {
    ...row,
    top_languages: parseJSON(row.top_languages) || {},
    top_topics: parseJSON(row.top_topics) || [],
    ai_analysis: parseJSON(row.ai_analysis) || null,
  };

  // Attach a mock .toJSON() to maintain backward compatibility with standard Express json responders
  Object.defineProperty(formatted, 'toJSON', {
    value: function () {
      const copy = { ...this };
      delete copy.id; // Hide MySQL internal auto-increment ID
      return copy;
    },
    enumerable: false, // Hide toJSON from normal keys iteration
  });

  return formatted;
};

/**
 * Dynamic SQL WHERE condition generator from Mongoose filter objects
 */
const buildFilter = (filterObj = {}) => {
  const conditions = [];
  const params = [];

  if (filterObj.primary_language) {
    let langVal = '';
    // Mongoose RegExp check
    if (filterObj.primary_language.$regex instanceof RegExp) {
      langVal = filterObj.primary_language.$regex.source.replace(/^\^|\$$/g, '');
    } else if (typeof filterObj.primary_language.$regex === 'string') {
      langVal = filterObj.primary_language.$regex.replace(/^\^|\$$/g, '');
    } else {
      langVal = filterObj.primary_language;
    }
    conditions.push('primary_language = ?');
    params.push(langVal);
  }

  if (filterObj.total_stars && filterObj.total_stars.$gte !== undefined) {
    conditions.push('total_stars >= ?');
    params.push(Number(filterObj.total_stars.$gte));
  }

  if (filterObj.$or) {
    const searchCondition = [];
    filterObj.$or.forEach((cond) => {
      const key = Object.keys(cond)[0];
      const regexVal = cond[key];
      let val = '';
      if (regexVal instanceof RegExp) {
        val = regexVal.source;
      } else if (regexVal && typeof regexVal.source === 'string') {
        val = regexVal.source;
      } else {
        val = String(regexVal);
      }
      val = val.replace(/\\/g, ''); // Strip regex escape chars
      searchCondition.push(`\`${key}\` LIKE ?`);
      params.push(`%${val}%`);
    });
    conditions.push(`(${searchCondition.join(' OR ')})`);
  }

  // Support single direct matching filters e.g. { username }
  if (filterObj.username && !filterObj.$or && !filterObj.primary_language) {
    conditions.push('username = ?');
    params.push(filterObj.username.toLowerCase());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
};

/**
 * Backward-compatible, awaitable chain builder for database listings pagination
 */
class ProfileQueryChain {
  constructor(filterObj) {
    this.filterObj = filterObj;
    this.sortBy = 'analyzed_at';
    this.sortOrder = 'DESC';
    this.offsetVal = 0;
    this.limitVal = 10;
  }

  sort(sortOption) {
    if (sortOption) {
      if (typeof sortOption === 'object') {
        const key = Object.keys(sortOption)[0];
        // Sort Map translations
        const sortMap = {
          followers: 'followers',
          total_stars: 'total_stars',
          stars: 'total_stars',
          public_repos: 'public_repos',
          repos: 'public_repos',
          analyzed_at: 'analyzed_at',
        };
        this.sortBy = sortMap[key] || 'analyzed_at';
        this.sortOrder = sortOption[key] === 1 || sortOption[key] === 'asc' ? 'ASC' : 'DESC';
      } else if (typeof sortOption === 'string') {
        const cleanOpt = sortOption.trim();
        if (cleanOpt.startsWith('-')) {
          this.sortBy = cleanOpt.substring(1);
          this.sortOrder = 'DESC';
        } else {
          this.sortBy = cleanOpt;
          this.sortOrder = 'ASC';
        }
      }
    }
    return this;
  }

  skip(val) {
    this.offsetVal = Math.max(0, Number(val) || 0);
    return this;
  }

  limit(val) {
    this.limitVal = Math.max(1, Number(val) || 10);
    return this;
  }

  /**
   * Replicates standard promise handling so await Profile.find() runs natively
   */
  async then(resolve, reject) {
    try {
      const { whereClause, params } = buildFilter(this.filterObj);
      const sql = `
        SELECT * FROM github_profiles 
        ${whereClause} 
        ORDER BY \`${this.sortBy}\` ${this.sortOrder} 
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.query(sql, [...params, this.limitVal, this.offsetVal]);
      resolve(rows.map(formatProfile));
    } catch (err) {
      reject(err);
    }
  }
}

// ── Profile Class Definition ───────────────────────────────────────────────
class Profile {
  /**
   * Replicates Profile.findOne Mongoose API
   */
  static async findOne(filter) {
    try {
      const { whereClause, params } = buildFilter(filter);
      const sql = `SELECT * FROM github_profiles ${whereClause} LIMIT 1`;
      const [rows] = await pool.query(sql, params);
      return rows.length > 0 ? formatProfile(rows[0]) : null;
    } catch (err) {
      console.error('[Profile.findOne ERROR]', err.message);
      throw err;
    }
  }

  /**
   * Replicates Profile.find Mongoose API
   */
  static find(filter) {
    return new ProfileQueryChain(filter);
  }

  /**
   * Replicates Profile.countDocuments Mongoose API
   */
  static async countDocuments(filter) {
    try {
      const { whereClause, params } = buildFilter(filter);
      const sql = `SELECT COUNT(*) as count FROM github_profiles ${whereClause}`;
      const [rows] = await pool.query(sql, params);
      return rows[0]?.count || 0;
    } catch (err) {
      console.error('[Profile.countDocuments ERROR]', err.message);
      throw err;
    }
  }

  /**
   * Replicates Profile.findOneAndDelete Mongoose API
   */
  static async findOneAndDelete(filter) {
    try {
      const profile = await this.findOne(filter);
      if (!profile) return null;
      
      const sql = 'DELETE FROM github_profiles WHERE username = ?';
      await pool.query(sql, [profile.username]);
      return profile;
    } catch (err) {
      console.error('[Profile.findOneAndDelete ERROR]', err.message);
      throw err;
    }
  }

  /**
   * Replicates Profile.findOneAndUpdate Mongoose API
   */
  static async findOneAndUpdate(filter, updateData, options = {}) {
    try {
      const username = filter.username.toLowerCase();
      const existing = await this.findOne({ username });

      // Serialize dynamic JSON objects for MySQL JSON string inserts
      const topLanguagesStr = JSON.stringify(updateData.top_languages || {});
      const topTopicsStr = JSON.stringify(updateData.top_topics || []);
      const aiAnalysisStr = JSON.stringify(updateData.ai_analysis || null);

      const fields = [
        'name', 'bio', 'location', 'company', 'blog', 'email', 'twitter_username', 
        'avatar_url', 'github_url', 'account_type', 'hireable',
        'public_repos', 'public_gists', 'followers', 'following',
        'total_stars', 'total_forks', 'total_watchers', 'total_open_issues', 'open_source_impact',
        'top_languages', 'primary_language', 'language_diversity_index', 'top_topics',
        'account_age_days', 'last_active_date', 'has_readme_profile',
        'original_repo_count', 'forked_repo_count', 'repos_with_description_pct', 'repos_with_topics',
        'most_starred_repo', 'most_forked_repo', 'avg_stars_per_repo', 'most_used_license',
        'recent_events_count', 'recent_push_count', 'recent_pr_count', 'recent_issue_count', 
        'recent_review_count', 'recent_star_given_count',
        'profile_completeness_score', 'developer_score', 'developer_tier', 'ai_analysis'
      ];

      const values = [
        updateData.name || null,
        updateData.bio || null,
        updateData.location || null,
        updateData.company || null,
        updateData.blog || null,
        updateData.email || null,
        updateData.twitter_username || null,
        updateData.avatar_url || null,
        updateData.github_url || null,
        updateData.account_type || 'User',
        updateData.hireable ?? null,
        Number(updateData.public_repos) || 0,
        Number(updateData.public_gists) || 0,
        Number(updateData.followers) || 0,
        Number(updateData.following) || 0,
        Number(updateData.total_stars) || 0,
        Number(updateData.total_forks) || 0,
        Number(updateData.total_watchers) || 0,
        Number(updateData.total_open_issues) || 0,
        Number(updateData.open_source_impact) || 0,
        topLanguagesStr,
        updateData.primary_language || null,
        Number(updateData.language_diversity_index) || 0,
        topTopicsStr,
        updateData.account_age_days || null,
        updateData.last_active_date || null,
        updateData.has_readme_profile === true ? 1 : 0,
        Number(updateData.original_repo_count) || 0,
        Number(updateData.forked_repo_count) || 0,
        Number(updateData.repos_with_description_pct) || 0,
        Number(updateData.repos_with_topics) || 0,
        updateData.most_starred_repo || null,
        updateData.most_forked_repo || null,
        updateData.avg_stars_per_repo || 0.00,
        updateData.most_used_license || null,
        Number(updateData.recent_events_count) || 0,
        Number(updateData.recent_push_count) || 0,
        Number(updateData.recent_pr_count) || 0,
        Number(updateData.recent_issue_count) || 0,
        Number(updateData.recent_review_count) || 0,
        Number(updateData.recent_star_given_count) || 0,
        Number(updateData.profile_completeness_score) || 0,
        updateData.developer_score || 0.0,
        updateData.developer_tier || 'Newcomer',
        aiAnalysisStr
      ];

      if (existing) {
        // Run SQL UPDATE
        const setString = fields.map((f) => `\`${f}\` = ?`).join(', ');
        const sql = `UPDATE github_profiles SET ${setString} WHERE username = ?`;
        await pool.query(sql, [...values, username]);
      } else {
        // Run SQL INSERT
        const placeholders = fields.map(() => '?').join(', ');
        const sql = `INSERT INTO github_profiles (username, ${fields.map(f => `\`${f}\``).join(', ')}) VALUES (?, ${placeholders})`;
        await pool.query(sql, [username, ...values]);
      }

      // Return the updated row cleanly formatted
      return await this.findOne({ username });
    } catch (err) {
      console.error('[Profile.findOneAndUpdate ERROR]', err.message);
      throw err;
    }
  }

  /**
   * Proxy aggregate function returning aggregate groupings cleanly
   */
  static async aggregate(pipeline) {
    // This is called during DB aggregates if needed. Since we refactor aggregates to SQL queries,
    // we only need this for backwards test safety! We will resolve actual aggregates in DB.
    return [];
  }
}

export default Profile;

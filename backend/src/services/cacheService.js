/**
 * In-memory TTL Cache Service
 * No Redis required — lightweight Map-based cache with expiry.
 * Key format: profile:{username} (always lowercase)
 */

const cache = new Map(); // Map<key, { value, expiresAt }>

/**
 * Get a cached value. Returns null if missing or expired.
 */
export const get = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

/**
 * Set a cache entry with a TTL in seconds.
 */
export const set = (key, value, ttlSeconds) => {
  const ttl = (Number(ttlSeconds) || 3600) * 1000;
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
};

/**
 * Delete a specific cache entry (e.g. on profile delete).
 */
export const del = (key) => {
  cache.delete(key);
};

/**
 * Return count of live (non-expired) entries.
 */
export const size = () => {
  const now = Date.now();
  let count = 0;
  for (const entry of cache.values()) {
    if (now <= entry.expiresAt) count++;
  }
  return count;
};

/**
 * Clear entire cache.
 */
export const flush = () => {
  cache.clear();
};

/**
 * Build cache key for a profile.
 */
export const profileKey = (username) => `profile:${username.toLowerCase()}`;

/**
 * Global Express error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  // 1. GitHub User Not Found
  if (err.code === 'USER_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      error: err.message || 'GitHub user not found',
    });
  }

  // 2. GitHub Rate Limited
  if (err.code === 'RATE_LIMITED') {
    if (err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter);
    }
    return res.status(429).json({
      success: false,
      error: err.message || 'GitHub rate limit exceeded',
      retryAfter: err.retryAfter || 60,
    });
  }

  // 3. Validation Errors (express-validator)
  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: err.errors || [],
    });
  }

  // 4. Default Internal Server Error (Generic to prevent leaking internal traces)
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(isDev ? { details: err.message } : {}),
  });
};

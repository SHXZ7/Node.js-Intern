import rateLimit from 'express-rate-limit';

/**
 * Global API rate limiter — applied to all routes.
 * 100 requests per 15 minutes per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again in 15 minutes.',
  },
});

/**
 * Strict limiter for analyze endpoints.
 * 10 requests per 1 minute per IP.
 */
export const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Analyze rate limit exceeded. Maximum 10 analyses per minute per IP.',
  },
});

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as ctrl from '../controllers/profileController.js';
import { analyzeLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── Validation rules ─────────────────────────────────────────

const validateUsername = body('username')
  .trim()
  .notEmpty().withMessage('Username is required')
  .matches(/^[a-zA-Z0-9-]{1,39}$/).withMessage('Username must be 1–39 alphanumeric/hyphen characters');

const validateBatch = body('usernames')
  .isArray({ min: 1, max: 10 }).withMessage('usernames must be an array of 1–10 items')
  .custom((arr) => arr.every((u) => /^[a-zA-Z0-9-]{1,39}$/.test(u)))
  .withMessage('Each username must be 1–39 alphanumeric/hyphen characters');

const validateListQuery = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(['followers', 'total_stars', 'stars', 'public_repos', 'repos', 'analyzed_at']),
  query('order').optional().isIn(['asc', 'desc', 'ASC', 'DESC']),
  query('language').optional().trim(),
  query('min_stars').optional().isInt({ min: 0 }).toInt(),
  query('search').optional().trim().isLength({ max: 100 }),
];

const validateUsernameParam = param('username')
  .trim()
  .matches(/^[a-zA-Z0-9-]{1,39}$/).withMessage('Invalid username parameter');

const validateCompareQuery = query('users').trim().notEmpty()
  .withMessage("Query param 'users' is required. Example: ?users=torvalds,octocat");

// ── Routes ────────────────────────────────────────────────────

/**
 * @swagger
 * /api/profiles/analyze:
 *   post:
 *     summary: Analyze a GitHub profile and store insights
 *     tags: [Profiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username:
 *                 type: string
 *                 example: octocat
 *     responses:
 *       201:
 *         description: Profile analyzed and saved
 *       200:
 *         description: Profile updated (re-analyzed)
 *       400:
 *         description: Validation error
 *       404:
 *         description: GitHub user not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/analyze', analyzeLimiter, [validateUsername], ctrl.analyzeProfile);

/**
 * @swagger
 * /api/profiles/analyze/batch:
 *   post:
 *     summary: Batch analyze multiple GitHub profiles
 *     tags: [Profiles]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [usernames]
 *             properties:
 *               usernames:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["torvalds", "octocat"]
 *     responses:
 *       200:
 *         description: Batch results (mix of success/error per username)
 */
router.post('/analyze/batch', analyzeLimiter, [validateBatch], ctrl.batchAnalyze);

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: List all analyzed profiles with pagination and filters
 *     tags: [Profiles]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [followers, total_stars, public_repos, analyzed_at] }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc] }
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *         description: Filter by primary language (e.g. Python)
 *       - in: query
 *         name: min_stars
 *         schema: { type: integer }
 *         description: Filter by minimum total stars
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Partial match on username or name
 *     responses:
 *       200:
 *         description: Paginated list of profiles
 */
router.get('/', validateListQuery, ctrl.getAllProfiles);

/**
 * @swagger
 * /api/profiles/compare:
 *   get:
 *     summary: Compare multiple profiles side by side
 *     tags: [Profiles]
 *     parameters:
 *       - in: query
 *         name: users
 *         required: true
 *         schema:
 *           type: string
 *         description: "Comma-separated usernames, e.g. torvalds,octocat"
 *     responses:
 *       200:
 *         description: Array of matching profiles
 */
// CRITICAL: /compare must be before /:username
router.get('/compare', [validateCompareQuery], ctrl.compareProfiles);

/**
 * @swagger
 * /api/profiles/{username}:
 *   get:
 *     summary: Get a single stored profile
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Profile data
 *       404:
 *         description: Profile not found
 */
router.get('/:username', [validateUsernameParam], ctrl.getProfile);

/**
 * @swagger
 * /api/profiles/{username}:
 *   delete:
 *     summary: Delete a stored profile
 *     tags: [Profiles]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Profile not found
 */
router.delete('/:username', [validateUsernameParam], ctrl.deleteProfile);

export default router;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

dotenv.config();

import profileRoutes from './routes/profileRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { testConnection } from './config/db.js';
import { getStats } from './controllers/profileController.js';
import * as cache from './services/cacheService.js';
import { pool } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Security ─────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://avatars.githubusercontent.com", "https://github.githubassets.com"],
        connectSrc: ["'self'", "http://localhost:3000", "http://localhost:3001"],
      },
    },
  })
);

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('dev'));
app.use(express.json());

// ── Global Rate Limiter ───────────────────────────────────────
app.use(apiLimiter);

// ── Swagger / OpenAPI Docs ────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GitScope — GitHub Profile Analyzer API',
      version: '2.0.0',
      description:
        'A production-grade REST API that fetches, analyzes, and stores GitHub user profile insights. Backed by MongoDB Atlas with in-memory caching.',
      contact: { name: 'GitScope API' },
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local development server' }],
    tags: [
      { name: 'Profiles', description: 'GitHub profile analysis and management' },
      { name: 'Stats', description: 'Platform-wide aggregate statistics' },
      { name: 'Health', description: 'Server and database health checks' },
    ],
  },
  apis: ['./src/routes/*.js'],
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { background: #0a0a0a; border-bottom: 1px solid #222; }
    .swagger-ui .info .title { color: #f59e0b; }
    body { background: #111; }
  `,
  customSiteTitle: 'GitScope API Docs',
}));

// Serve raw OpenAPI JSON
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Health Check ─────────────────────────────────────────────

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Server and database health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const connection = await pool.getConnection();
    connection.release();
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'disconnected';
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: dbStatus,
    cache_size: cache.size(),
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/profiles', profileRoutes);

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Aggregate platform-wide statistics
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Platform stats including language distribution and top profiles
 */
app.get('/api/stats', getStats);

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Server Bootstrap ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  // Boot HTTP listener immediately to prevent nodemon crash-loops
  app.listen(PORT, () => {
    console.log(`[SERVER] Server running on port ${PORT}`);
    console.log(`[DOCS]   Swagger UI → http://localhost:${PORT}/api/docs`);
  });

  // Asynchronously test and bootstrap the database tables
  testConnection()
    .then(() => {
      console.log('[DATABASE] MySQL connection established and schema verified.');
    })
    .catch((err) => {
      console.warn('[DATABASE WARNING] MySQL database is unreachable. Server is listening, but database operations will fail until connection parameters are correct.');
    });
}

export default app;

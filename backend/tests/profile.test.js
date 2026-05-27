import request from 'supertest';
import { jest } from '@jest/globals';

// Mock DB config
jest.unstable_mockModule('../src/config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue({}),
  testConnection: jest.fn().mockResolvedValue(true),
  pool: {
    query: jest.fn().mockResolvedValue([[], []]),
    getConnection: jest.fn().mockResolvedValue({
      release: jest.fn(),
    }),
  },
}));

// Mock cache service (disable caching in tests so all requests hit the mock controller)
jest.unstable_mockModule('../src/services/cacheService.js', () => ({
  get: jest.fn().mockReturnValue(null),      // Always cache MISS
  set: jest.fn(),
  del: jest.fn(),
  size: jest.fn().mockReturnValue(0),
  flush: jest.fn(),
  profileKey: jest.fn((u) => `profile:${u.toLowerCase()}`),
}));

// Mock AnalysisLog model (no real DB writes in tests)
jest.unstable_mockModule('../src/models/AnalysisLog.js', () => ({
  default: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

// Mock Profile model
const mockProfileData = {
  username: 'octocat',
  name: 'The Octocat',
  bio: 'Testing bio',
  public_repos: 8,
  followers: 22768,
  total_stars: 21433,
  primary_language: 'HTML',
  analyzed_at: new Date().toISOString(),
  toJSON: () => mockProfileData,
};

const mockQuery = {
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([mockProfileData]),
};

jest.unstable_mockModule('../src/models/Profile.js', () => {
  const mockModel = jest.fn();
  // Controller now uses lowercase string directly (no regex), so match on string equality
  mockModel.findOne = jest.fn().mockImplementation((filter) => {
    const uname = filter?.username;
    if (uname === 'octocat') return Promise.resolve(mockProfileData);
    return Promise.resolve(null);
  });
  mockModel.findOneAndUpdate = jest.fn().mockResolvedValue(mockProfileData);
  mockModel.countDocuments = jest.fn().mockResolvedValue(1);
  mockModel.find = jest.fn().mockReturnValue(mockQuery);
  mockModel.findOneAndDelete = jest.fn().mockImplementation((filter) => {
    const uname = filter?.username;
    if (uname === 'octocat') return Promise.resolve(mockProfileData);
    return Promise.resolve(null);
  });
  mockModel.aggregate = jest.fn().mockResolvedValue([]);
  return { default: mockModel };
});

// Mock GitHub service
jest.unstable_mockModule('../src/services/githubService.js', () => ({
  fetchGitHubProfile: jest.fn().mockImplementation((username) => {
    if (username === 'octocat') {
      return Promise.resolve({
        login: 'octocat', name: 'The Octocat', bio: 'Testing bio',
        public_repos: 8, public_gists: 8, followers: 22768, following: 9,
        type: 'User', created_at: '2011-01-25T18:44:36Z',
      });
    }
    throw { code: 'USER_NOT_FOUND', message: 'GitHub user not found' };
  }),
  fetchUserRepos: jest.fn().mockImplementation((username) => {
    if (username === 'octocat') {
      return Promise.resolve([{
        name: 'Spoon-Knife', stargazers_count: 21433, forks_count: 164865,
        watchers_count: 21433, language: 'HTML', pushed_at: '2024-08-21T00:00:00Z',
      }]);
    }
    return Promise.resolve([]);
  }),
  fetchUserEvents: jest.fn().mockImplementation(() => Promise.resolve([])),
  extractInsights: jest.fn().mockReturnValue({ ...mockProfileData }),
}));

// Import app after all mocks are set up
const { default: app } = await import('../src/app.js');

describe('GitHub Profile Analyzer API Integration Tests', () => {
  beforeEach(() => jest.clearAllMocks());

  // 1. GET /health → 200
  test('GET /health → 200 ok with db and cache_size fields', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('cache_size');
  });

  // 2. POST /api/profiles/analyze with valid username → 201 (new profile, findOne returns null)
  test('POST /api/profiles/analyze with valid username → 201 success', async () => {
    const res = await request(app)
      .post('/api/profiles/analyze')
      .send({ username: 'octocat' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('cached', false);
    expect(res.body.data).toHaveProperty('username', 'octocat');
    expect(res.headers['x-cache']).toBe('MISS');
  });

  // 3. GET /api/profiles → 200 with data array
  test('GET /api/profiles → 200 with data array', async () => {
    const res = await request(app).get('/api/profiles');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // 4. GET /api/profiles/octocat → 200 with correct username
  test('GET /api/profiles/octocat → 200 with correct username', async () => {
    const res = await request(app).get('/api/profiles/octocat');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('username', 'octocat');
  });

  // 5. POST /api/profiles/analyze with empty username → 400
  test('POST /api/profiles/analyze with empty username → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/profiles/analyze')
      .send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty('error', 'Validation failed');
  });

  // 6. GET /api/profiles/non-existent → 404
  test('GET /api/profiles/non-existent-user → 404 profile not found', async () => {
    const res = await request(app).get('/api/profiles/this-user-does-not-exist-xyz1');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('has not been analyzed yet');
  });
});

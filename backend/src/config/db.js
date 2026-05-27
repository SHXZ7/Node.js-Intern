import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const {
  DB_HOST = 'localhost',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'github_analyzer',
  DB_PORT = 3306,
} = process.env;

// Connection pool configured with modern MySQL defaults
export const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
});

/**
 * Migration helper to verify/create database structures on startup
 */
const runMigrations = async (connection) => {
  try {
    // 1. github_profiles table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS github_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255),
        bio TEXT,
        location VARCHAR(255),
        company VARCHAR(255),
        blog VARCHAR(500),
        email VARCHAR(255),
        twitter_username VARCHAR(100),
        avatar_url VARCHAR(500),
        github_url VARCHAR(500),
        account_type VARCHAR(50) DEFAULT 'User',
        hireable BOOLEAN DEFAULT NULL,
        
        -- Core counts
        public_repos INT DEFAULT 0,
        public_gists INT DEFAULT 0,
        followers INT DEFAULT 0,
        following INT DEFAULT 0,
        
        -- Engagement
        total_stars INT DEFAULT 0,
        total_forks INT DEFAULT 0,
        total_watchers INT DEFAULT 0,
        total_open_issues INT DEFAULT 0,
        open_source_impact INT DEFAULT 0,
        
        -- Language
        top_languages JSON,
        primary_language VARCHAR(100),
        language_diversity_index INT DEFAULT 0,
        
        -- Topics
        top_topics JSON,
        
        -- Activity
        account_age_days INT,
        last_active_date DATE,
        has_readme_profile BOOLEAN DEFAULT FALSE,
        
        -- Repo insights
        original_repo_count INT DEFAULT 0,
        forked_repo_count INT DEFAULT 0,
        repos_with_description_pct INT DEFAULT 0,
        repos_with_topics INT DEFAULT 0,
        most_starred_repo VARCHAR(255),
        most_forked_repo VARCHAR(255),
        avg_stars_per_repo DECIMAL(10,2) DEFAULT 0.00,
        most_used_license VARCHAR(100),
        
        -- Recent activity (30d)
        recent_events_count INT DEFAULT 0,
        recent_push_count INT DEFAULT 0,
        recent_pr_count INT DEFAULT 0,
        recent_issue_count INT DEFAULT 0,
        recent_review_count INT DEFAULT 0,
        recent_star_given_count INT DEFAULT 0,
        
        -- Computed scores
        profile_completeness_score INT DEFAULT 0,
        developer_score DECIMAL(10,1) DEFAULT 0.0,
        developer_tier VARCHAR(50) DEFAULT 'Newcomer',
        
        -- AI review (Groq)
        ai_analysis JSON,
        
        -- Timestamps
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_username (username),
        INDEX idx_analyzed_at (analyzed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. analysis_logs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS analysis_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_ms INT,
        cache_hit BOOLEAN,
        status VARCHAR(50),
        error_code VARCHAR(50),
        ip_address VARCHAR(100),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('[DATABASE] MySQL Schema migration check verified.');
  } catch (err) {
    console.error('[DATABASE] Schema migration failed:', err.message);
    throw err;
  }
};

/**
 * Connect helper - tests and ensures the DB is bootstrapped
 */
export const connectDB = async () => {
  try {
    // 1. Establish initial check without DB string to auto-create the DB if not exists
    const tempConnection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: Number(DB_PORT),
    });

    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await tempConnection.end();

    // 2. Now run against our active pool
    const connection = await pool.getConnection();
    console.log(`[DATABASE] Connected to MySQL host: ${DB_HOST}, database: ${DB_NAME}`);
    
    // 3. Auto-bootstrap tables
    await runMigrations(connection);
    
    connection.release();
  } catch (error) {
    console.error(`[DATABASE ERROR] Connection failed: ${error.message}`);
    throw error;
  }
};

/**
 * Test Connection helper to ensure db is reachable on startup.
 */
export const testConnection = async () => {
  try {
    await connectDB();
    return true;
  } catch (error) {
    console.error('[DATABASE ERROR] testConnection failed.');
    throw error;
  }
};

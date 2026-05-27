-- =========================================================================
-- GITSCOPE — DATABASE SCHEMA EXPORT (MYSQL)
-- Assignment Submission - Node.js Intern
-- =========================================================================

CREATE DATABASE IF NOT EXISTS github_analyzer;
USE github_analyzer;

-- 1. GitHub Profiles Table
CREATE TABLE IF NOT EXISTS github_profiles (
  id                         INT AUTO_INCREMENT PRIMARY KEY,
  username                   VARCHAR(100) NOT NULL UNIQUE,
  name                       VARCHAR(255),
  bio                        TEXT,
  location                   VARCHAR(255),
  company                    VARCHAR(255),
  blog                       VARCHAR(500),
  email                      VARCHAR(255),
  twitter_username           VARCHAR(100),
  avatar_url                 VARCHAR(500),
  github_url                 VARCHAR(500),
  account_type               VARCHAR(50) DEFAULT 'User',
  hireable                   BOOLEAN DEFAULT NULL,
  
  -- Core Insight Metrics
  public_repos               INT DEFAULT 0,
  public_gists               INT DEFAULT 0,
  followers                  INT DEFAULT 0,
  following                  INT DEFAULT 0,
  
  -- Engagement Metrics
  total_stars                INT DEFAULT 0,
  total_forks                INT DEFAULT 0,
  total_watchers             INT DEFAULT 0,
  total_open_issues          INT DEFAULT 0,
  open_source_impact         INT DEFAULT 0,
  
  -- Language Insights
  top_languages              JSON,                 -- Maps languages to repository counts
  primary_language           VARCHAR(100),         -- Most used language
  language_diversity_index   INT DEFAULT 0,        -- Count of distinct languages used
  
  -- Topic Insights
  top_topics                 JSON,                 -- Array of frequent repository topics
  
  -- Activity Insights
  account_age_days           INT,                  -- Total days since creation
  last_active_date           DATE,                 -- Most recent repo push date
  has_readme_profile         BOOLEAN DEFAULT FALSE,-- True if user README exists
  
  -- Repository Specific Insights
  original_repo_count        INT DEFAULT 0,
  forked_repo_count          INT DEFAULT 0,
  repos_with_description_pct INT DEFAULT 0,
  repos_with_topics          INT DEFAULT 0,
  most_starred_repo          VARCHAR(255),
  most_forked_repo           VARCHAR(255),
  avg_stars_per_repo         DECIMAL(10,2) DEFAULT 0.00,
  most_used_license          VARCHAR(100),
  
  -- Recent Activity Timeline (Last 30 Days)
  recent_events_count        INT DEFAULT 0,
  recent_push_count          INT DEFAULT 0,
  recent_pr_count            INT DEFAULT 0,
  recent_issue_count         INT DEFAULT 0,
  recent_review_count        INT DEFAULT 0,
  recent_star_given_count    INT DEFAULT 0,
  
  -- Computed Analytical Scores
  profile_completeness_score INT DEFAULT 0,
  developer_score            DECIMAL(10,1) DEFAULT 0.0,
  developer_tier             VARCHAR(50) DEFAULT 'Newcomer',
  
  -- AI-Powered Insights (Groq Llama3 Assessment)
  ai_analysis                JSON,                 -- Structured assessment metrics
  
  -- Timestamps
  analyzed_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_username (username),
  INDEX idx_analyzed_at (analyzed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. Analysis Logs (Observability & Cache Auditing)
CREATE TABLE IF NOT EXISTS analysis_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(100) NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_ms  INT,
  cache_hit    BOOLEAN,
  status       VARCHAR(50),
  error_code   VARCHAR(50),
  ip_address   VARCHAR(100),
  
  INDEX idx_username (username),
  INDEX idx_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

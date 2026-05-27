# GitScope — GitHub Profile Analyzer API & Dashboard

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0%2B-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Groq AI](https://img.shields.io/badge/Groq%20AI-Llama3.3-orange)](https://groq.com/)
[![Jest Testing](https://img.shields.io/badge/Jest-Passed-C21325?logo=jest&logoColor=white)](https://jestjs.io/)

**GitScope** is a production-grade web application consisting of a Node.js/Express REST API backed by a **MySQL** database, a live **Groq AI Llama 3.3** developer report analyzer, and a premium **Next.js 16 App Router** visual client dashboard. It fetches, stores, aggregates, and compares public GitHub user profiles, delivering statistical scoring, language meters, push activity graphs, and detailed AI feedback.

---

## Submission Assets Checklist

All required files for your intern assignment are fully pre-configured and included in this repository:
1.  **Comprehensive Documentation**: You are reading this **`README.md`** which contains complete setup instructions for both local development and cloud deployment.
2.  **Database Schema Export**: Located in **`sql/schema.sql`** containing up-to-date table creation SQL scripts for both the profiles and logs tables.
3.  **Postman Collection**: Located in the root file **`github_analyzer.postman_collection.json`** for testing the API routes.
4.  **Complete Source Directories**: Completely separate folders dividing the **`/backend`** (Express API) from the **`/frontend`** (Next.js visual client dashboard).
5.  **Git Configuration**: Clean, unified `.gitignore` to prevent committing dependencies (`node_modules`) or sensitive secrets (`.env` keys).

---

## Architectural Layout

```
github-analyzer/
├── backend/                       # Node.js Express API & Test Suite
│   ├── src/
│   │   ├── config/db.js           # MySQL connection pool & startup auto-migrator
│   │   ├── controllers/           # Business routing handlers (with native SQL stats)
│   │   ├── models/
│   │   │   ├── Profile.js         # SQL-backed profile model mapping Mongoose calls
│   │   │   └── AnalysisLog.js     # SQL-backed logger mapping Mongoose calls
│   │   ├── middleware/            # Rate limiters & centralized error handlers
│   │   ├── routes/                # Request routes & parameter check rules
│   │   └── services/
│   │       ├── githubService.js   # Live GitHub public REST API fetcher
│   │       └── aiService.js       # Groq AI Llama 3.3 review generator
│   ├── tests/
│   │   └── profile.test.js        # Jest integration test suite (uses database mocks)
│   ├── .env.example
│   └── package.json
├── frontend/nextapp/              # Next.js 16 Visual Client Dashboard
│   ├── app/                       # App Router (Home/Search, Profile details, Compare board)
│   ├── components/                # Modular client components
│   └── lib/api.ts                 # Client-side API fetch wrappers
├── sql/
│   └── schema.sql                 # Reference CREATE TABLE scripts for MySQL
├── github_analyzer.postman.json   # Exported Postman endpoint collection
├── docker-compose.yml             # DevOps Docker deployment setup
└── README.md                      # Comprehensive developer guide (this file)
```

---

## Quick Start Setup

Follow these simple instructions to launch the entire project locally:

### 1. Database Setup
1. Ensure your local MySQL server is running (e.g. via XAMPP, WampServer, MAMP, or command line).
2. You do **NOT** need to manually import any database tables or write SQL syntax. Our built-in **Self-Bootstrapping Auto-Migrator** automatically verifies/creates the database schema (`github_analyzer`) and builds all necessary tables (`github_profiles` and `analysis_logs`) on startup!

### 2. Configure Backend API Environment
1. Navigate into the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your environment file from the example:
   ```bash
   cp .env.example .env
   ```
4. Open the newly created **`.env`** and enter your connection parameters:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourLocalMySQLPassword
   DB_NAME=github_analyzer
   DB_PORT=3306
   GITHUB_TOKEN=yourOptionalGitHubAccessToken
   CACHE_TTL_SECONDS=3600
   GROQ_API_KEY=gsk_yourGroqAPIKeyHere
   ```
5. Launch the Express server in development mode:
   ```bash
   npm run dev
   ```
   Upon a successful boot, the console will print:
   ```
   [SERVER] Server running on port 3000
   [DOCS]   Swagger UI → http://localhost:3000/api/docs
   [DATABASE] Connected to MySQL host: localhost, database: github_analyzer
   [DATABASE] MySQL Schema migration check verified.
   ```

### 3. Configure Frontend Client Environment
1. In a new terminal tab, navigate into the frontend Next.js app:
   ```bash
   cd frontend/nextapp
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build & boot the Next.js visual dashboard in development mode (listens on port 3001):
   ```bash
   npm run dev
   ```
4. Open **[http://localhost:3001](http://localhost:3001)** in your browser!

---

## Environment Variables Reference

### Backend (`/backend/.env`)

| Variable Name | Description | Required | Default Value |
| :--- | :--- | :---: | :--- |
| `PORT` | Local server port for Express listener | No | `3000` |
| `DB_HOST` | Hostname of your MySQL server | **Yes** | `localhost` |
| `DB_USER` | Username of your MySQL connection | **Yes** | `root` |
| `DB_PASSWORD` | Password of your MySQL connection | No | *Empty* |
| `DB_NAME` | Database name for the application | **Yes** | `github_analyzer` |
| `DB_PORT` | Port number of your MySQL instance | **Yes** | `3306` |
| `GITHUB_TOKEN` | Personal Access Token to prevent GitHub API rate limit blocks | No | *None (60 req/hr)* |
| `CACHE_TTL_SECONDS` | In-memory profile analysis caching TTL in seconds | No | `3600` |
| `GROQ_API_KEY` | Groq cloud key to trigger AI Llama 3.3 Profile Evaluations | **Yes** | *None* |

### Frontend (`/frontend/nextapp/.env.local`)

| Variable Name | Description | Required | Default Value |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | Live URL endpoint of your Express backend server | **Yes** | `http://localhost:3000` |

---

## API Documentation

All requests must send the `'Content-Type': 'application/json'` header. An interactive **Swagger OpenAPI UI** is automatically available at **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)** when the backend runs!

### 1. Health Status Probing
Verify Express server, cache state, and MySQL pool connectivity.
*   **Method**: `GET`
*   **Path**: `/health`

### 2. Analyze Profile (UPSERT)
Fetches stats from GitHub API, aggregates metrics, triggers the Groq AI assessment report, and updates/caches the profile in MySQL.
*   **Method**: `POST`
*   **Path**: `/api/profiles/analyze`
*   **Body**: `{ "username": "octocat" }`

### 3. Get Stored Profile
Retrieves a single developer's profile from MySQL.
*   **Method**: `GET`
*   **Path**: `/api/profiles/:username`

### 4. Paginated List Directory
Fetch stored records with customizable filtering (language, minimum stars, search keyword) and pagination.
*   **Method**: `GET`
*   **Path**: `/api/profiles`
*   **Query Params**: `?page=1&limit=10&sort=stars&order=desc&language=Python&min_stars=5`

### 5. Compare Board
Retrieves multiple developers side-by-side.
*   **Method**: `GET`
*   **Path**: `/api/profiles/compare`
*   **Query Params**: `?users=torvalds,octocat`

### 6. Delete Insights
Removes a developer's profile record from MySQL and evicts them from the memory cache.
*   **Method**: `DELETE`
*   **Path**: `/api/profiles/:username`

---

## Running Integration Tests

Run the integration suite testing routes, controllers, validations, and errors inside the `/backend` folder:
```bash
npm test
```
*Tests utilize robust ES Module mocks, allowing them to execute instantly in under 2 seconds without requiring an active MySQL database connection or hitting GitHub rate limits.*

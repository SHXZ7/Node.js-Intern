# GitScope — GitHub Profile Analyzer API & Dashboard

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Mongoose ORM](https://img.shields.io/badge/Mongoose-v8.3-880000?logo=mongoose&logoColor=white)](https://mongoosejs.com/)
[![Jest Testing](https://img.shields.io/badge/Jest-Passed-C21325?logo=jest&logoColor=white)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**GitScope** is a production-grade Express.js backend backed by MongoDB Atlas and a beautiful vanilla glassmorphism frontend dashboard. It fetches, stores, analyzes, and compares public GitHub user profiles to extract deep statistics like language distributions, aggregated repository metrics, and activity insights.

---

## Project Structure

The project has been separated into clean, modular directories to divide frontend presentation from backend logic:

```
github-analyzer/
├── backend/                   # Node.js Express API
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js          # MongoDB connection helper
│   │   ├── controllers/
│   │   │   └── profileController.js
│   │   ├── models/
│   │   │   └── Profile.js     # Mongoose Document Schema
│   │   ├── routes/
│   │   │   └── profileRoutes.js
│   │   ├── services/
│   │   │   ├── githubService.js  # Live GitHub API calls & insight calculator
│   │   │   └── insightService.js # Exported calculations
│   │   ├── middleware/
│   │   │   └── errorHandler.js   # Centralized error mapping
│   │   └── app.js             # Server configurations & static serving
│   ├── tests/
│   │   └── profile.test.js    # Jest + Supertest integration tests
│   ├── .env.example
│   ├── package.json
│   └── .gitignore
├── frontend/                  # Glassmorphism Client Dashboard
│   ├── index.html             # UI Structure
│   ├── style.css              # Dark theme stylesheet with custom animations
│   └── app.js                 # API handler and UI state controller
├── README.md                  # Detailed Setup & Documentation
├── CLAUDE.md                  # Project context rules
└── AGENTS.md                  # Original task guideline checklist
```

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: A local MongoDB Community Server (v6.0+) OR a cloud-hosted MongoDB Atlas URI string.
- **GitHub Personal Access Token** *(Optional but highly recommended to avoid GitHub's 60 req/hr unauthenticated rate limits; raises limits to 5000 req/hr)*.

---

## Quick Start Setup

Follow these steps to run GitScope locally:

### 1. Clone and Install Dependencies
Navigate into the backend folder and run `npm install`:
```bash
# Go to backend directory
cd backend

# Install production & development dependencies
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to a new `.env` file:
```bash
cp .env.example .env
```
Open `.env` and fill in your connection variables:
```env
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/github_analyzer?retryWrites=true&w=majority
GITHUB_TOKEN=ghp_yourGitHubAccessTokenHere
```

### 3. Run the Development Server
Launch the server with live reload:
```bash
npm run dev
```
Upon a successful boot, the console will print:
```
[DATABASE] MongoDB Connected: cluster0-shard-00-01.xxxx.mongodb.net
[SERVER] Server running on port 3000
```

### 4. Visit the Application
Once the backend runs, you can access the visual dashboard directly in your browser:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## Environment Variables Reference

| Variable Name | Description | Required | Default Value |
| :--- | :--- | :---: | :--- |
| `PORT` | Local server port for Express listener | No | `3000` |
| `MONGODB_URI` | Full MongoDB Atlas connection string or local Mongo instance URI | **Yes** | `mongodb://127.0.0.1:27017/github_analyzer` |
| `GITHUB_TOKEN` | Personal Access Token to prevent GitHub API rate locks | No | *None (60 req/hr max)* |

---

## Database Mongoose Schema Definition

The analyzed data is stored in the `profiles` collection using the Mongoose structure defined in [Profile.js](file:///c:/Users/HP/Documents/internshala/backend/src/models/Profile.js):

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `username` | `String` | Unique GitHub username (Indexed, Unique, Primary Identifier) |
| `name` | `String` | Display name of the developer |
| `bio` | `String` | Developer bio |
| `location` | `String` | Geographic location |
| `company` | `String` | Employer company name |
| `blog` | `String` | Personal website or blog URL |
| `email` | `String` | Developer email (if public) |
| `twitter_username` | `String` | Twitter handle |
| `avatar_url` | `String` | URL link to user avatar |
| `github_url` | `String` | Direct link to GitHub user page |
| `account_type` | `String` | Account type, either `User` or `Organization` |
| `public_repos` | `Number` | Total public repositories count |
| `public_gists` | `Number` | Total public gists count |
| `followers` | `Number` | Total followers count |
| `following` | `Number` | Total following count |
| `total_stars` | `Number` | Sum of all stars across public repositories |
| `total_forks` | `Number` | Sum of all forks across public repositories |
| `total_watchers` | `Number` | Sum of all watchers across public repositories |
| `top_languages` | `Map<String, Number>` | Key-value mapping of languages and repository counts |
| `primary_language` | `String` | Most frequently used language |
| `account_age_days` | `Number` | Total days since account creation |
| `last_active_date` | `Date` | Date of the most recently pushed repository |
| `has_readme_profile` | `Boolean` | True if the developer has a personal Readme repository |
| `most_starred_repo` | `String` | Repository name with the highest star count |
| `most_forked_repo` | `String` | Repository name with the highest fork count |
| `avg_stars_per_repo` | `Number` | Decimal average of stars per repository |
| `analyzed_at` | `Date` | Timestamp of initial analysis (auto-generated) |
| `updated_at` | `Date` | Timestamp of latest updates (auto-updated on upsert) |

---

## API Reference

All requests must send the `'Content-Type': 'application/json'` header.

### 1. Health Check
*   **Method**: `GET`
*   **Path**: `/health`
*   **Response (200)**:
    ```json
    {
      "status": "ok",
      "timestamp": "2026-05-27T15:00:00.000Z"
    }
    ```

### 2. Analyze Profile (UPSERT)
Fetches profile data, compiles derived stats, and saves/updates it inside MongoDB.
*   **Method**: `POST`
*   **Path**: `/api/profiles/analyze`
*   **Request Body**:
    ```json
    {
      "username": "octocat"
    }
    ```
*   **Response (201 Created / 200 Updated)**:
    ```json
    {
      "success": true,
      "message": "Profile analyzed and saved successfully",
      "data": {
        "username": "octocat",
        "name": "The Octocat",
        "bio": null,
        "location": "San Francisco",
        "company": "@github",
        "blog": "https://github.blog",
        "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
        "github_url": "https://github.com/octocat",
        "account_type": "User",
        "public_repos": 8,
        "followers": 22768,
        "following": 9,
        "total_stars": 21433,
        "total_forks": 164865,
        "total_watchers": 21433,
        "top_languages": {
          "HTML": 1,
          "Ruby": 1,
          "CSS": 1
        },
        "primary_language": "HTML",
        "account_age_days": 5600,
        "last_active_date": "2024-08-21T00:00:00.000Z",
        "has_readme_profile": false,
        "most_starred_repo": "Spoon-Knife",
        "most_forked_repo": "Spoon-Knife",
        "avg_stars_per_repo": 2679.13,
        "analyzed_at": "2026-05-27T20:50:00.000Z",
        "updated_at": "2026-05-27T20:50:00.000Z"
      }
    }
    ```

### 3. Get Stored Profile
Retrieves a single developers profile from the local DB.
*   **Method**: `GET`
*   **Path**: `/api/profiles/:username`
*   **Response (200)**:
    ```json
    {
      "success": true,
      "data": { ...profile details... }
    }
    ```
*   **Error (404 Not Found)**:
    ```json
    {
      "success": false,
      "error": "Profile for 'username' has not been analyzed yet. Please run analyze first."
    }
    ```

### 4. List Directory (Paginated)
Fetch stored profiles with customized pagination, filters, and ordering options.
*   **Method**: `GET`
*   **Path**: `/api/profiles`
*   **Query Parameters**:
    - `page` *(optional, default: 1)*: Page number.
    - `limit` *(optional, default: 10, max: 100)*: Items per page.
    - `sort` *(optional, default: `analyzed_at`)*: Field to sort by (`analyzed_at`, `followers`, `stars`, `repos`).
    - `order` *(optional, default: `desc`)*: Sort order (`asc`, `desc`).
*   **Response (200)**:
    ```json
    {
      "success": true,
      "total": 42,
      "page": 1,
      "limit": 10,
      "data": [
        { ...profile 1... },
        { ...profile 2... }
      ]
    }
    ```

### 5. Compare Board
Retrieves comparison grids side-by-side.
*   **Method**: `GET`
*   **Path**: `/api/profiles/compare`
*   **Query Parameters**:
    - `users` *(**Required**, comma-separated)*: List of developers usernames to compare. Example: `?users=torvalds,octocat`
*   **Response (200)**:
    ```json
    {
      "success": true,
      "data": [
        { ...torvalds profile... },
        { ...octocat profile... }
      ]
    }
    ```

### 6. Delete Insights
Removes a developers profile record from the database.
*   **Method**: `DELETE`
*   **Path**: `/api/profiles/:username`
*   **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Profile deleted successfully"
    }
    ```

---

## Running Integration Tests

Our integration suite tests health checks, full analyses, error handling validations, query limits, and 404 lookups.
Run all tests using the following command inside the `backend/` folder:
```bash
npm test
```
*Tests utilize robust ESM mocks to execute instantly without relying on a live MongoDB connection or hitting GitHub rate limits.*

---

## Production Deployment Notes

Deploying this app to platforms like Railway, Render, or Fly.io is straightforward:

1.  **Deploy Database**: Setup a free MongoDB Atlas shared cluster (M0) and copy the Atlas URI.
2.  **Deploy Express Server**: Connect your repository to the service. Set the working directory to `backend`.
3.  **Configure Environment Variables**: In your deployment settings, add:
    - `MONGODB_URI` = `mongodb+srv://...`
    - `PORT` = `8080` (or leave default if injected automatically)
    - `GITHUB_TOKEN` = `ghp_yourToken` (optional, but highly recommended)
    - `NODE_ENV` = `production`
4.  **Static Serving**: The server will automatically build, boot, serve the backend API routes, and host the visual frontend directory out of the box.

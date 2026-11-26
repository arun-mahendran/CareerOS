# CareerOS API (FastAPI + SQLAlchemy + PostgreSQL)

```
React (Vite, port 8080) ──REST /api/v1──▶ FastAPI (port 8000) ──SQLAlchemy──▶ PostgreSQL
                                               ├──▶ Google OAuth 2.0 (server-side code flow)
                                               └──▶ Gemini (server-side only)
```

## 1. Create the database (Windows)
Install PostgreSQL, then in **SQL Shell (psql)** or pgAdmin:
```sql
CREATE DATABASE careeros_db ENCODING 'UTF8';
```

## 2. Configure
```powershell
cd backend
copy .env.example .env
```
Edit `.env`: `DATABASE_URL`, a long random `JWT_SECRET_KEY` (32+ chars), `GEMINI_API_KEY`,
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
`.env` is git-ignored — never commit it.

### Google sign-in (local)
Google Cloud Console → APIs & Services → Credentials → your **OAuth client ID (Web application)**:
- Authorized JavaScript origins: `http://localhost:8080`
- Authorized redirect URIs: `http://localhost:8000/api/v1/auth/google/callback` (must equal `GOOGLE_REDIRECT_URI`)

Flow: the button opens `/api/v1/auth/google/login` → Google → `/auth/google/callback` (state cookie checked,
code exchanged server-side, verified email required) → redirect to `FRONTEND_URL/auth?code=<one-time code>` →
the app exchanges the code (valid 2 minutes, single use) for tokens.

## 3. Install, migrate, seed, run
```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head          # creates/updates all tables
python -m app.seed            # configured admin account only; no demo records
uvicorn app.main:app --reload --port 8000
```
Docs: http://localhost:8000/docs · Health: http://localhost:8000/api/v1/health

Schema change? Edit models, then `alembic revision --autogenerate -m "describe change"` and `alembic upgrade head`.

## Auth
`POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `GET /auth/me` · `POST /auth/logout`
(revokes all refresh tokens) · `POST /auth/forgot-password` · `POST /auth/reset-password` ·
`GET /auth/google/login` · `GET /auth/google/callback` · `POST /auth/google/exchange`.
Passwords are bcrypt-hashed. Login/register/reset are rate-limited per IP. Roles (CANDIDATE / ADMIN) are read
from the database on every request; there is no public admin signup.
Password reset emails use SMTP_* settings; without SMTP in development the link is printed in the server console.

## Workspace data used by the screens
`/api/v1/data/{resumes|saved_jobs|roadmap_progress|roadmap_preferences|roadmap_study_logs|user_skills|learning_resource_progress|interview_sessions|profiles}`
— GET (list, `eq.<col>`, `order`, `limit`), POST (create), PUT (upsert), PATCH (update), DELETE.
The owner is always the signed-in user; client-sent `user_id` is ignored.

## AI
`POST /ai/interview/feedback`, `/ai/interview/model-answer`, `/ai/resume/improve` (signed-in only, timeout via
`AI_TIMEOUT_SECONDS`). If Gemini isn't configured or fails, the response is `{"ok": false, "error": ...}` — no fake output.

## Errors
Every error is `{"error": {"status", "message", "details?"}}`. Internal errors are logged, never returned.

## Deploying
Host on any Python host (Render, Railway, a VM): set the same env vars with `APP_ENV=production`,
your real `FRONTEND_URL`/`CORS_ORIGINS`, and `GOOGLE_REDIRECT_URI=https://<api-host>/api/v1/auth/google/callback`
(also add it in Google Cloud). Run `alembic upgrade head` on deploy, start with
`uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Then set `VITE_API_URL=https://<api-host>/api/v1` for the frontend.

## Real job aggregation

CareerOS collects listings only from official public job-board APIs: Greenhouse
(`boards-api.greenhouse.io/v1/boards/{board}/jobs`), Lever (`api.lever.co/v0/postings/{site}`, EU supported)
and Ashby (`api.ashbyhq.com/posting-api/job-board/{board}`). Nothing is scraped or guessed.

1. Run migrations: `alembic upgrade head` (adds source configuration, discovery timestamps, notification de-duplication).
2. Sign in as admin → **Job Sources** → *Add a company board*: pick the provider, enter the board identifier from the
   company's careers URL (e.g. `boards.greenhouse.io/airbnb` → `airbnb`) and the company name.
3. Click **Test** (fetches without saving) then **Sync now**. A board is "Healthy/monitored" only after a successful sync.
4. Start the background worker in a second terminal (Windows: `.venv\Scripts\activate` first):
   `python -m app.worker` — syncs every enabled board every `JOB_SYNC_INTERVAL_MINUTES` (default 30).
   `python -m app.worker --once` runs a single pass (for cron / Task Scheduler). Run exactly one worker in production;
   a database lock stops duplicates and Uvicorn reloads never start a scheduler.

Rules: jobs are keyed by (source, external id) so repeat syncs never duplicate; "NEW" means first discovered by
CareerOS within `NEW_JOB_WINDOW_HOURS`; a failed fetch never removes jobs; a job is marked expired only after it has
been missing from successful fetches for 6 hours; followers of a company get one notification per new job.
No demo listings or demo candidate are seeded. Migration `0004_remove_demo_data` permanently removes the legacy demo source, its listings and the old demo candidate while preserving real records.

Admin API: `GET/POST /api/v1/admin/job-sources`, `PUT /admin/job-sources/{id}`, `POST /admin/job-sources/{id}/test`,
`POST /admin/job-sources/{id}/sync`, `POST /admin/job-sources/sync-all`. Candidate API: `GET /api/v1/opportunities`
(filters: q, location, mode, remote, employment_type, skill, company_id, sort, page, page_size).

Tests: `pytest tests` (offline); `LIVE_BOARD_TESTS=1 pytest tests/test_job_sync.py` also calls the real boards.

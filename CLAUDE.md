# Trellis — AI-Native Behavioral Health EHR

## My Deployment
<!-- Claude: Update this section as you complete each setup phase. Secrets (DB password, API keys, encryption keys, etc.) go ONLY in .env files — never in this table. -->

| Key | Value |
|-----|-------|
| GCP Project ID | trellis-177416 |
| Region | us-central1 |
| Service Account | trellis-backend@trellis-177416.iam.gserviceaccount.com |
| Cloud Run API URL | https://trellis-api-608286927070.us-central1.run.app |
| Cloud Run Relay URL | https://trellis-relay-608286927070.us-central1.run.app |
| Cloud Run Frontend URL | https://trellis-frontend-608286927070.us-central1.run.app |
| Custom Domain | _(not yet configured)_ |
| Workspace (telehealth) | no |

### Secrets Location
All secrets live in gitignored `.env` files. Only read them when a task genuinely requires a secret value, never print or summarize secret values, and prefer environment variables or Secret Manager references for deployed services.

**`backend/api/.env`** contains:
- `DATABASE_URL` — Postgres connection string (includes DB password and Cloud SQL IP)
- `GCP_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` — path to `sa-key.json`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `OAUTH_TOKEN_ENCRYPTION_KEY` — Fernet key for encrypting stored OAuth tokens
- `FRONTEND_BASE_URL`
- `CRON_SECRET`

**`backend/relay/.env`** contains:
- `DATABASE_URL`
- `GCP_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `ALLOWED_ORIGINS`

**`frontend/.env`** contains:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY` — FCM Web Push certificate public key (for push notifications)

---

## Setup Instructions

When a user says "Set up Trellis" or similar, follow these phases in order. After completing each phase, update the "My Deployment" table above with any values you generated. Run commands directly where possible — ask the user only when you need manual steps (Console UI, copy-pasting config values, etc.).

**IMPORTANT — Assume the user is a non-technical clinician.** They are therapists, not developers. They will not understand .env files, YAML, JSON, or config syntax. Never ask them to manually edit any file. When you need values (Firebase config, OAuth secrets, etc.), ask them to paste the values into the terminal conversation. Then YOU create and write all config files silently. Keep explanations simple and jargon-free. If something fails, don't dump a stack trace — explain what went wrong in plain English and fix it.

### PHASE 0 — GCP CLI & Project
- Verify `gcloud` is installed: `gcloud --version`
- Authenticate if needed: `gcloud auth login` (opens browser — tell user to sign in with the same Google account they used for GCP Console)
- Set the active project: `gcloud config set project <PROJECT_ID>`
- Verify: `gcloud config get-value project`
- Update the "My Deployment" table with the project ID and region (these are not secrets)

### PHASE 1 — Enable APIs
```bash
gcloud services enable \
  sqladmin.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com \
  calendar-json.googleapis.com \
  drive.googleapis.com \
  gmail.googleapis.com \
  docs.googleapis.com \
  speech.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com
```

### PHASE 2 — Cloud SQL Database
- Create instance:
```bash
gcloud sql instances create trellis-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --backup-start-time=03:00 \
  --backup-location=us
```
- Generate a strong DB password (random 24+ chars) and set it:
```bash
gcloud sql users set-password postgres --instance=trellis-db --password=<GENERATED_PASSWORD>
```
- Create the database:
```bash
gcloud sql databases create trellis --instance=trellis-db
```
- Get the instance IP:
```bash
gcloud sql instances describe trellis-db --format='value(ipAddresses[0].ipAddress)'
```
- Authorize the user's current IP for access:
```bash
MY_IP=$(curl -s ifconfig.me)
gcloud sql instances patch trellis-db --authorized-networks=$MY_IP/32
```
- Apply all migrations from `db/migrations/` in order:
```bash
for f in db/migrations/*.sql; do
  echo "Applying $f..."
  PGPASSWORD="<DB_PASSWORD>" psql "host=<CLOUD_SQL_IP> dbname=trellis user=postgres" -f "$f"
done
```
- Note: `psql` may be keg-only on macOS — try `PATH="/opt/homebrew/opt/libpq/bin:$PATH"` if not found
- Verify tables: `\dt` should show ~30 tables
- Save DB IP and password — these go into the `.env` files in Phase 6 (never into CLAUDE.md)

### PHASE 3 — Service Account
```bash
# Create
gcloud iam service-accounts create trellis-backend \
  --display-name="Trellis Backend"

# Grant roles
PROJECT_ID=$(gcloud config get-value project)
SA_EMAIL="trellis-backend@${PROJECT_ID}.iam.gserviceaccount.com"

for role in roles/cloudsql.client roles/aiplatform.user roles/run.admin roles/iam.serviceAccountTokenCreator roles/speech.client; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role"
done

# Download key (for local dev — Cloud Run uses workload identity)
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=$SA_EMAIL
```
- Verify `sa-key.json` is in `.gitignore`
- Update "My Deployment" table with SA email (this is not a secret)

### PHASE 4 — Firebase Authentication
- Add Firebase to the project:
```bash
firebase projects:addfirebase $(gcloud config get-value project)
```
- If `firebase` CLI isn't available, tell the user to go to https://console.firebase.google.com. **Important:** The GCP project won't appear automatically — they need to click **"Console"** in the top-right corner first, then click **Create a project**, and choose **"Add Firebase to Google Cloud project"** to link their existing GCP project.
- Tell the user to go to Firebase Console → Authentication and click **Get started** first, then:
  - Enable **Google** (it appears on the initial list — click it, flip the switch, pick support email, save)
  - Click **Add new provider** to add **Email/Password** (flip the switch, save)
- Walk the user through getting their Firebase web config from Firebase Console → Project Settings → Your apps → Web app:
  - They need: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`
- Walk the user through generating a Web Push certificate (for push notifications):
  1. In Firebase Console → Project Settings → Cloud Messaging tab
  2. Scroll to **Web Push certificates**
  3. Click **Generate key pair**
  4. Copy the public key (long base64 string starting with `B`) — this is the VAPID key
- Save Firebase config values and VAPID key — these go into `frontend/.env` in Phase 6 (never into CLAUDE.md)

### PHASE 5 — Google OAuth (per-user account connection)
- Walk the user through creating an OAuth 2.0 Client ID:
  1. Go to GCP Console → APIs & Services → Credentials
  2. If prompted to configure the **OAuth consent screen** first, do so: choose **External**, add the user's email as a test user, fill in app name "Trellis", and save. This is required before creating credentials.
  3. Click **Create Credentials → OAuth client ID**
  4. Application type: **Web application**
  3. Name: "Trellis"
  4. Authorized redirect URIs: add `http://localhost:8080/api/google/callback` (for dev) and the Cloud Run API URL + `/api/google/callback` (for prod, add later)
  5. Copy the Client ID and Client Secret
- Generate a Fernet encryption key for OAuth token storage:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
- Save OAuth Client ID, Client Secret, and encryption key — these go into `backend/api/.env` in Phase 6 (never into CLAUDE.md)

### PHASE 6 — Environment Files
Generate any remaining secrets:
```bash
# CRON_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Create `backend/api/.env`:
```
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@<CLOUD_SQL_IP>:5432/trellis
GCP_PROJECT_ID=<PROJECT_ID>
GOOGLE_APPLICATION_CREDENTIALS=<absolute path to sa-key.json>

GOOGLE_OAUTH_CLIENT_ID=<from Phase 5>
GOOGLE_OAUTH_CLIENT_SECRET=<from Phase 5>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/api/google/callback
OAUTH_TOKEN_ENCRYPTION_KEY=<from Phase 5>
FRONTEND_BASE_URL=http://localhost:5173
CRON_SECRET=<generated above>
```
**DO NOT** add `DEV_MODE=1` — it bypasses JWT verification and must never be set in production.

Create `backend/relay/.env`:
```
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@<CLOUD_SQL_IP>:5432/trellis
GCP_PROJECT_ID=<PROJECT_ID>
GOOGLE_APPLICATION_CREDENTIALS=<absolute path to sa-key.json>
ALLOWED_ORIGINS=http://localhost:5173
```

Create `frontend/.env`:
```
VITE_FIREBASE_API_KEY=<from Phase 4>
VITE_FIREBASE_AUTH_DOMAIN=<PROJECT_ID>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<PROJECT_ID>
VITE_FIREBASE_STORAGE_BUCKET=<PROJECT_ID>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<from Phase 4>
VITE_FIREBASE_APP_ID=<from Phase 4>
VITE_FIREBASE_VAPID_KEY=<from Phase 4>
```

### PHASE 7 — Local Verification
```bash
make install    # Install all dependencies
make dev        # Start API (8080), Relay (8081), Frontend (5173)
```
- Verify http://localhost:5173 loads the login page
- If anything fails, check logs and troubleshoot before proceeding

### PHASE 8 — Build & Deploy to Cloud Run

**IMPORTANT: Build context.** The API and relay Dockerfiles expect `backend/` as the build context (they `COPY shared/`, `COPY api/`, etc.). `gcloud run deploy --source=backend/api` will NOT work because it sets the build context to `backend/api/` only. Instead, use Cloud Build to build images, then deploy the pre-built images.

**IMPORTANT: Database URL for Cloud Run.** Cloud Run connects to Cloud SQL via Unix socket, not TCP. Use this format:
```
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@/trellis?host=/cloudsql/<PROJECT_ID>:<REGION>:trellis-db
```

**Step 1: Build images with Cloud Build**

API:
```bash
cat > /tmp/cloudbuild-api.yaml << 'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/trellis-api', '-f', 'api/Dockerfile', '.']
images:
  - 'gcr.io/$PROJECT_ID/trellis-api'
EOF

gcloud builds submit backend/ \
  --config=/tmp/cloudbuild-api.yaml \
  --region=us-central1
```

Relay:
```bash
cat > /tmp/cloudbuild-relay.yaml << 'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/trellis-relay', '-f', 'relay/Dockerfile', '.']
images:
  - 'gcr.io/$PROJECT_ID/trellis-relay'
EOF

gcloud builds submit backend/ \
  --config=/tmp/cloudbuild-relay.yaml \
  --region=us-central1
```

Frontend (pass Firebase config and API/WS URLs as build args):
```bash
cat > /tmp/cloudbuild-frontend.yaml << 'EOF'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/trellis-frontend'
      - '--build-arg'
      - 'VITE_FIREBASE_API_KEY=<key>'
      - '--build-arg'
      - 'VITE_FIREBASE_AUTH_DOMAIN=<domain>'
      - '--build-arg'
      - 'VITE_FIREBASE_PROJECT_ID=<project>'
      - '--build-arg'
      - 'VITE_FIREBASE_STORAGE_BUCKET=<bucket>'
      - '--build-arg'
      - 'VITE_FIREBASE_MESSAGING_SENDER_ID=<sender_id>'
      - '--build-arg'
      - 'VITE_FIREBASE_APP_ID=<app_id>'
      - '--build-arg'
      - 'VITE_FIREBASE_VAPID_KEY=<vapid_key>'
      - '--build-arg'
      - 'VITE_API_URL=<Cloud Run API URL>'
      - '--build-arg'
      - 'VITE_WS_URL=wss://<Cloud Run Relay host>'
      - '.'
images:
  - 'gcr.io/$PROJECT_ID/trellis-frontend'
EOF

gcloud builds submit frontend/ \
  --config=/tmp/cloudbuild-frontend.yaml \
  --region=us-central1
```

**Step 2: Deploy pre-built images to Cloud Run**

Deploy API and relay first (to get their URLs), then frontend, then update API/relay with CORS and frontend URL.

```bash
SA_EMAIL="trellis-backend@${PROJECT_ID}.iam.gserviceaccount.com"

# API
gcloud run deploy trellis-api \
  --image=gcr.io/${PROJECT_ID}/trellis-api \
  --region=us-central1 \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --add-cloudsql-instances=${PROJECT_ID}:us-central1:trellis-db \
  --memory=512Mi --cpu=1 --timeout=3600 \
  --min-instances=0 --max-instances=10 \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@/trellis?host=/cloudsql/${PROJECT_ID}:us-central1:trellis-db,GOOGLE_OAUTH_CLIENT_ID=<id>,GOOGLE_OAUTH_CLIENT_SECRET=<secret>,GOOGLE_OAUTH_REDIRECT_URI=<API_URL>/api/google/callback,OAUTH_TOKEN_ENCRYPTION_KEY=<key>,FRONTEND_BASE_URL=<FRONTEND_URL>,ALLOWED_ORIGINS=<FRONTEND_URL>,CRON_SECRET=<secret>"

# Relay
gcloud run deploy trellis-relay \
  --image=gcr.io/${PROJECT_ID}/trellis-relay \
  --region=us-central1 \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --add-cloudsql-instances=${PROJECT_ID}:us-central1:trellis-db \
  --memory=512Mi --cpu=1 --timeout=3600 \
  --min-instances=0 --max-instances=5 \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID},DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@/trellis?host=/cloudsql/${PROJECT_ID}:us-central1:trellis-db,ALLOWED_ORIGINS=<FRONTEND_URL>"

# Frontend
gcloud run deploy trellis-frontend \
  --image=gcr.io/${PROJECT_ID}/trellis-frontend \
  --region=us-central1 \
  --allow-unauthenticated \
  --memory=256Mi --cpu=0.5 --timeout=900 \
  --min-instances=0 --max-instances=3
```

**Step 3: Post-deploy configuration**
- Update API env vars with `FRONTEND_BASE_URL`, `ALLOWED_ORIGINS`, and `GOOGLE_OAUTH_REDIRECT_URI` pointing to production URLs
- Update relay env vars with `ALLOWED_ORIGINS` pointing to frontend URL
- Walk the user through adding the production OAuth redirect URI:
  1. Go to: GCP Console → APIs & Services → Credentials
  2. Click on the "Trellis" OAuth client ID
  3. Under **Authorized redirect URIs**, click **Add URI**
  4. Paste: `<Cloud Run API URL>/api/google/callback`
  5. Click **Save**
- Walk the user through adding the Cloud Run frontend domain to Firebase authorized domains:
  1. Go to: Firebase Console → Authentication (left sidebar)
  2. Click the **Settings** tab at the top
  3. Scroll down to **Authorized domains**
  4. Click **Add domain**
  5. Paste just the domain (no `https://`): e.g. `trellis-frontend-543321659528.us-central1.run.app`
  6. Click **Add**
  - Without this step, Google sign-in will fail on the production URL with an "unauthorized domain" error
- Record all three Cloud Run URLs in "My Deployment" table (these are not secrets — they're public URLs)

### PHASE 9 — Domain & SSL (optional)
- Ask the user: "Do you want a custom domain, or are the Cloud Run URLs fine?"
- If **no custom domain**: the Cloud Run URLs work as-is (they include free HTTPS). Just make sure OAuth redirect URI and CORS origins point to the Cloud Run frontend URL.
- If **custom domain**: set up a load balancer with URL map routing:
  - `/api/*` → trellis-api
  - `/ws/*` → trellis-relay
  - Default → trellis-frontend
  - Managed SSL certificate for the domain
  - HTTP → HTTPS redirect

### PHASE 10 — Domain-Wide Delegation (Workspace users only)
- Ask: "Do you use Google Workspace and want telehealth with Meet auto-recording?"
- If **no**: skip entirely — the in-app session recorder handles in-person sessions. Free Google accounts work fine.
- If **yes**:
  - Enable domain-wide delegation on the service account
  - Get the SA's unique/client ID: `gcloud iam service-accounts describe $SA_EMAIL --format='value(uniqueId)'`
  - Walk user through Google Workspace Admin Console → Security → API Controls → Domain-wide Delegation:
    - Add new client ID
    - Scopes: `https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/documents`
  - Update "My Deployment" table: Workspace = yes (not a secret)

### PHASE 11 — HIPAA BAA
- Walk the user through signing the Google Cloud BAA:
  1. GCP Console → select the **organization** (not project)
  2. Go to Cloud Overview → BAA section (or search "Business Associate Agreement")
  3. Review and sign
- Run through the Deployment Security Checklist (see below)

### PHASE 12 — Cloud Scheduler (CRON jobs)
```bash
# Appointment reconfirmation reminders (daily 9am)
gcloud scheduler jobs create http trellis-reconfirmation \
  --location=us-central1 \
  --schedule="0 9 * * *" \
  --uri="<API_URL>/api/cron/send-reconfirmations" \
  --http-method=POST \
  --headers="X-Cron-Secret=<CRON_SECRET>" \
  --time-zone="America/New_York"
```
- Only create Meet recording fetch job if Workspace/delegation is enabled (Phase 10)

### PHASE 13 — Branding & Landing Page (optional)
Once Trellis is fully deployed and working, offer to customize the look and feel. This is a fun, creative step — take your time with it.

- Ask the user: "Would you like to customize Trellis with your practice's branding? You can share your website URL, a logo, or screenshots of designs you like."
- If they share a URL or images, use them as design inspiration
- **Safe files to edit for branding** (don't touch anything else during this phase):
  - `frontend/src/index.css` — Tailwind theme, CSS variables, colors, fonts
  - `frontend/src/pages/LandingPage.tsx` — public-facing landing/marketing page
  - `frontend/src/components/ClinicianShell.tsx` — app shell header/sidebar (logo, practice name)
  - `frontend/src/components/ClientShell.tsx` — client portal shell
  - `frontend/public/` — logo files, favicon, Open Graph images
- Iterate with the user — show them what you changed, ask for feedback, refine. This is a back-and-forth design process.
- Keep the core UI layout and functionality intact — only change colors, fonts, logos, and the landing page content
- If the user wants to revert, `git checkout` will restore everything instantly

**Note:** This step can use more API credits than the infrastructure phases since design is iterative. If the user is on a subscription plan, let them know they can always come back to this in a future session.

### Final Step
Do a final update to the "My Deployment" table with non-secret values (project ID, region, URLs, workspace status). Confirm all `.env` files are created and populated with secrets. The user now has a fully deployed Trellis instance.

**After setup is complete, rewrite this CLAUDE.md** to remove the setup instructions (Phases 0–13) and the "Updating Trellis" section. Replace them with a short "Setup Complete" note:

```markdown
## Setup
Setup was completed on [date]. All secrets are in `.env` files (gitignored). To re-run setup from scratch, restore this file from git history (`git checkout origin/main -- CLAUDE.md`).
```

Keep everything from "## Overview" onward (tech stack, directory layout, dev commands, architecture decisions, conventions, HIPAA safeguards). This prevents future Claude sessions from re-running setup or overwhelming the user with irrelevant instructions. The deployment table at the top should also be preserved.

---

## Updating Trellis

When a user says "Update Trellis" or similar, follow this process. The goal is to let the user choose which upstream changes they want, then apply them cleanly — no git knowledge required.

**IMPORTANT — Same audience rules apply.** The user is a non-technical clinician. Never mention branches, commits, merge conflicts, or diffs. Speak in terms of "updates," "improvements," and "new features." Handle all git operations silently.

### Step 1 — Fetch upstream changes
```bash
git fetch origin main
```

### Step 2 — Review the diff
Read the full diff between the user's current code and upstream:
```bash
git diff HEAD..origin/main
```
Also check for new migration files:
```bash
git diff HEAD..origin/main --name-only -- db/migrations/
```

### Step 3 — Summarize changes for the user
Group changes into plain-English items. For each one, explain:
- **What it does** (one sentence, no jargon)
- **What part of the app it affects** (e.g., "the scheduling page," "how notes are generated," "the client portal")
- Whether it includes a **database change** (migration)

Example:
> Here's what's new since your last update:
>
> 1. **Improved appointment reminders** — Reminders now include the session type and location. Affects the emails your clients receive.
> 2. **Bug fix: session notes not saving** — Fixed an issue where notes could fail to save if the session was longer than 2 hours. Affects note generation.
> 3. **New: group therapy attendance tracking** — Adds a new page for tracking attendance in group sessions. Includes a database update.
>
> Which of these would you like to install? You can say "all of them" or pick specific ones.

### Step 4 — Apply selected changes
For each change the user wants:

1. **If they want everything:** Stash local changes, merge upstream, pop stash, resolve any conflicts (keeping local branding and deployment config).
   ```bash
   git stash
   git merge origin/main
   git stash pop
   ```
   If there are conflicts in branding files (`index.css`, `LandingPage.tsx`, `ClinicianShell.tsx`, `ClientShell.tsx`, files in `public/`) or `CLAUDE.md`, keep the local version. For all other conflicts, take the upstream version and verify nothing breaks.

2. **If they want specific items:** Identify the relevant commits and cherry-pick them one at a time, resolving conflicts the same way.
   ```bash
   git cherry-pick <commit-hash>
   ```

3. **After applying:** Run `make install` in case dependencies changed.

### Step 5 — Apply new migrations
If any selected changes included new migration files:
1. Read `DATABASE_URL` from `backend/api/.env`
2. Apply only the new migrations in order:
   ```bash
   PGPASSWORD="<DB_PASSWORD>" psql "host=<CLOUD_SQL_IP> dbname=trellis user=postgres" -f db/migrations/<new_migration>.sql
   ```
3. Confirm each migration succeeded before moving on.

### Step 6 — Verify and redeploy
1. Run `make dev` and verify the app still loads correctly.
2. If the user has Cloud Run deployed (check "My Deployment" table), ask: "Would you like me to deploy these updates to your live site too?"
3. If yes, rebuild and redeploy following the Phase 8 instructions above.

### Handling branding conflicts
The user may have customized branding files (Phase 13). If an upstream update touches the same files:
- **Never silently overwrite branding.** Always keep the user's branding.
- If the upstream change is functional (not just styling), manually apply the functional change to the user's branded version of the file.
- Tell the user: "One of the updates touches a file you've customized with your branding. I've applied the functional change while keeping your design intact."

### If something goes wrong
- If a merge or cherry-pick fails badly: `git merge --abort` or `git cherry-pick --abort`, then tell the user what happened in plain English and try a different approach.
- Never leave the repo in a dirty/conflicted state. Always resolve or abort before stopping.
- If you can't cleanly apply a change, skip it and tell the user: "I wasn't able to apply [update name] without affecting your customizations. You may want to try again after the next upstream release."

---

## Overview
Open-source EHR platform for solo behavioral health therapists. Automates the full workflow: client intake via AI voice agent → scheduling → session recording → note generation → billing document generation. Includes a client journal with AI reflective feedback (text, voice, and dictation) and a rolling context compaction system that maintains a living clinical portrait per client. Works with any Google account; Google Workspace only required for telehealth/Meet auto-recording.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS v4 + React Router v7
- **Backend API:** Python 3.12 + FastAPI (port 8080)
- **Voice Relay:** Python 3.12 + FastAPI WebSocket (port 8081) — Gemini Live real-time voice
- **Database:** Cloud SQL PostgreSQL 15 with asyncpg
- **Auth:** Firebase Auth (JS SDK v11 frontend, firebase-admin backend)
- **AI:** Gemini Live (voice), Gemini 2.5 Flash (vision, compression, note generation)
- **Integrations:** Google Calendar, Meet, Docs, Drive, Gmail (per-user OAuth, SA delegation fallback)

## Directory Layout
```
trellis-ehr/
├── frontend/              # React + Vite SPA
│   └── src/
│       ├── pages/         # Route-level page components
│       ├── components/    # Shared + feature components
│       ├── hooks/         # Custom React hooks (auth, API wrappers)
│       ├── templates/     # Document templates (consent forms, etc.)
│       └── lib/           # Firebase config, utilities
├── backend/
│   ├── api/               # FastAPI REST API
│   │   └── routes/        # Route modules (intake, documents, scheduling, clients)
│   ├── relay/             # Gemini Live voice relay (WebSocket)
│   └── shared/            # Shared Python: db.py, compaction.py, gcal.py, mailer.py, vision.py, alerts.py, note_generator.py
├── db/migrations/         # Numbered SQL migration files
└── creation data/         # Planning docs, pitch deck
```

## Dev Commands
```bash
make install          # Install all dependencies
make dev-frontend     # Vite dev server on :5173
make dev-api          # API server on :8080
make dev-relay        # Voice relay on :8081
make dev              # Run all three
```

## CLI Access
You have permission to use `gcloud` and `firebase` CLIs directly. The user should already be authenticated via `gcloud auth login` (Phase 0).

### Database (Cloud SQL)
```bash
# Connect to the database (read DATABASE_URL from backend/api/.env)
PGPASSWORD="<DB_PASSWORD>" psql "host=<CLOUD_SQL_IP> dbname=trellis user=postgres"
```
Note: `psql` may be keg-only on macOS — use `PATH="/opt/homebrew/opt/libpq/bin:$PATH"` if not found.

### Firebase Auth (via gcloud REST API)
```bash
ACCESS_TOKEN=$(gcloud auth print-access-token)
PROJECT_ID=$(gcloud config get-value project)

# List all Firebase Auth users
curl -s "https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=100" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID"
```

## Key Conventions
- Backend services are independent Python apps (not a shared virtualenv)
- Each service has its own `requirements.txt` and `Dockerfile`
- Frontend proxies `/api` to backend API and `/ws` to relay via Vite config
- Shared Python code in `backend/shared/` (db operations, integrations, utilities)
- Database migrations in `db/migrations/` as numbered SQL files
- Env vars loaded from `.env` files per service (frontend, api, relay)
- `DEV_MODE=1` bypasses JWT verification — **never set in production**

## Architecture Decisions

### Database Schema
- **`encounters`** — universal transcript/interaction table. Types: intake, portal, clinical, group. Sources: voice, form, chat, clinician. JSONB `data` column for type-specific structured data. `token_estimate` and `summary_version` columns for context compaction tracking.
- **`clinical_notes`** — formal notes (SOAP/DAP/narrative) derived from encounters. Signing workflow: draft → review → signed → amended.
- **`clients`** — central client profile. Firebase UID, demographics, contact, insurance fields. `context_summary` (rolling AI portrait), `summary_version` (compaction counter), `docs_warning_dismissed` (suppress unsigned docs warning).
- **`practices`** — practice-level settings. Includes `require_client_invite` (gate client registration to invited-only).
- **`document_packages` / `documents`** — onboarding paperwork with e-signature. SHA-256 content hashing. Auto-generated on client registration.
- **`audit_events`** — append-only HIPAA audit log (no UPDATE/DELETE).
- **`clinician_availability` / `appointments`** — scheduling with Calendar event IDs, Meet links, recurrence.
### Voice Relay
- Supports two session types: `intake` (clinical intake with scheduling tools) and `journal` (reflective companion for between-session journaling).
- Audio is pass-through (browser ↔ Gemini), not recorded or stored.
- Gemini Live transcribes both sides in real-time.
- Context injection: `get_client_context()` returns the compressed client portrait + recent unsummarized encounters.
- Mid-session compression at ~100K tokens: pause, compress, reopen Gemini Live. Browser WebSocket stays open.
- Intake tools: `end_interview`, `get_available_slots`, `book_appointment`.
- Journal tools: `end_session` only (no scheduling). Uses a reflective companion system prompt.
- Voice journal sessions generate a reflection summary on completion and create a new text journal thread.

### Email Sending
- Gmail API via per-user OAuth or service account domain-wide delegation (Workspace only)
- Sender address: the clinician's connected Google email, or a delegated Workspace address
- All `send_email()` calls should pass `clinician_uid` to use OAuth credentials

### Context Compaction (`backend/shared/compaction.py`)
- Maintains a persistent, incrementally-enriched clinical portrait per client in `clients.context_summary`.
- Token-based compaction: triggers when unsummarized encounter tokens exceed 30K. Keeps the most recent ~10K tokens as "hot" (raw), compresses the rest into the portrait.
- Compaction prompt produces a structured portrait: Identity, Why They Came, Core Themes, Therapeutic Arc, Moments That Matter, Clinical Anchors, How to Be With This Person, Growing Edges.
- Incremental updates evolve the portrait — themes deepen, moments get replaced only when something more crystallizing surfaces.
- All AI features pull context via `get_client_context()`: compressed portrait + recent raw encounters.
- Compaction fires after every encounter save (intake, session recording, journal, clinical notes).
- Each encounter stores `token_estimate` (chars // 4) and `summary_version` (which compaction cycle folded it in).

### Client Journal
- Client portal feature: text journaling with optional AI reflective feedback, voice journaling (Gemini Live), and dictation (Vertex STT).
- Each journal visit creates one encounter (`type='portal'`). Text entries use `source='chat'`, voice sessions use `source='voice'`.
- AI feedback uses a reflective companion system prompt — warm, non-clinical, crisis-aware.
- Encounters auto-complete when the client navigates away (frontend `useEffect` cleanup + `visibilitychange`). Stale drafts (>30 min) auto-complete on list fetch.
- Voice journal sessions generate a reflection summary on completion → creates a new text journal thread with the summary as the first AI message.
- Full thread is preserved in AI context for the active conversation. Previous journal encounters flow through the standard compaction pipeline.
- Emotion tags (anxious, calm, sad, hopeful, etc.) stored in encounter `data` JSONB.
- Clinician sees journal entries in "Between Sessions" section of the client detail page.
- Clients can delete entries; if already compacted, themes remain in the portrait.

### Auto-generated Consent Documents
- When a client registers and is linked to a clinician, `auto_generate_consent_package()` fires automatically.
- Creates 6 consent documents (financial agreement, informed consent, HIPAA notice, telehealth consent, program agreement, release of info) and sends a signing email.
- Clinicians see an "Unsigned Documents" warning popup when viewing a client with pending signatures. Options: send reminder email, dismiss for this visit, or permanently suppress for this client.

### asyncpg JSONB Pattern
- Must configure JSONB codec on pool init (`_init_connection` in db.py)
- Without codec, asyncpg returns JSONB as strings, not dicts

## HIPAA Technical Safeguards

### Access Controls (45 CFR 164.312(a))
- Firebase Auth (Google + Email/Password). All API endpoints require valid Firebase JWT.
- Role-based access: `users.role` (clinician/client). `require_role()` middleware.
- Row-level access: Clients can only access their own records.
- Re-authentication: `ReauthProvider`/`ReauthModal` are mounted for future high-risk workflows, but routine clinical signing uses the active authenticated session.

### Session Security (45 CFR 164.312(a)(2)(iii))
- 15-minute inactivity timeout with 13-minute warning modal.
- Firebase ID tokens expire after 1 hour with auto-refresh.

### Encryption (45 CFR 164.312(a)(2)(iv), 164.312(e))
- At rest: Cloud SQL AES-256 (Google-managed).
- In transit: Cloud Run HTTPS, Firebase TLS, Cloud SQL SSL.
- OAuth tokens: Fernet encryption at rest in DB.

### Audit Logging (45 CFR 164.312(b))
- `audit_events` table: append-only, records all PHI access.
- PHI-safe logging: `backend/shared/safe_logging.py` redacts PHI from application logs.
- Request logging: method, path, status, duration, IP — no bodies or auth values.

### Data Integrity (45 CFR 164.312(c)(2))
- SHA-256 content hashing on signed clinical notes and documents.
- Signed notes are immutable; amendments create new records.

### Backup & Recovery (45 CFR 164.308(a)(7))
- Cloud SQL automated daily backups with 7-day retention and PITR.

### Deployment Security Checklist
- [ ] Remove `0.0.0.0/0` from Cloud SQL — restrict to Cloud Run + user IP
- [ ] Ensure `DEV_MODE` is unset in all production environments
- [ ] Enable Cloud SQL SSL enforcement (`requireSsl: true`)
- [ ] `CRON_SECRET` set to a strong random value
- [ ] Cloud Run min-instances=0, max-instances=10
- [ ] Configure Cloud Armor WAF in front of Cloud Run
- [ ] Set up Cloud Monitoring alerts for failed auth and 5xx errors

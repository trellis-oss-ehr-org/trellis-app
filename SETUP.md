# Trellis Setup Guide

Trellis is designed as one install per solo or group practice. Each practice
should deploy its own Google Cloud project, Cloud SQL database, Firebase
project, and Cloud Run services.

This guide is written so a clinician or practice administrator can work through
setup with Codex. Open this repository in Codex and ask:

```text
Set up Trellis for my practice using SETUP.md.
```

Codex should run commands directly when possible, create configuration files for
you, and ask only for values that must come from Google Cloud or Firebase.

## Important

- Do not commit `.env` files, service account keys, OAuth client secrets,
  database passwords, encryption keys, or live deployment URLs.
- Do not set `DEV_MODE=1` in production. It bypasses Firebase token
  verification and is only for local tests.
- Trellis is HIPAA-oriented software, but compliance depends on deployment,
  configuration, Google BAA coverage, practice policies, workforce procedures,
  risk analysis, and any local modifications.
- Read `docs/hipaa-self-hosting-responsibilities.md` before handling real client
  data. It explains the compliance work the self-hosting practice owns.
- One Trellis install supports one practice. Separate legal practices should use
  separate deployments and databases.

## Prerequisites

- Google Cloud project with billing enabled
- Firebase enabled for the same Google Cloud project
- Google Cloud CLI: `gcloud`
- Firebase CLI: `firebase`
- Docker
- Node.js 20+
- Python 3.12+
- PostgreSQL client tools: `psql`

## Setup Phases

### 1. Google Cloud Project

Authenticate and select your project:

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud config get-value project
```

Enable required APIs:

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

### 2. Cloud SQL

Create the PostgreSQL instance and database:

```bash
gcloud sql instances create trellis-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=<REGION> \
  --backup-start-time=03:00 \
  --backup-location=us

gcloud sql users set-password postgres \
  --instance=trellis-db \
  --password=<GENERATED_DB_PASSWORD>

gcloud sql databases create trellis --instance=trellis-db
```

Apply migrations:

```bash
for f in db/migrations/*.sql; do
  echo "Applying $f..."
  PGPASSWORD="<DB_PASSWORD>" psql \
    "host=<CLOUD_SQL_IP> dbname=trellis user=postgres" \
    -f "$f"
done
```

### 3. Service Account

Create the backend service account and grant required roles:

```bash
gcloud iam service-accounts create trellis-backend \
  --display-name="Trellis Backend"

PROJECT_ID=$(gcloud config get-value project)
SA_EMAIL="trellis-backend@${PROJECT_ID}.iam.gserviceaccount.com"

for role in roles/cloudsql.client roles/aiplatform.user roles/run.admin roles/iam.serviceAccountTokenCreator roles/speech.client; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role"
done
```

For local development only, create a key file and keep it out of git:

```bash
gcloud iam service-accounts keys create sa-key.json \
  --iam-account="$SA_EMAIL"
```

### 4. Firebase Authentication

In Firebase Console:

1. Add Firebase to your Google Cloud project.
2. Enable Authentication.
3. Enable Google sign-in.
4. Enable Email/Password sign-in.
5. Create a Web app and copy the Firebase web config.
6. Generate a Web Push certificate and copy the VAPID public key.

You will use these values in `frontend/.env`.

### 5. Google OAuth

Create an OAuth client for per-user Google Calendar/Gmail access:

1. Go to Google Cloud Console -> APIs & Services -> Credentials.
2. Configure the OAuth consent screen if prompted.
3. Create an OAuth client ID.
4. Application type: Web application.
5. Add redirect URIs:
   - `http://localhost:8080/api/google/callback`
   - `<CLOUD_RUN_API_URL>/api/google/callback`

Generate an encryption key for stored OAuth tokens:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 6. Environment Files

Create `backend/api/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@<CLOUD_SQL_IP>:5432/trellis
GCP_PROJECT_ID=<PROJECT_ID>
GOOGLE_APPLICATION_CREDENTIALS=<ABSOLUTE_PATH_TO_SA_KEY_JSON>
GOOGLE_OAUTH_CLIENT_ID=<OAUTH_CLIENT_ID>
GOOGLE_OAUTH_CLIENT_SECRET=<OAUTH_CLIENT_SECRET>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/api/google/callback
OAUTH_TOKEN_ENCRYPTION_KEY=<FERNET_KEY>
FRONTEND_BASE_URL=http://localhost:5173
CRON_SECRET=<RANDOM_SECRET>
```

Create `backend/relay/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@<CLOUD_SQL_IP>:5432/trellis
GCP_PROJECT_ID=<PROJECT_ID>
GOOGLE_APPLICATION_CREDENTIALS=<ABSOLUTE_PATH_TO_SA_KEY_JSON>
ALLOWED_ORIGINS=http://localhost:5173
```

Create `frontend/.env`:

```dotenv
VITE_FIREBASE_API_KEY=<FIREBASE_API_KEY>
VITE_FIREBASE_AUTH_DOMAIN=<PROJECT_ID>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<PROJECT_ID>
VITE_FIREBASE_STORAGE_BUCKET=<PROJECT_ID>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<FIREBASE_MESSAGING_SENDER_ID>
VITE_FIREBASE_APP_ID=<FIREBASE_APP_ID>
VITE_FIREBASE_VAPID_KEY=<FIREBASE_VAPID_KEY>
```

Generate `CRON_SECRET` with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 7. Local Verification

Install dependencies, start services, and run tests:

```bash
make install
make db-up
make db-reset
make dev
```

Open `http://localhost:5173`.

Run backend tests:

```bash
make test-backend
```

### 8. Deployment

Build and deploy each service with the repository Cloud Build files and Cloud Run
configuration. Use Secret Manager or Cloud Run environment variables for runtime
configuration. After deployment:

1. Update OAuth redirect URI to use the deployed API URL.
2. Set frontend API/relay URLs for the deployed frontend.
3. Configure authorized domains in Firebase Authentication.
4. Verify sign-in, client intake, appointment booking, Google OAuth connection,
   document signing, note generation, billing export, and audit logging.
5. Confirm backups, access controls, logging, incident response, and BAA coverage
   before handling real client data.

## Codex Security Audit

Read `docs/hipaa-self-hosting-responsibilities.md` before using Trellis with
real client data. It describes the self-hosting practice's responsibilities for
HIPAA status, risk analysis, BAAs, administrative/physical/technical safeguards,
incident response, and ongoing review.

After local verification and again before handling real client data, open the
repo in Codex and ask:

```text
Run a full Trellis security audit using docs/agents/code-quality-security-agent.md
and docs/agents/hipaa-audit-agent.md.
```

Codex should inspect the local instance, run non-destructive checks where
available, avoid printing secrets or PHI, and return prioritized findings with
evidence and remediation steps. The audit prompts are documented in
`docs/agents/README.md`.

## Development Commands

```bash
make install
make dev
make dev-api
make dev-relay
make dev-frontend
make db-up
make db-reset
make test-backend
```

## Repository Layout

```text
frontend/       React/Vite application
backend/api/    FastAPI backend API
backend/relay/  WebSocket voice relay service
backend/shared/ Shared Python modules
db/migrations/  PostgreSQL migrations
tests/          Backend and end-to-end tests
docs/           Operational and engineering documentation
```

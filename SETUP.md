# Trellis Codex Desktop Setup Guide

Trellis is designed as one install per solo or group practice. Each practice
should use its own Google Cloud project, Cloud SQL database, Firebase project,
and Cloud Run services.

This guide is written for a clinician or practice administrator using the Codex
Desktop app, not for someone manually driving a terminal. The expected starting
point is:

- The user has opened a fresh Trellis checkout as a new Codex project.
- The user is signed into Google Cloud in their browser.
- The user has access to an active Google Cloud billing account.
- Nothing else should be assumed: the Google Cloud project, Firebase setup,
  local CLIs, database, secrets, and deployment resources may not exist.

When the user asks Codex:

```text
Set up Trellis
```

Codex should treat that as a request to follow this guide end to end.

## Codex Operating Rules

Codex should do the technical work directly where the Desktop app can safely do
it: inspect files, install local tools when possible, run setup commands, create
configuration files, run tests, and prepare deployment commands.

Codex should keep the user in the loop only where a human decision or browser
action is required:

- Choosing or confirming the Google Cloud billing account.
- Choosing the Google Cloud project ID, display name, and region.
- Completing browser-based Google, Firebase, or OAuth consent screens.
- Accepting Firebase terms if prompted.
- Copying values from Firebase or Google Cloud consoles that are not available
  from the CLI.
- Confirming before Codex creates or changes cloud resources.

Codex must not print `.env` values, service account keys, OAuth client secrets,
database passwords, live tokens, private deployment URLs, or real client data.
Codex must not ask the user to paste PHI/ePHI into Codex.

For a scratch install, Codex must not reuse `.env` files, service account keys,
or secrets from sibling directories or older Trellis checkouts unless the user
explicitly says this is an existing Trellis deployment being recovered.

Do not set `DEV_MODE=1` in production. It bypasses Firebase token verification
and is only for local synthetic testing.

Trellis is HIPAA-oriented software, but compliance depends on deployment,
configuration, Google BAA coverage, practice policies, workforce procedures,
risk analysis, and any local modifications. Read
`docs/hipaa-self-hosting-responsibilities.md` before handling real client data.

## Phase 0: Desktop Workspace Check

Codex should start with non-destructive inspection:

```bash
git status --short --ignored
rg --files
ls
```

Report anything that suggests the checkout is not fresh, such as `.env` files,
service account keys, `.venv`, `node_modules`, build output, Python caches, or
uncommitted setup changes. Do not delete or reuse those files without user
confirmation.

Codex should then identify the operating system and available package managers,
then check local prerequisites:

```bash
command -v gcloud
command -v firebase
command -v docker
command -v node
command -v npm
command -v python3
command -v psql
command -v cloud-sql-proxy
```

If a command exists, verify its version:

```bash
gcloud --version
firebase --version
docker compose version
node --version
npm --version
python3 --version
psql --version
cloud-sql-proxy --version
```

If a local tool is missing, Codex should install it where possible. On macOS,
common options are:

```bash
brew install --cask google-cloud-sdk
brew install node@20 postgresql@15 cloud-sql-proxy
brew install --cask docker
npm install -g firebase-tools
```

If Homebrew is unavailable, Codex should use the official installer path for the
missing tool or ask the user before installing Homebrew. After installing a CLI,
Codex may need to restart the shell session or ask the user to restart Codex so
the command is available on `PATH`.

## Phase 1: Authenticate Local CLIs

Browser login to Google Cloud Console does not automatically authenticate local
CLI tools. Codex should authenticate the CLIs using the same Google account that
owns or can use the billing account.

```bash
gcloud auth login
gcloud auth application-default login
gcloud auth list
gcloud config get-value account

firebase login
firebase projects:list
```

If a login command opens a browser, the user completes the Google consent flow.
Codex should not ask the user to paste access tokens into chat.

## Phase 2: Create Or Select The Google Cloud Project

For a new practice install, prefer a new Google Cloud project. Codex should ask
for the practice display name only if it cannot infer a reasonable project name
from context. Codex may propose a project ID, but the user must confirm it
because project IDs are public identifiers and cannot be changed after creation.

Use `us-central1` as the default region unless the user chooses another US
region.

List active billing accounts:

```bash
gcloud billing accounts list \
  --filter="open=true" \
  --format="table(name,displayName,open)"
```

Before creating or changing anything, Codex should summarize:

- Google account currently authenticated in `gcloud`.
- Billing account display name or ID that will be used.
- Proposed project ID and project display name.
- Proposed region.
- The cloud resources that will be created.

After the user confirms:

```bash
export PROJECT_ID="<CONFIRMED_PROJECT_ID>"
export PROJECT_NAME="<CONFIRMED_PROJECT_DISPLAY_NAME>"
export REGION="us-central1"
export BILLING_ACCOUNT_ID="<CONFIRMED_BILLING_ACCOUNT_ID>"

gcloud projects create "$PROJECT_ID" \
  --name="$PROJECT_NAME" \
  --set-as-default

gcloud billing projects link "$PROJECT_ID" \
  --billing-account="$BILLING_ACCOUNT_ID"

gcloud config set project "$PROJECT_ID"
gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)"
gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)"
```

If the user wants to use an existing project, Codex should verify that the
project is active and billing-enabled before continuing:

```bash
gcloud projects list \
  --filter="lifecycleState=ACTIVE" \
  --format="table(projectId,name,projectNumber)"

gcloud billing projects describe "$PROJECT_ID" \
  --format="value(billingEnabled)"
```

## Phase 3: Enable APIs And Container Registry

Enable the required APIs:

```bash
gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  cloudbilling.googleapis.com \
  sqladmin.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com \
  calendar-json.googleapis.com \
  drive.googleapis.com \
  gmail.googleapis.com \
  docs.googleapis.com \
  speech.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  --project="$PROJECT_ID"
```

Create an Artifact Registry Docker repository for Trellis images:

```bash
export ARTIFACT_REPO="trellis"

gcloud artifacts repositories describe "$ARTIFACT_REPO" \
  --location="$REGION" \
  --project="$PROJECT_ID" \
  >/dev/null 2>&1 || \
gcloud artifacts repositories create "$ARTIFACT_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Trellis container images" \
  --project="$PROJECT_ID"
```

## Phase 4: Cloud SQL

Create the PostgreSQL instance:

```bash
gcloud sql instances create trellis-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --backup-start-time=03:00 \
  --backup-location=us \
  --project="$PROJECT_ID"
```

Generate the database password locally and store it in Secret Manager. Do not
print it in chat or commit it to git:

```bash
DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"

gcloud sql users set-password postgres \
  --instance=trellis-db \
  --password="$DB_PASSWORD" \
  --project="$PROJECT_ID"

printf "%s" "$DB_PASSWORD" | gcloud secrets create trellis-db-password \
  --data-file=- \
  --replication-policy=automatic \
  --project="$PROJECT_ID"
```

Create the application database and capture the Cloud SQL connection name:

```bash
gcloud sql databases create trellis \
  --instance=trellis-db \
  --project="$PROJECT_ID"

export DB_CONNECTION_NAME="$(gcloud sql instances describe trellis-db \
  --project="$PROJECT_ID" \
  --format='value(connectionName)')"
```

Apply migrations through the Cloud SQL Auth Proxy instead of opening a broad
database network rule:

```bash
cloud-sql-proxy "$DB_CONNECTION_NAME" --port 5433 &
PROXY_PID="$!"

for f in db/migrations/*.sql; do
  echo "Applying $f"
  PGPASSWORD="$DB_PASSWORD" psql \
    "host=127.0.0.1 port=5433 dbname=trellis user=postgres sslmode=disable" \
    -v ON_ERROR_STOP=1 \
    -f "$f"
done

kill "$PROXY_PID"
```

If a migration fails, Codex should stop, report the failing migration filename,
and avoid retrying destructive commands without user confirmation.

## Phase 5: Service Account And Secrets

Create the Cloud Run service account:

```bash
gcloud iam service-accounts create trellis-backend \
  --display-name="Trellis Backend" \
  --project="$PROJECT_ID"

export SA_EMAIL="trellis-backend@${PROJECT_ID}.iam.gserviceaccount.com"

for role in \
  roles/cloudsql.client \
  roles/aiplatform.user \
  roles/speech.client \
  roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --quiet
done
```

Prefer Application Default Credentials for local development and the Cloud Run
service account for deployed services. Do not create service account keys unless
the user explicitly needs one for a specific local workflow.

Generate runtime secrets and store them in Secret Manager:

```bash
for secret_name in \
  trellis-cron-secret \
  trellis-health-check-secret \
  trellis-log-hash-secret; do
  secret_value="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  printf "%s" "$secret_value" | gcloud secrets create "$secret_name" \
    --data-file=- \
    --replication-policy=automatic \
    --project="$PROJECT_ID"
done

oauth_key="$(python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())')"
printf "%s" "$oauth_key" | gcloud secrets create trellis-oauth-token-encryption-key \
  --data-file=- \
  --replication-policy=automatic \
  --project="$PROJECT_ID"
```

## Phase 6: Firebase Authentication

Add Firebase to the Google Cloud project. If Firebase prompts for terms of
service, the user must accept them in the Firebase Console.

```bash
firebase projects:addfirebase "$PROJECT_ID"
firebase use "$PROJECT_ID"
```

Create a Firebase Web app and retrieve its config. Codex should verify the exact
Firebase CLI syntax with `firebase apps:create --help` if the installed CLI
differs from the examples below:

```bash
firebase apps:create WEB "Trellis Web" --project "$PROJECT_ID"
firebase apps:list --project "$PROJECT_ID"
firebase apps:sdkconfig WEB "<FIREBASE_WEB_APP_ID>" --project "$PROJECT_ID"
```

In Firebase Console, enable Authentication and turn on these sign-in providers:

- Email/Password
- Google

Create a Web Push certificate and copy the VAPID public key. Codex should use
the web app config and VAPID public key to fill `frontend/.env` and the frontend
Cloud Build substitutions.

## Phase 7: Google OAuth Client

Create a Google OAuth client for per-user Google Calendar, Gmail, Docs, and
Drive access:

1. Open Google Cloud Console -> APIs & Services -> Credentials.
2. Configure the OAuth consent screen if prompted.
3. Create an OAuth client ID.
4. Application type: Web application.
5. Add the local redirect URI:
   - `http://localhost:8080/api/google/callback`
6. After Cloud Run deployment, add the deployed API redirect URI:
   - `<CLOUD_RUN_API_URL>/api/google/callback`

Codex may guide the user through the browser, but the OAuth client secret must
not be printed in chat. Have the user enter it into a hidden terminal prompt and
store it in Secret Manager:

```bash
read -r -s OAUTH_CLIENT_SECRET
printf "%s" "$OAUTH_CLIENT_SECRET" | gcloud secrets create trellis-google-oauth-client-secret \
  --data-file=- \
  --replication-policy=automatic \
  --project="$PROJECT_ID"
unset OAUTH_CLIENT_SECRET
```

The OAuth client ID is not a secret and can be placed in `.env` and Cloud Run
environment variables.

## Phase 8: Environment Files

Start from the committed templates:

```bash
cp backend/api/.env.example backend/api/.env
cp backend/relay/.env.example backend/relay/.env
cp frontend/.env.example frontend/.env
```

Fill placeholders with non-secret values, local development values, and
placeholders for secrets that still need to be supplied. Do not commit generated
`.env` files and do not print their full contents in chat.

For local development, prefer the Docker PostgreSQL database and Application
Default Credentials:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/trellis_test
GCP_PROJECT_ID=<PROJECT_ID>
GCP_REGION=<REGION>
APP_ENV=development
GOOGLE_OAUTH_CLIENT_ID=<OAUTH_CLIENT_ID>
GOOGLE_OAUTH_CLIENT_SECRET=<LOCAL_ONLY_OAUTH_CLIENT_SECRET>
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/api/google/callback
OAUTH_TOKEN_ENCRYPTION_KEY=<LOCAL_ONLY_FERNET_KEY>
FRONTEND_BASE_URL=http://localhost:5173
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:5173
CRON_SECRET=<LOCAL_ONLY_RANDOM_VALUE>
HEALTH_CHECK_SECRET=<LOCAL_ONLY_RANDOM_VALUE>
```

Generate the local Fernet key with:

```bash
python3 -c 'import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())'
```

## Phase 9: Local Verification With Synthetic Data

Create and activate a local Python virtual environment before installing backend
dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

Install dependencies, start the local test database, and apply migrations.
Docker Desktop must be running before `make db-up`:

```bash
make install
make db-up
make db-reset
```

Run build and backend tests:

```bash
make test-build
make test-backend
```

Start the local services:

```bash
make dev
```

Open `http://localhost:5173`. Use synthetic test data only. Do not enter real
client data in local verification.

## Phase 10: Cloud Run Deployment

Before deploying, Codex must ask the user to confirm that local verification has
passed and that Cloud Run services should be created.

Build container images:

```bash
gcloud builds submit backend \
  --config=backend/cloudbuild-api.yaml \
  --substitutions=_REGION="$REGION",_REPO="$ARTIFACT_REPO" \
  --project="$PROJECT_ID"

gcloud builds submit backend \
  --config=backend/cloudbuild-relay.yaml \
  --substitutions=_REGION="$REGION",_REPO="$ARTIFACT_REPO" \
  --project="$PROJECT_ID"
```

Deploy the API first:

The first deploy may use temporary URL placeholders for CORS and OAuth because
Cloud Run URLs are not known until the services exist. Codex must update those
environment variables after the API and frontend URLs are captured.

```bash
export API_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/trellis-api:latest"

gcloud run deploy trellis-api \
  --image="$API_IMAGE" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --add-cloudsql-instances="$DB_CONNECTION_NAME" \
  --allow-unauthenticated \
  --set-env-vars="APP_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},DB_NAME=trellis,DB_USER=postgres,DB_CONNECTION_NAME=${DB_CONNECTION_NAME},GOOGLE_OAUTH_CLIENT_ID=<OAUTH_CLIENT_ID>,GOOGLE_OAUTH_REDIRECT_URI=<CLOUD_RUN_API_URL>/api/google/callback,ALLOWED_ORIGINS=<CLOUD_RUN_FRONTEND_URL>,FRONTEND_BASE_URL=<CLOUD_RUN_FRONTEND_URL>,APP_BASE_URL=<CLOUD_RUN_FRONTEND_URL>,API_BASE_URL=<CLOUD_RUN_API_URL>" \
  --set-secrets="DB_PASSWORD=trellis-db-password:latest,GOOGLE_OAUTH_CLIENT_SECRET=trellis-google-oauth-client-secret:latest,OAUTH_TOKEN_ENCRYPTION_KEY=trellis-oauth-token-encryption-key:latest,CRON_SECRET=trellis-cron-secret:latest,HEALTH_CHECK_SECRET=trellis-health-check-secret:latest,LOG_HASH_SECRET=trellis-log-hash-secret:latest" \
  --project="$PROJECT_ID"
```

Capture the deployed API URL, then update the Google OAuth redirect URI in the
Google Cloud Console:

```bash
export CLOUD_RUN_API_URL="$(gcloud run services describe trellis-api \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')"
```

Deploy the relay:

```bash
export RELAY_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/trellis-relay:latest"

gcloud run deploy trellis-relay \
  --image="$RELAY_IMAGE" \
  --region="$REGION" \
  --service-account="$SA_EMAIL" \
  --add-cloudsql-instances="$DB_CONNECTION_NAME" \
  --allow-unauthenticated \
  --set-env-vars="APP_ENV=production,GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION},DB_NAME=trellis,DB_USER=postgres,DB_CONNECTION_NAME=${DB_CONNECTION_NAME},API_BASE_URL=${CLOUD_RUN_API_URL},ALLOWED_ORIGINS=<CLOUD_RUN_FRONTEND_URL>" \
  --set-secrets="DB_PASSWORD=trellis-db-password:latest" \
  --project="$PROJECT_ID"
```

Capture the relay URL:

```bash
export CLOUD_RUN_RELAY_URL="$(gcloud run services describe trellis-relay \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')"
```

Build and deploy the frontend after the backend URLs are known:

```bash
gcloud builds submit frontend \
  --config=frontend/cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_REPO="$ARTIFACT_REPO",_VITE_FIREBASE_API_KEY="<FIREBASE_API_KEY>",_VITE_FIREBASE_AUTH_DOMAIN="${PROJECT_ID}.firebaseapp.com",_VITE_FIREBASE_PROJECT_ID="$PROJECT_ID",_VITE_FIREBASE_STORAGE_BUCKET="${PROJECT_ID}.firebasestorage.app",_VITE_FIREBASE_MESSAGING_SENDER_ID="<FIREBASE_MESSAGING_SENDER_ID>",_VITE_FIREBASE_APP_ID="<FIREBASE_APP_ID>",_VITE_FIREBASE_VAPID_KEY="<FIREBASE_VAPID_KEY>",_VITE_API_URL="$CLOUD_RUN_API_URL",_VITE_WS_URL="$CLOUD_RUN_RELAY_URL" \
  --project="$PROJECT_ID"

export FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/trellis-frontend:latest"

gcloud run deploy trellis-frontend \
  --image="$FRONTEND_IMAGE" \
  --region="$REGION" \
  --allow-unauthenticated \
  --project="$PROJECT_ID"
```

After the frontend URL is known, update:

- API `ALLOWED_ORIGINS`, `FRONTEND_BASE_URL`, and `APP_BASE_URL`.
- Relay `ALLOWED_ORIGINS`.
- Firebase Authentication authorized domains.
- Google OAuth redirect URI if the API URL changed.

```bash
export CLOUD_RUN_FRONTEND_URL="$(gcloud run services describe trellis-frontend \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)')"

gcloud run services update trellis-api \
  --region="$REGION" \
  --update-env-vars="ALLOWED_ORIGINS=${CLOUD_RUN_FRONTEND_URL},FRONTEND_BASE_URL=${CLOUD_RUN_FRONTEND_URL},APP_BASE_URL=${CLOUD_RUN_FRONTEND_URL},API_BASE_URL=${CLOUD_RUN_API_URL},GOOGLE_OAUTH_REDIRECT_URI=${CLOUD_RUN_API_URL}/api/google/callback" \
  --project="$PROJECT_ID"

gcloud run services update trellis-relay \
  --region="$REGION" \
  --update-env-vars="ALLOWED_ORIGINS=${CLOUD_RUN_FRONTEND_URL},API_BASE_URL=${CLOUD_RUN_API_URL}" \
  --project="$PROJECT_ID"
```

## Phase 11: Scheduler And Production Checks

Create Cloud Scheduler jobs only after the API health check passes. Cron
endpoints require the `X-Cron-Secret` header. Codex should avoid printing the
secret and should create jobs from shell variables or Secret Manager values.

Production checks before real client data:

- `APP_ENV=production` is set for deployed services.
- `DEV_MODE` is not set.
- CORS origins are exact HTTPS frontend origins.
- Secrets are in Secret Manager, not repo files.
- Cloud SQL backups are enabled.
- Firebase Authentication providers and authorized domains are correct.
- Google OAuth redirect URIs are correct.
- Sign-in, intake, scheduling, Google account connection, document signing,
  note generation, billing export, and audit logging have been smoke-tested with
  synthetic data.
- HIPAA self-hosting responsibilities have been reviewed.

## Codex Security Audit

After local verification and again before handling real client data, ask Codex:

```text
Run a full Trellis security audit using docs/agents/code-quality-security-agent.md
and docs/agents/hipaa-audit-agent.md.
```

Codex should inspect the local instance, run non-destructive checks where
available, avoid printing secrets or PHI, and return prioritized findings with
evidence and remediation steps.

## Development Commands

```bash
make install
make dev
make dev-api
make dev-relay
make dev-frontend
make db-up
make db-reset
make test-build
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

## Reference Links

- Google Cloud CLI project creation: https://cloud.google.com/sdk/gcloud/reference/projects/create
- Google Cloud CLI billing link: https://cloud.google.com/sdk/gcloud/reference/billing/projects/link
- Firebase with an existing Google Cloud project: https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project
- Firebase CLI reference: https://firebase.google.com/docs/cli
- Cloud SQL Auth Proxy for PostgreSQL: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy
- Artifact Registry Docker images: https://cloud.google.com/artifact-registry/docs/docker/store-docker-container-images

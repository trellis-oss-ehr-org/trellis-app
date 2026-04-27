# Trellis

MIT-licensed, open-source, AI-native EHR for solo behavioral health therapists. Automates the full clinical workflow: client intake via AI voice agent, scheduling, session recording, note generation, and billing document generation.

## Features

- **AI Voice Intake** — Gemini Live-powered conversational intake that collects clinical history, demographics, and insurance info
- **Scheduling** — Availability management, client self-booking, Google Calendar sync, appointment reminders
- **Session Recording** — In-browser audio recording with automatic transcription
- **Note Generation** — AI-generated SOAP/DAP/narrative clinical notes from session transcripts
- **Treatment Plans** — AI-assisted treatment plan creation with goals, objectives, and interventions
- **Document Management** — Consent forms, HIPAA notices, and e-signatures
- **Billing** — Superbill generation, CMS-1500 forms, and 837P export
- **Client Portal** — Clients can view appointments, sign documents, and complete intake
- **HIPAA-oriented safeguards** — Audit logging, encryption at rest/in transit, session timeouts, role-based access

Trellis is designed to support HIPAA-regulated use when deployed and operated appropriately in a practice-controlled Google Cloud environment with the practice's own Google BAA. HIPAA compliance still depends on the practice's deployment, configuration, policies, risk analysis, workforce procedures, and any modifications made under the MIT license.

See [HIPAA Engineering Notes](docs/hipaa-engineering-notes.md) for implementation safeguards, production deployment checks, and operational controls that must be handled outside the codebase. The hosted texting add-on flow is documented in [Texting BAA and Stripe Flow](docs/texting-baa-stripe-flow.md), with [Texting Support SOP](docs/texting-support-sop.md), [Texting Launch Checklist](docs/texting-launch-checklist.md), and [Texting Remaining Work](docs/texting-remaining-work.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS v4 |
| Backend API | Python 3.12, FastAPI |
| Voice Relay | Python 3.12, FastAPI WebSocket, Gemini Live |
| Database | PostgreSQL 15 (Cloud SQL) |
| Auth | Firebase Authentication |
| AI | Gemini Live (voice), Gemini 2.5 Flash (notes, vision) |
| Integrations | Google Calendar, Meet, Docs, Drive, Gmail |
| Infrastructure | Google Cloud Run, Cloud Build, Cloud Scheduler |

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- Google Cloud account with a project
- Firebase project

### Setup

The easiest way to set up Trellis is with [Claude Code](https://claude.com/claude-code). Open the repo and say **"Set up Trellis"** — the AI will walk you through every step, create all config files, and deploy everything for you. The full setup guide is in [CLAUDE.md](CLAUDE.md).

### Manual Setup

If you prefer to set things up manually, follow the phases in [CLAUDE.md](CLAUDE.md):

1. **GCP Project** — Create a project and enable APIs
2. **Database** — Provision Cloud SQL PostgreSQL and run migrations
3. **Service Account** — Create and configure IAM roles
4. **Firebase Auth** — Enable Google and email/password sign-in
5. **Google OAuth** — Set up per-user account connection for Calendar/Gmail
6. **Environment** — Create `.env` files for each service
7. **Run Locally** — `make install && make dev`
8. **Deploy** — Build with Cloud Build, deploy to Cloud Run

### Development

```bash
make install          # Install all dependencies
make db-up            # Start local Postgres test database
make db-reset         # Reset local test database and apply migrations
make dev              # Start all services (API :8080, Relay :8081, Frontend :5173)
make dev-api          # Start API only
make dev-relay        # Start relay only
make dev-frontend     # Start frontend only
```

### Backend Tests

Backend tests use a local Docker Postgres database named `trellis_test` and synthetic test data only.

```bash
make test-backend
```

This starts Postgres, drops/recreates the local test schema, applies `db/migrations/*.sql`, and runs `tests/backend`. To run against an already-provisioned database, set `DATABASE_URL` and use `make test-backend-existing-db`.

## Architecture

```
trellis/
├── frontend/              # React SPA
│   └── src/
│       ├── pages/         # Route-level components
│       ├── components/    # Shared + feature components
│       ├── hooks/         # Auth, API, session hooks
│       └── templates/     # Document templates (consent, HIPAA)
├── backend/
│   ├── api/               # FastAPI REST API (port 8080)
│   ├── relay/             # Gemini Live voice relay (port 8081)
│   └── shared/            # Shared: db, integrations, utilities
└── db/migrations/         # SQL migrations
```

## License

[MIT](LICENSE)

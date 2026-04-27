.PHONY: dev dev-frontend dev-api dev-relay install db-up db-wait db-migrate db-reset db-down test-build test-backend test-backend-existing-db test-e2e audit-deps test-all

COMPOSE ?= docker compose
TEST_DATABASE_URL ?= postgresql://postgres:password@localhost:5432/trellis_test

# Run Vite dev server
dev-frontend:
	cd frontend && npm run dev

# Run API with uvicorn (auto-reload)
dev-api:
	cd backend/api && uvicorn main:app --reload --port 8080

# Run relay with uvicorn (auto-reload)
dev-relay:
	cd backend/relay && uvicorn main:app --reload --port 8081

# Run all three services (requires terminal multiplexing)
dev:
	@echo "Starting all services..."
	@make dev-api & make dev-relay & make dev-frontend

# Install all dependencies
install:
	cd frontend && npm install
	cd backend/api && pip install -r requirements.txt
	cd backend/relay && pip install -r requirements.txt

# Start local Postgres for backend tests. This database is for synthetic test data only.
db-up:
	$(COMPOSE) up -d db

# Wait until the local test database accepts connections.
db-wait:
	@echo "Waiting for local test database..."
	@for i in $$(seq 1 30); do \
		if $(COMPOSE) exec -T db pg_isready -U postgres -d trellis_test >/dev/null 2>&1; then \
			echo "Local test database is ready."; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "Local test database did not become ready."; \
	exit 1

# Apply all SQL migrations to the local test database.
db-migrate: db-wait
	@for f in db/migrations/*.sql; do \
		echo "Applying $$f"; \
		$(COMPOSE) exec -T db psql -U postgres -d trellis_test -v ON_ERROR_STOP=1 < "$$f"; \
	done

# Drop and recreate the local test schema, then apply migrations.
db-reset: db-wait
	$(COMPOSE) exec -T db psql -U postgres -d trellis_test -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
	$(MAKE) db-migrate

# Stop the local test database.
db-down:
	$(COMPOSE) down

# Verify all services compile/build without errors
test-build:
	@echo "=== Frontend TypeScript check ==="
	cd frontend && npx tsc --noEmit
	@echo "=== Frontend Vite build ==="
	cd frontend && npm run build
	@echo "=== Backend API import check ==="
	cd backend/api && python -c "from main import app; print(f'{len(app.routes)} routes OK')"
	@echo "=== Backend Relay import check ==="
	cd backend/relay && python -c "from main import app; print('Relay OK')"
	@echo "All builds passed."

# Run backend pytest suite
test-backend: db-up db-reset
	cd backend/api && DATABASE_URL="$(TEST_DATABASE_URL)" python -m pytest ../../tests/backend/ -v --tb=short

# Run backend pytest suite against an already-provisioned DATABASE_URL.
test-backend-existing-db:
	cd backend/api && python -m pytest ../../tests/backend/ -v --tb=short

# Run Playwright E2E tests (requires services running)
test-e2e:
	cd frontend && npx playwright test --reporter=list

# Audit dependency manifests. Requires `pip install pip-audit`.
audit-deps:
	cd frontend && npm audit --omit=dev
	cd backend/api && python -m pip_audit -r requirements.txt
	cd backend/relay && python -m pip_audit -r requirements.txt

# Run all tests
test-all: test-build test-backend test-e2e

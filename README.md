# WAKA Management Platform — Phase 1 POC

A functional, portable proof of concept for WAKA's three-branch gym operation
in Kigali, Rwanda. It connects staff registration, credential activation,
branch check-in, member renewal, notification failure recovery, offline gate
simulation and fictional CSV migration.

**This is not a production access-control system. All payment, messaging,
reader and speedgate interactions are SIMULATED. Fitbase import uses SAMPLE
DATA. Hardware compatibility and Fitbase export/API availability are unconfirmed.**

Only **Branch 1 — Gated Branch** has a simulated speedgate.
**Branch 2 — Reception Branch** and **Branch 3 — Reception Branch** do not.

## Stack and structure

- Frontend: Next.js, React, TypeScript, React Query.
- Backend: Python 3.12, FastAPI, SQLAlchemy.
- Database: PostgreSQL; standard `DATABASE_URL`, no proprietary database SDK.
- Authentication: simple portable database-backed sessions, HTTP-only cookies,
  salted password hashing and server-enforced role permissions.
- API contract: OpenAPI with generated TypeScript hooks.
- Future automation: n8n consumes events; never makes core access decisions.

```text
artifacts/waka/           Next.js frontend (the /frontend equivalent)
backend/                 FastAPI, SQLAlchemy, auth and business services
database/                initial schema reference and sample CSV
lib/api-spec/            OpenAPI frontend contract
lib/api-client-react/    generated typed frontend API hooks
docs/                    architecture, demo narrative, portability notes
deploy/nginx.conf        same-origin frontend/API reverse proxy
scripts/                 development and export helper commands
backend/Dockerfile       Python image
Dockerfile.frontend      Next.js image
docker-compose.yml       standalone PostgreSQL/API/frontend/proxy
.env.example             configuration names, no real credentials
```

The supplied monorepo structure is retained to keep preview tooling intact.
The original Express/Drizzle packages are scaffolding, not a second WAKA
backend. WAKA uses FastAPI/SQLAlchemy/PostgreSQL exclusively.

## Quick demonstration

Open the app, choose a demo role and sign in. Demo accounts are public
fictional test identities, not real WAKA accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@waka.demo` | `WakaDemo2026!` |
| Management | `management@waka.demo` | `WakaDemo2026!` |
| Reception | `reception@waka.demo` | `WakaDemo2026!` |
| Member: Aline | `aline@waka.demo` | `WakaDemo2026!` |
| Member: Eric | `eric@waka.demo` | `WakaDemo2026!` |

These accounts are accepted only while demo mode is enabled outside the
production environment. They are intentionally unsuitable for a public
production deployment. Registration creates distinct member records.

The hosted POC's API launch configuration uses `ENVIRONMENT=demo`,
`DEMO_MODE=true` and `COOKIE_SECURE=true` so demo accounts work over HTTPS.
Keep this demonstration deployment password-protected and use fictional data
only. A real production rollout must instead use `ENVIRONMENT=production`
and `DEMO_MODE=false`, with separately provisioned accounts.

See [the ten-step demo guide](docs/demo-guide.md) for a reproducible narrative.
Initial scenarios: Aline active/no card/expiry in 7 days; Eric expired with a
card; Patrick active with a card; Alice has a disabled card; Kevin active with
a card. Dates are anchored to the Kigali calendar day at seed time. Metrics
come from actual persisted fictional records, not hardcoded UI totals.

## Development

Prerequisites: Node.js 24, pnpm, Python 3.12 and PostgreSQL.

```sh
corepack enable
pnpm install --frozen-lockfile
pip install -r backend/requirements.txt
# Configure DATABASE_URL in your shell/environment, not source code.
python -m backend.migrate
python -m backend.seed
```

Run the API:

```sh
PORT=8080 python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080
```

Run the frontend:

```sh
PORT=3000 pnpm --filter @workspace/waka run dev
```

The app uses same-origin `/api` URLs and HTTP-only session cookies. In the
development preview, routing is managed for you. Outside that preview, put
both services behind the included Nginx configuration or an equivalent
same-origin proxy. Do not change browser calls to hardcoded localhost URLs.
Docker Compose provides this arrangement at `http://localhost:8088`.

When changing the API contract:

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
pnpm --filter @workspace/waka run typecheck
python -m compileall -q backend
```

FastAPI validates runtime requests; generated Zod code is retained for the
monorepo contract tooling, not used as the Python runtime validator.

## Database setup and seed

```sh
python -m backend.migrate       # explicit, idempotent initial schema creation
python -m backend.seed          # only seeds an empty WAKA dataset
python -m backend.seed --reset  # destructive: deletes WAKA demo records!
```

Normal API startup does not create schema or reseed. The initial POC migration
uses SQLAlchemy metadata. It is **not** an automatic upgrade tool for future
column changes; add reviewed, versioned Alembic revisions before schema
evolution or production rollout. See `database/README.md`.

The in-app reset requires ADMIN, demo mode and explicit `RESET` confirmation.
It also changes the demo generation so old offline batches cannot be replayed
against newly seeded records. Do not mix this dataset with real member data.

## Standalone Docker POC

Docker files target an ordinary Linux workstation/VPS. Docker is not required
or run inside the development preview.

```sh
git clone <your-repository>
cd <your-repository>
cp .env.example .env
# Set POSTGRES_PASSWORD to your own long random value before continuing.
docker compose up -d --build
```

Open `http://localhost:8088`. The one-shot `initialize` service creates the
initial schema and seeds only if empty; the API starts after it completes.
PostgreSQL uses a persistent named volume. There is no external integration
account requirement.

```sh
docker compose logs -f backend
docker compose exec backend python -m backend.seed
docker compose exec backend python -m backend.seed --reset  # destructive
docker compose down           # keeps database volume
# DO NOT add -v unless you intend to erase the entire database volume.
```

The Docker setup is provided for export and has not been executed in this
development environment. Validate it on the intended host before a demo or
release. It defaults to **demo**, not hardened production.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Required PostgreSQL connection string |
| `PORT` | Service listening port |
| `DEMO_MODE` | Enable fictional demo logins and reset; POC defaults true |
| `ENVIRONMENT` / `APP_ENV` | Runtime mode; `production` rejects seeded demo logins |
| `COOKIE_SECURE` | Use secure session cookies behind HTTPS |
| `FRONTEND_URL` | Canonical frontend origin for configuration/proxy planning |
| `POSTGRES_PASSWORD` | Compose-only database password |
| `HTTP_PORT` | Compose public port (default 8088) |
| `PAYMENT_PROVIDER_MODE` | Documentation/config boundary; only simulated implemented |
| `MESSAGING_PROVIDER_MODE` | Documentation/config boundary; only simulated implemented |
| `GATE_PROVIDER_MODE` | Documentation/config boundary; only simulated implemented |
| `APP_SECRET` | Reserved; opaque stored sessions do not require a signing secret |
| `WEBHOOK_SECRET` | Reserved for a future signed n8n webhook adapter |

Setting a provider mode to another string does not connect a real service.
No real provider credentials exist in this POC. Keep `.env` and all secrets
out of Git.

Health endpoints:

- `GET /health` or `/api/healthz`: process health.
- `GET /health/db` or `/api/health/db`: database reachability.
- `GET /api/session`: signed-in identity (null if signed out).
- `GET /api/public`: public plan and branch data.

## Simulated service behavior

- Card detection and confirmation are separate. The card becomes active when
  its distinct credential record is committed, not when animation completes.
- Access checks validate card state and membership start/end/status. Denials
  are stored too.
- Renewals record a SIMULATED payment and extend expiry atomically; access
  updates from the same source of truth.
- Reminder scenarios record failed WhatsApp attempts, SMS fallback, and a
  final contacted/staff-follow-up outcome. No message is sent.
- Offline Branch 1 access uses a browser snapshot and a persistent local queue.
  It does not claim physical hardware or full offline web-app support.
- CSV migration parses data, validates and maps records; no Fitbase API call
  is made. The dynamic sample download has dates suited to the current demo.

See [architecture and future integrations](docs/architecture.md) and
[API behavior](docs/api-behavior.md).

## Production deployment outline and limitations

Before accepting real personal data, payments or physical access decisions:

1. Confirm reader/card/controller compatibility and safety requirements.
2. Disable demo mode, remove test accounts/data, provision real staff securely,
   add password recovery, rate limiting, MFA as appropriate and session review.
3. Add versioned migrations, backups, restore drills and audit retention.
4. Terminate TLS, enable secure cookies, restrict trusted proxy headers and
   allowed origins; configure real secrets outside Git.
5. Implement provider adapters with signed callbacks and idempotency.
6. Replace browser offline simulation with a secured branch-local service.
7. Add pagination, branch-scoped permissions, monitoring, automated regression
   tests, load testing, deployment checks and operational runbooks.
8. Establish privacy/consent/retention and a reviewed real-data migration plan.

The public website's coaches, stories, prices and photos are illustrative.
This POC has no trainer scheduling, payroll, inventory, accounting suite,
biometrics, real payment collection, production messaging, or confirmed gate
control. No Replit infrastructure is required for the exported runtime.
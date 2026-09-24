# WAKA Management Platform — Phase 1 POC

Portable gym management demonstration for three branches in Kigali.
The full user-facing specification is in README.md and docs/.

## Runtime

- Frontend: Next.js in `artifacts/waka`, `pnpm --filter @workspace/waka run dev`.
- Backend: FastAPI in `backend`; the API artifact's package script launches it.
- Database: PostgreSQL via SQLAlchemy and `DATABASE_URL`.
- `python -m backend.migrate` creates initial schema explicitly.
- `python -m backend.seed` seeds only empty data; `--reset` is destructive.
- `pnpm --filter @workspace/api-spec run codegen` regenerates API hooks.
- `pnpm --filter @workspace/waka run typecheck` checks frontend.
- `python -m compileall -q backend` checks Python compilation.

## Project constraints

- Production will be exported and run on an ordinary VPS/cloud server.
  Do not introduce a dependency on Replit auth or proprietary runtime services.
- Keep the supplied pnpm monorepo paths; Next.js is the frontend and FastAPI
  is the sole WAKA business backend. Do not add logic to the unused Express
  or Drizzle scaffold.
- Only Branch 1 has a simulated speedgate. Branches 2 and 3 are reception-only.
- Never use real member data. All integrations in Phase 1 are simulated.
- Clearly label simulated payment, messaging, readers, gates and sample import.
- Gate/controller/card compatibility and Fitbase export availability remain
  unconfirmed. Do not imply hardware has been integrated.
- Core membership/access decisions cannot depend on n8n availability.
- All REST URLs are same-origin `/api`; preview router and Docker Nginx route
  to FastAPI. Do not add localhost frontend API rewrites.
- The browser offline controller is only a simulation, not a physical device
  or a fully offline-capable web application.

## Configuration and data

See `.env.example` and README. Demo logins use fictional public credentials
and are rejected by the backend in production/non-demo mode. Production
requires separate real account provisioning and security hardening.

The password-protected hosted POC is deliberately a demo deployment:
`ENVIRONMENT=demo`, `DEMO_MODE=true`, and `COOKIE_SECURE=true`.
Do not label its API runtime `production` while expecting seeded demo logins
to work; the production login restriction is intentional. Keep that restriction
for real deployments, and use only fictional data in the hosted demo.

WAKA SQLAlchemy models own persistence. Do not run Drizzle schema push.
Initial migration is explicit metadata creation, not a schema-upgrade engine;
add Alembic revisions for future schema changes. Do not automatically reset
data after edits or on startup.

## Documentation

- `docs/demo-guide.md`: ten-step live presentation.
- `docs/api-behavior.md`: exact action request behavior.
- `docs/architecture.md`: boundaries, future integration and offline caveats.
- `docker-compose.yml`: standalone POC runtime; not executed inside Replit.
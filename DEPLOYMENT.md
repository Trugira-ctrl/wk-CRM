# WAKA portable deployment guide

This is a stabilized POC, **not approved for production use**. Real providers,
production account provisioning and target infrastructure acceptance remain open.
No release is automatic. Export/push the stabilization branch to your Git host,
review changes and require tests + staging approval before a production release.

## Local preparation
Use Python 3.12, Node 24, pnpm 10.26.1 and PostgreSQL 17 (16+ expected, not tested).
No Replit service is required after export.
```
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm install --frozen-lockfile
pip install -r backend/requirements.txt
```
Configure DATABASE_URL via your server's secret manager or protected environment.
For development/demo only, set ENVIRONMENT=demo, DEMO_MODE=true. Configure
COOKIE_SECURE=true when using HTTPS (false only for local HTTP).

For production, set ENVIRONMENT=production, DEMO_MODE=false,
COOKIE_SECURE=true, DATABASE_URL to PostgreSQL, and ALLOWED_ORIGINS to the exact
approved HTTPS website origin(s), comma separated. No wildcard is supported.
PORT controls each process's listener. FRONTEND_URL is informational; browser
calls use same-origin /api, with Nginx forwarding to FastAPI.

DB_POOL_SIZE=5, DB_MAX_OVERFLOW=10, DB_POOL_TIMEOUT=10 are per-process defaults.
Account for all worker replicas when sizing against PostgreSQL's connection cap.
Admission is bounded to at most 12 requests or the configured pool capacity.
Statements/locks have timeouts. Do not scale replicas without staging load tests.

Session authentication uses random opaque tokens hashed in PostgreSQL, not JWTs;
SESSION_SECRET is not consumed. Do not invent a placeholder signing secret.
Payment/messaging/gate mode variables are reserved/documentary: no real providers
are implemented; production simulations fail closed regardless of their values.
No optional webhook endpoint exists.

## Migrations
Back up first and pause writes for schema changes. Test against an isolated copy.
```
python -m backend.migrate
```
Alembic 0001 adopts the original POC schema without rewriting records; 0002 adds
purchase identities and indexes. Repeat execution is safe. Do not stamp an
arbitrary schema to head. There are deliberately no destructive downgrades:
restore a tested backup or apply a reviewed forward migration.
For a genuinely empty **demo** database only:
```
python -m backend.seed
```
Never run `--reset` on member data. Normal startup never seeds or resets.

## Build and run without containers
```
pnpm --filter @workspace/waka run build
PORT=3000 pnpm --filter @workspace/waka run serve
PORT=8080 python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080
```
Use a process supervisor and Nginx/TLS in an approved staging deployment.
Keep PostgreSQL and the backend on a private network. The included Nginx file is
HTTP-only; terminate HTTPS with an AWS load balancer or configure Nginx TLS before
using production cookies. Do not expose the backend directly to the internet.

## Container verification — NOT EXECUTED HERE
Use a Docker-capable machine/CI with credentials managed outside Git.
Set POSTGRES_PASSWORD to a securely generated, URL-safe value; never use the CI
fictional placeholder for a server. Set the environment values described above.
```
docker compose config --quiet
docker buildx build --platform linux/amd64 -f Dockerfile.frontend --load -t waka-web:test .
docker buildx build --platform linux/arm64 -f Dockerfile.frontend -t waka-web:arm-test .
docker buildx build --platform linux/amd64,linux/arm64 -f backend/Dockerfile .
docker compose up --build -d
docker compose logs --tail=100 backend frontend initialize
curl --fail http://localhost:8088/api/healthz
curl --fail http://localhost:8088/api/health/db
```
Repeat native frozen install/build on macOS if that is a supported developer
platform. CI builds both Linux architectures but a configured workflow is not a
passed run. In an isolated staging database, create a fictional member, restart
db/backend containers, and verify the record survives. Never use `down -v` on a
database you need to keep.

## Tests
```
DATABASE_URL=sqlite:// ENVIRONMENT=test DEMO_MODE=true python -m unittest backend.test_regressions backend.test_stabilization.StabilizationTests -v
python scripts/isolated_postgres.py
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/waka run typecheck
pnpm --filter @workspace/waka run build
```
The PostgreSQL harness requires initdb/pg_ctl/createdb on PATH and creates a
temporary local cluster; it refuses an external database. Do not stress-test the
published application. CI does not auto-publish or deploy.

## Backup and recovery
WAKA must designate an operator and approve retention/RPO/RTO. Recommended starting
policy for review: daily encrypted off-host backups, 30 daily copies, regular
restore drills; enable managed PostgreSQL PITR for a shorter recovery window.
Do not copy real member data into development.

With libpq credentials supplied securely (for example protected PGPASSFILE),
use PGHOST/PGUSER/PGDATABASE and:
```
pg_dump --format=custom --file=/secure-backups/waka.dump
pg_restore --list /secure-backups/waka.dump
# Restore into a NEW, empty recovery database, never over live data:
createdb waka_recovery
pg_restore --exit-on-error --no-owner --dbname=waka_recovery /secure-backups/waka.dump
```
pg_dump provides a consistent database snapshot; backup roles separately if
required. Encrypt and copy backups off the server with restricted access,
verify checksums, and alert on backup failure. A backup on the same disk is
insufficient. Restore-drill acceptance includes migrations, login, row counts,
revenue reconciliation and entitlement samples before switching traffic.
These commands are documentation, not configured external backups.

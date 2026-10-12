# WAKA corrected architecture

```
Browser: Next.js website / member portal / staff operations
             | same-origin /api, opaque HttpOnly session cookie
Reverse proxy (Nginx configuration; target deployment unverified)
             |
FastAPI: bounded request admission, session + role validation
  |-- Membership service: member row lock → payment + entitlement + operation + audit
  |-- Reporting: database aggregates, separate paginated payment display
  |-- Demo offline ingestion: validated per-event savepoints + UUID deduplication
             |
PostgreSQL / SQLAlchemy / versioned Alembic migrations
```

Implemented: server-side membership/role enforcement, demo operations and
persistence, retry identities, reporting, health checks, isolated test harness.
Simulated: payments, notification recovery, readers/speedgates, controller state,
browser offline cache and sample Fitbase import. None becomes real in production.
Future: verified payment providers, installed branch controller, real import
adapter, signed controller authentication and external event delivery.

Three branches; only Branch 1 gated. Branches 2/3 use reception flows. No Replit
runtime service is required by the deployed Next.js/FastAPI/PostgreSQL stack.

Core writes and audit records commit together. Future n8n delivery should use a
transactional outbox with event ID, schema version, entity ID, occurred_at,
payload and delivery attempts; consumers deduplicate event IDs. An outbox worker
can retry signed deliveries after commits. Existing audit records alone do not
guarantee delivery; no dispatcher is implemented. n8n must never decide entry or
grant paid entitlement.

For real purchases, verify provider signatures/server-side payment status and
uniquely constrain provider transaction IDs before applying entitlement in the
same transaction. Browser idempotency keys are not proof of payment.

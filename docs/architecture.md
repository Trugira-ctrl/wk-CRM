# Architecture and integration boundaries

## System of record

```text
Next.js + TypeScript browser UI
             | same-origin REST /api, HTTP-only cookie
             v
FastAPI business services ----- PostgreSQL (SQLAlchemy)
             |
             +----- persisted system_events (audit / future outbox)

Branch 1 browser-based controller SIMULATOR
  synchronized credential snapshot -> local validation -> queued UUID events
                                             |
                                      restore + idempotent sync

Branch 2 and Branch 3: reception check-in only; no gates.
```

The `artifacts/waka` package is the frontend; `backend` is the independent
Python service. `lib/api-spec` defines frontend REST contracts and generates
TypeScript hooks. The pre-existing Express and Drizzle scaffold is not used
for WAKA business logic or persistence. Its API workspace package now launches
FastAPI for preview routing. It may be removed after export if nothing else
uses it. The mockup sandbox is unrelated to the runnable WAKA app.

All entities are relational: users, members, branches, plans, memberships,
credentials, payments, access events, notification events, migration records,
system events, sessions and demo settings. Credentials do not live on member
rows. Normalized relationships permit multiple credential types per member.
Monetary amounts represent whole Rwandan francs, not USD or fractional RWF.
Membership business dates are evaluated in Africa/Kigali.

## Ownership and authorization

HTTP-only sessions are stored as hashed tokens in the database. Passwords use
salted PBKDF2 hashing. No Replit authentication or hosted identity service is
required. API routes enforce roles independently of navigation:

| Capability | ADMIN | MANAGEMENT | RECEPTION | MEMBER |
|---|---|---|---|---|
| Operational membership/check-in data | Yes | Yes | Yes | Own only |
| Registration, cards, staff check-in | Yes | Yes | Yes | No |
| Renewal | Yes | Yes | Yes | Own only |
| Reminder/controller scenarios | Yes | Yes | Yes | No |
| CSV migration, plans, reset | Yes | No | No | No |

The broad reception operational visibility is intentional for the POC.
Before production, scope staff to branches and minimize personal data.
There is no password-reset email provider in this version.

## n8n, later

Core membership and access decisions never depend on n8n.
System events provide traceability and a starting point for an outbox:

```text
FastAPI transaction
  -> business event + committed membership/payment/access record
  -> future outbox dispatcher
  -> signed webhook
  -> n8n
  -> notification provider / retries / channel fallback / staff alert
```

Examples:

- `member.created` -> welcome/onboarding.
- `membership.created` -> plan information.
- `membership.expiring` -> WhatsApp attempt -> retry -> SMS -> staff follow-up.
- `membership.expired` -> reactivation reminder.
- `membership.renewed` -> confirmation.
- `payment.completed` -> receipt.
- `payment.failed` -> recovery instructions.
- `member.inactive` -> retention campaign.
- `access.denied` -> operational investigation.
- `branch.controller.offline` -> technical alert.
- `notification.failed` -> retry policy and escalation.

These are the intended event vocabulary, not a claim that every scheduled
producer or webhook exists. Phase 1 records events and runs deterministic,
manually triggered messaging scenarios. It does not schedule real delivery.

A production dispatcher needs stable event IDs, delivery state, attempt count,
backoff, deduplication, dead-letter handling, and HMAC signatures using a
`WEBHOOK_SECRET` configured outside source control. Commit business changes
before delivering webhooks. n8n downtime must not prevent check-in or renewal.

## Payments, later

All POC payment records use SIMULATED. The amount and plan duration are chosen
server-side. Renewal and its payment are committed together. There are no
payment credentials or external requests.

A real adapter must validate provider signatures, amounts, currency, account,
and references; implement idempotency and refunds/reconciliation. Do not
activate membership merely because a browser claims payment success.

## Reader and gate investigation, later

The UI models a UID association, not a compatibility certification. Confirm:

1. Card frequency/protocol, UID stability and card security.
2. Reader interface (USB, serial, Wiegand, OSDP, vendor API).
3. Controller model, firmware, relay protocol and local SDK availability.
4. Gate safety circuits, emergency egress and fire-system behavior.
5. Vendor licensing, supported local operation and offline storage.

A UID alone is not a cryptographic identity and may be clonable. Choose an
appropriate credential security model before connecting physical gates.

## Offline simulation boundary

Only Branch 1 has a local-access demonstration. The browser freezes a
credential/membership snapshot when the simulated internet outage begins.
Decisions use that snapshot and current membership dates. Events queue locally
with UUIDs and occurrence timestamps. Restoration submits batches; the server
deduplicates IDs and the UI clears only acknowledged records.

This demonstrates intended behavior; it is not a production access controller
and does not guarantee that the whole web application starts without internet.
Browser storage can be cleared or modified and the demo client is trusted.
Changes made in the cloud while disconnected (revoked cards, renewals, new
members) cannot affect a disconnected snapshot until synchronization.

Real hardware needs an installed local service, encrypted durable cache,
authenticated/signed policy snapshots and event batches, a maximum cache age,
trusted time, revocation reconciliation, fail-safe policy, device keys,
monitoring and a secured synchronization protocol. n8n must remain outside the
access-critical path.

## Fitbase migration boundary

The sample CSV is fictional and is parsed by the server. Export/API availability
in Fitbase has not been confirmed. Source IDs are mapped to WAKA IDs; duplicates
are rejected/skipped rather than overwriting existing member records.
No payment is invented when importing a membership.

Before a real migration, confirm lawful data access, export format, field
semantics, consent, encoding, timezone, status rules, duplicate resolution and
data retention. Rehearse with sanitized records, reconcile totals, back up both
systems and agree a cutover/rollback plan.
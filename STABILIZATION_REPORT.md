# WAKA stabilization — 2026-10-13

Status: **IMPLEMENTED WITH VERIFICATION GAPS — not overall COMPLETE.**
Changes are on `fix/waka-poc-stabilization`. No merge, publication, real payment,
message, hardware operation, or reset was performed.

## Stage 1: financial correctness and security
Renewals previously read entitlement and appended purchases without serializing
concurrent readers. They now lock the stable member row, re-read entitlement,
and commit payment, membership, operation identity and audit together.
The unique member/idempotency-key pair returns the original result on replay;
different payloads under the same key are rejected. The browser preserves a key
across retries/reloads until confirmation. Two confirmed purchases get two keys.
Failed simulated payments are recorded without granting access.

Public Join uses a strict model, rejects date/role overrides, and derives dates
from the plan. Production/non-demo mode fails closed for simulated activation,
renewals, migration, notifications and gate/check-in simulations. No fake real
payment webhook was added. Seed-account sessions are rechecked on every request.
Only administrators may adjust entitlement; administrative writers use the same
member lock. Production configuration rejects demo mode, insecure cookies and
missing approved HTTPS origins. It does not trust forwarded host headers for
production origin authorization.

Important files: backend/renewals.py, requests.py, security.py, services.py,
config.py, models.py; renewal UI and lib/renewal-key.ts.

Policy assumption: Kigali date-only validity is **inclusive**. A new 30-day
purchase ends at start + 29 days. Active renewal adds the purchased duration to
the existing end; expired renewal starts today. Existing records are not rewritten.
Paused/non-active exceptional memberships require review. Business approval of
exceptional adjustments remains necessary.

## Stage 2: offline reliability
Unknown-card denials previously failed because member_id was mandatory.
Per-record validation now accepts nullable members only for denials; savepoints
isolate malformed items, UUID uniqueness prevents duplicate insertion, and replay
checks compare the immutable event. Partial responses identify acknowledged and
rejected records. The browser removes only acknowledged records and sends at most
200 per batch. Network failure leaves the queue intact.

Important files: backend/offline.py, gate/page.tsx, OpenAPI/generated clients.
POC cache policy: maximum 24 hours, deny on missing timestamps or obvious backward
clock movement, check local membership dates/card status on every tap. A card
revoked centrally after caching cannot be known until reconnection. Renewals
during outages likewise require cache refresh. Browser clocks/storage remain
untrusted: this endpoint is demo-only, not a physical-controller trust boundary.
Startup without the backend is NOT supported; local storage is not an installed
controller. No n8n or notification service participates in access decisions.

## Stage 3: reporting and performance
Revenue was summed from a capped display list. It now uses SQL over all matching
successful RWF simulator payments for the Kigali day; production cannot count
simulator revenue. Existing amounts remain integer-valued Numeric(12,0).
Payment history has a separate role-scoped, bounded pagination endpoint and UI.
No date/branch/plan reporting filters existed here; new filter interfaces were not
invented. Workspace member/notification lists remain unbounded (see backlog).

The HTTP test reproduced pool starvation even though service-only tests passed:
auth dependencies could retain connections while other synchronous workers
waited. Admission is now bounded before worker dispatch, authentication releases
its read transaction, and workspace releases its connection before serialization.
Pool settings are configurable, not increased. Database failures return sanitized
503s; mutation failures have UI feedback and are not automatically retried.
Audit details include actors where available; purchase operations have durable
references. There is no external event dispatcher or transactional delivery outbox.

Important files: main.py, db.py, reporting.py, serializers.py, providers.tsx,
payments/page.tsx, dashboard/page.tsx, http_workload.py.

## Stage 4: portability
Added frozen Alembic baseline plus additive purchase/index revision. Existing data
was preserved in isolated legacy-schema testing. The additive migration was also
applied to the development database; no seed/reset command ran there.
Removed native dependency exclusions for Tailwind, Lightning CSS, esbuild and
Rollup, regenerated the lockfile, and verified a frozen install and native build.
Compose now defaults to fail-closed production settings and migration-only
initialization; demo seeding is explicit. Added CI checks without auto-deployment.

Docker AMD64/ARM64 builds, macOS builds, Compose runtime validation, persistent
volume restart and backup restoration on the target VPS are **NOT VERIFIED**.
The environment cannot run Docker. See DEPLOYMENT.md for external commands.

## Remaining backlog (estimates are engineering days, not commitments)
| Priority | Work | Estimate |
|---|---|---|
| P0 before live use | Verify container builds/migrations/restore on approved staging infrastructure; resolve any failures | 1–3 |
| P1 management acceptance | Complete remaining role-specific browser acceptance matrix, including outage/reload and imports | 1–2 |
| P1 | Review inclusive entitlement/cache policy and entitlement adjustment permissions with WAKA | 0.5–1 |
| P2 production pilot | Real account provisioning, rate limiting, password recovery, monitoring, TLS and scheduled backup ownership | 3–6 |
| P2 | Paginate/split full member and notification snapshots; sustained realistic-volume load testing | 2–4 |
| P2 | Approved payment integration with verified provider IDs and webhook signatures; never reuse simulator confirmation | provider-dependent, 5–10 |
| P3 | Durable outbox/dispatcher and self-hosted n8n, messaging consent and provider templates | 3–7 |
| P3 | Confirm hardware/card protocol and build installed branch controller; confirm Fitbase export contract | discovery required |

No real reactivation fee is introduced. Other fines remain unverified.

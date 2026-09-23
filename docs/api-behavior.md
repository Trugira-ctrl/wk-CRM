# WAKA POC interface behavior

All endpoints below are under `/api`. The spec at `lib/api-spec/openapi.yaml`
defines serialized fields. Business dates use Africa/Kigali.

- GET session returns `{user:null,demo_mode:true}` for anonymous.
- POST login accepts email/password. Seed accounts: admin@waka.demo,
  management@waka.demo, reception@waka.demo, aline@waka.demo and
  eric@waka.demo. Demo password for these fictional accounts: `WakaDemo2026!`.
  Server creates an HTTP-only session cookie. No automatic privileged login.
- GET public returns plans/branches (prices are illustrative).
- POST join accepts MemberInput including a chosen password (8+ chars).
  Creates a member, membership, simulated payment, user and signed-in session.
- GET workspace returns the operational snapshot, member scoped for MEMBER;
  all other roles may see operational data. Refresh after every mutation and
  poll at 15 seconds for cross-session changes.
- POST actions accepts `{action,...}`. Staff = ADMIN/MANAGEMENT/RECEPTION.

## Actions
- register_member: staff; member:MemberInput. Explicit record_payment defaults true.
  Persist member, membership, simulated payment; return member.
- update_member: staff; member_id, member:MemberInput.
- assign_card: staff; member_id, identifier, credential_type=CARD (or QR).
  Unique identifier constraint; reject duplicate, do not move ownership silently.
  Reader UI has separate detect and confirm phases; writes only on confirmation.
- disable_card: staff; credential_id. Returns success; audit.
- renew_membership: staff or owning MEMBER; member_id, plan_id.
  Simulated successful payment. Extend from max(today,current end); ACTIVE.
- checkin: staff; branch_id, method and identifier (card/QR) or member_id (manual).
  Branch 1 only SPEEDGATE_CARD; others RECEPTION_CARD, RECEPTION_QR,
  MANUAL_RECEPTION. Validate credential status, membership start/end/status;
  unknown credentials/expired/disabled cards create DENIED events, not errors.
  Return event. Credentials are separate records from members.
- run_reminders: staff; optional member_id (default Aline), all_fail boolean.
  Persist chronological SIMULATED WHATSAPP failed, retry failed,
  SIMULATED SMS delivered (or failed), SIMULATED EMAIL failed for all-fail.
  Final CONTACTED or STAFF FOLLOW-UP REQUIRED.
- controller_status: staff; online boolean; only Branch 1. Audit outage/restoration.
- sync_offline: staff; generation and events array. Idempotent UUID event upserts,
  branch 1/SPEEDGATE_CARD only, original occurrence preserved, offline=true,
  sync_status=SYNCED. Reject stale demo generation, unknown member or invalid data.
  Browser simulator (not real controller) validates against a frozen cache saved
  at disconnect, stores pending events in localStorage, and clears only acked
  events on successful sync. Never call cloud checkin while simulated offline.
  Do not replace cache during outage. Reject expired/future/disabled credentials.
  Clearly warn that card revocations made during outage are not yet cached.
- preview_migration: ADMIN; csv raw text (max 1MB), parse real CSV.
  Return MigrationRow[]. Validate required fields, plan, branch, dates, duplicate
  source ID/email within file and against DB. UI displays mapping and allows edits
  or skipping. Canonical header mapping is documented in the sample CSV.
- import_migration: ADMIN; rows. Revalidate server-side, import valid non-skipped
  rows transactionally; record source mapping, imported/skipped results. No fictitious
  payment for imported members. Replay does not duplicate records.
- reset_demo: ADMIN; confirmation="RESET". Only enabled in DEMO_MODE.
  Explicit destructive warning in UI. Reseed fictional records; reset generation.
  UI clears browser offline queue/cache. Preserve/recreate seeded session user.
- update_plan: ADMIN; plan:Plan. Validate positive integer RWF/positive duration.

Demo data: Aline initially ACTIVE, expires today+7, no card (assignment example
UID 04-A7-91-2C-88-61-80). Eric EXPIRED with active card. Patrick ACTIVE with active
card. Alice ACTIVE with disabled card. Kevin ACTIVE with active card. Three branches:
Branch 1 — Gated Branch; Branch 2 — Reception Branch; Branch 3 — Reception Branch.
Seed predictable seven-day visits/payments and a contacted reminder plus staff
follow-up failure. Clearly fictional data. No external services are called.
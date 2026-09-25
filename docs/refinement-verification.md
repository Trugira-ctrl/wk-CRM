# WAKA refinement verification

Verified on 2026-09-25. This report distinguishes the running development
preview from the separately published site.

## Status

- Implementation and preview acceptance: **passed**.
- Optimized Next.js production build: **passed**.
- Published-site UI acceptance: **pending user republish and access**. The
  password-protected published site was not bypassed or tested against old code.
- Docker/VPS execution: **not run** in this environment.
- No database reset, reseed, destructive migration or original-record deletion.
  Tests added fictional records and simulated events only.

## Acceptance results

| Flow | Result and evidence |
|---|---|
| Reception registration → existing-card assignment → gated access | PASS through UI. New member, dates, notes and emergency contact persisted; separate card detect/confirm activated the credential; Branch 1 immediately allowed it. |
| Branch 2 manual check-in | PASS through UI. Active member ALLOWED; expired fixture DENIED with “Membership is expired”. Central log agreed. |
| Branch 3 reception | PASS through UI. Active manual, card and QR checks ALLOWED; expired manual check DENIED with expiry reason. |
| Disabled/unknown credentials at both reception branches | PASS through API requests, followed by visual central-log verification. Disabled card and unknown identifier each DENIED with their correct reasons at Branches 2 and 3. |
| Expired membership → renewal → gated access | PASS through UI. Expired card denied before renewal; simulated payment updated membership to ACTIVE and the same card was immediately allowed. |
| WhatsApp failure → retry → SMS fallback | PASS through UI button and run timeline. One CONTACTED outcome; two failed attempts, zero additional failed chains. |
| All channels fail → staff follow-up | PASS through UI button and run timeline. One STAFF FOLLOW-UP REQUIRED outcome per run; each adds four failed attempts and one failed chain. Two separate all-fail runs added eight failed attempts and two failed chains, with distinct persisted IDs. |
| Two offline visits → resync | PASS through UI. Queue reached two, survived reload, cleared after acknowledgement, and appeared as exactly two offline central-log entries without duplication after reload. |
| Sample migration → 8 imported/2 skipped | PASS through UI. Required headers visible before upload; fresh sample validated 10/8/2, two review rows skipped, eight imported. Reload preserved totals and all ten source mappings, including skipped rows. |
| Admin/reception/management/member restrictions | PASS through UI. Admin can use Migration/Settings; reception and management direct URLs redirect without admin forms. Member staff/admin URLs redirect to an own-record portal. Reception and management dashboards differ appropriately. |
| Website → selected plan → Join → simulated payment | PASS through UI. Public plan values matched admin/public data. Quarterly selection carried into Join; fictional signup reached own portal with a matching 200,000 RWF simulated payment visible to admin. |
| Invalid linked plan | PASS through UI. `/join?plan=9999` displayed an explicit error with no selected plan and disabled continuation. |

Test fixtures retained: members 6 and 7 for registration/card/renewal, member
16 for Join, member 17 for expired-manual checks, and imported members 8–15.
All are fictional. Original members, memberships, credentials, payments, users
and logs were preserved. Tests did not force existing members into expired
states or change original credentials.

## Automated and startup checks

- `python -m unittest backend.test_regressions`: ten isolated in-memory SQLite
  regressions passed, including access-method/status matrix, branch constraints,
  legacy access serialization, missing membership, notification run identity and
  uncertainty, migration persistence/replay, roles, Join/renewals and offline
  idempotency. They do not reset or use the live demo database.
- API code generation and `typecheck:libs`: passed.
- Frontend TypeScript checks: passed.
- `pnpm --filter @workspace/waka run build`: passed; all application routes built.
- Python compilation and restarted FastAPI/Next.js services: passed.
- One browser acceptance tour, then a focused continuation for uncovered
  expired-manual and notification-button actions. No successful tour was repeated.
- Mobile public-website screenshot: rendered with explicit illustrative imagery
  disclosure. Mobile operational navigation was not separately exercised.

## Main files changed

- Backend: `backend/services.py`, `backend/serializers.py`, `backend/main.py`,
  `backend/test_regressions.py`.
- API: `lib/api-spec/openapi.yaml` and regenerated React/Zod contract files.
- Operations: dashboard, check-ins, notifications, members/list/detail,
  portal, gate, migration and role layout under `artifacts/waka/src/app/(app)/`;
  shared helpers in `artifacts/waka/src/lib/waka-ops.ts`.
- Public: website, new `website/public-plans.tsx`, Join and public layout under
  `artifacts/waka/src/app/(public)/`.
- Portability/documentation: `package.json`, `Dockerfile.frontend`, `.env.example`,
  `README.md`, `docs/api-behavior.md`, `docs/architecture.md`, `docs/demo-guide.md`.
  Existing Compose, Nginx, Python Dockerfile and database instructions were
  inspected and retained; no schema change is required for this refinement.

## Remaining limitations and approvals

- Published UI checks must run after the updated build is published. Keep the
  hosted demo password-protected; an app demo password is not the publishing
  access password.
- Docker Compose was reviewed, and pnpm is pinned for reproducibility, but the
  containers still need an actual Linux/VPS smoke test. Production build success
  does not establish Docker deployment success.
- Initial schema creation is explicit/idempotent, not a general schema upgrade
  engine. Add reviewed versioned migrations before future column changes.
- Browser offline cache is a simulation, not a physical branch controller or
  fully offline web app. Credentials revoked during an outage are not known to
  the frozen cache.
- WAKA must confirm real prices, plan entitlements, branch details, branding
  assets, real facility/coach imagery, testimonials and social destinations.
- Card technology, reader/controller/gate models and protocols, physical safety
  behavior and compatibility remain unconfirmed. Only Branch 1 has a simulated
  gate. Branches 2/3 remain reception-only.
- Fitbase export schema/API access and mapping need confirmation. The current
  importer accepts the displayed sample template, not arbitrary export headers.
- Payments and messaging remain simulated. Real provider selection, consent,
  delivery operations and production security require separate approval/work.
- Minor browser warnings noted during the tour concerned select-control state,
  autocomplete and image loading hints; no acceptance flow failed because of them.
# Stabilization verification

Baseline: `python -m unittest backend.test_regressions -q` — **11 passed**.

Final local unit/service check:
`python -m unittest backend.test_regressions backend.test_stabilization.StabilizationTests -q`
— **21 passed**. Covers access methods, role restrictions, membership scope,
normal/expired/independent/replayed renewals, failed payment, payload/key conflict,
date and privilege manipulation, demo session revocation, production simulation
denial, offline unknown/partial/duplicate/conflict events, migration sample replay,
notification run identity, full revenue reconciliation and payment pagination.

`python scripts/isolated_postgres.py` — **PASS** after the HTTP starvation fix.
The script creates/destroys a separate local PostgreSQL cluster, never uses the
application database, and stops escalation on errors. Legacy-schema migration
preserved all existing fixture rows exactly; repeated upgrades and clean-schema
upgrades passed. 10/25/50/100 concurrent independent and duplicate renewals yielded
189 distinct purchases, exactly 6,993 additional days at 37 days per plan,
and exact payment/operation counts and monetary totals.

Final bounded HTTP run (seconds; one burst each, fictional fixture):

| Concurrency | Workspace avg / P95 | Workspace req/s | Mixed avg / P95 | Mixed req/s | Errors |
|---|---|---|---|---|---|
| 10 | 0.340 / 0.361 | 27.2 | 0.219 / 0.236 | 41.9 | 0 |
| 25 | 0.532 / 0.767 | 31.3 | 0.392 / 0.540 | 44.7 | 0 |
| 50 | 1.010 / 1.627 | 29.5 | 0.699 / 1.132 | 42.7 | 0 |
| 100 | 1.915 / 3.417 | 28.4 | 1.820 / 4.354 | 21.8 | 0 |

Mixed operations: registration, lookup, workspace, card validation/check-in,
manual reception check-in, renewal, and offline sync. Final payment/membership
counts reconciled. Service-level runs also verified zero checked-out pool
connections after each burst. Resource utilization was not recorded.

An earlier HTTP run in this work failed at 100 concurrent workspace requests with
503 before admission control/transaction release was corrected. The previous
external audit reported 40% HTTP500 and P95 ~33.5 seconds, but its environment/data
volume differ. **Do not interpret this table as a comparable speedup or production
capacity guarantee.** Sustained traffic, multiple workers and large datasets need
separate staging tests.

Other checks:
- OpenAPI regeneration + library type checks: PASS.
- `pnpm --filter @workspace/waka run typecheck`: PASS.
- `pnpm install --frozen-lockfile`: PASS.
- `pnpm --filter @workspace/waka run build`: PASS, 16 routes.
- Application workflows restarted and serving requests.
- Protected browser acceptance: PASS for registration, two independent renewals
  adding exactly 30 days each, reload persistence, three matching simulated
  payments, and invalid-plan rejection without another payment/entitlement.
- Offline browser acceptance: PASS for unknown-card denial, invalid-membership
  denial, valid cached-card allowance, reload during simulated outage retaining
  the queue, reconnection acknowledging all three events, central check-in rows,
  and exact batch replay returning three DUPLICATE results with synced=0.
- Four production configuration subprocess checks: valid configuration imports;
  demo=true, insecure cookies, and missing origins each fail at startup.
- Browser noted invalid interactive nesting on View Profile (intermittent
  navigation was not reproducible). Replaced nested button/anchor with a single
  styled link and type-checked it. Clarified that ACTIVE in the card picker means
  the card, not membership entitlement.

Not executed: Docker builds/Compose runtime on AMD64/ARM64, native macOS build,
container volume restart, real backup restore drill, full production authentication,
physical hardware, real payment or messaging delivery. CI configuration is written
but has not run on GitHub. No published-site load tests were performed.

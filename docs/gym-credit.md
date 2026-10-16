# Gym credit — simulated POC

Members can set money aside as WAKA-only prepaid gym credit, then explicitly buy a membership with it. Depositing credit does not activate or renew membership. This implementation makes no MTN API calls and accepts no real money.

## Agreed policy

- A confirmed voluntary refund blocks **new wallet top-ups for two calendar months**, measured from the successful refund's Kigali calendar date. Month-end dates clamp to the destination month's last day. Top-ups resume at the start of the displayed date in Kigali.
- **Direct membership purchases remain available**, including during the top-up pause. Spending remaining available wallet credit is also allowed.
- An administrator reviews refunds. Verified payment-error refunds do not start a new pause; rejecting a refund or confirming its failure releases the reservation and starts no pause. A pre-existing pause is preserved.
- Only available unused credit is refundable. Spent membership payments require a separate cancellation policy. Refunds allocate unused deposits in oldest-first order and preserve their original payment sources; members cannot supply a different refund destination.
- Pending refunds reserve their amount immediately. Approval alone does not deduct the total balance or start a pause. Only a confirmed successful refund does so. Uncertain outcomes stay pending/approved until resolved.
- A deposit requested before a pause may settle afterward and must still be credited. The pause blocks new requests; it never discards received funds.

## Demo walkthrough

1. Sign in as Eric and open My Portal. Gym Credit starts at zero for existing members.
2. Start a demo deposit of 100,000 RWF. It remains pending and unavailable until **Simulate deposit success** is selected. Failure adds no credit.
3. Choose Monthly and **Pay & renew with credit**. The illustrative 75,000 RWF plan leaves 25,000 RWF, and adds the plan's membership days.
4. Request a refund of the unused 25,000 RWF. Available credit becomes zero, while 25,000 RWF stays reserved.
5. Sign in as Admin, open Wallets and select Eric. Approve the voluntary refund, then simulate its successful outcome. The top-up pause appears with its end date.
6. Sign in as Eric. Top-ups are disabled, while **Direct Membership Purchase** still works. No actual money is sent or received by these controls.

Use new fictional people when repeating a demonstration; do not reset the shared server database. Staff can view selected members' accounts; only admins can review/confirm refunds. Members can access only their own account. All mutation routes require explicit demo mode and reject production operation.

## Persistence and correctness

Migration 0003 adds wallet accounts, operations, refund allocations, ledger entries, and a member revision. Existing records are retained, wallets start empty, and no historical payment is converted into credit.

Each mutation locks the stable member row. An account tracks total and reserved credit; available credit is their difference. Positive integer RWF inputs, database balance constraints, unique per-member operation keys, and per-operation ledger phases prevent repeated credits/debits. Funding creates credit history, not a second membership-sale payment. Wallet purchases create a SIMULATED_WALLET membership payment and extend membership in the same transaction; demo revenue includes the purchase once.

Deposit confirmations and refund results accept the same final outcome repeatedly without moving money twice, and reject conflicting final outcomes. Failed transactions roll back their payment, membership and balance changes together. Financial movements are appended to the ledger; there is no balance-edit endpoint. The UI shows the latest 100 operations/movements; all remain stored. This is a single-currency, non-transferable POC ledger, not a general payment wallet.

Profile edits carry the revision captured when their form opened. Successful direct or wallet renewals increment it. A stale administrator save receives a conflict instead of overwriting renewed days. Future-start memberships require review rather than silently taking another purchase.

## Verified checks

- Unit regressions: deposit confirmation/failure, idempotency and conflicting retries, balance reconciliation, insufficient funds, refund reservations/releases, review permissions, payment-error exemption, calendar boundaries, late deposits, direct purchase during cooldown, and stale profile saves.
- Disposable PostgreSQL: 25 duplicate confirmations, 25 duplicate purchases, 25 competing purchases with insufficient funds, forced failure before commit, and repeated refund requests/reviews/results. The ledger and unused deposit allocations reconcile exactly.
- Existing PostgreSQL migration/concurrency harness: additive upgrade with existing row preservation and repeated migration; purchase concurrency and HTTP workload reconciliation.
- Production frontend build and typed API generation.
- Isolated browser: member deposit → wallet purchase → refund request → admin approval/result → two-month pause → successful direct purchase.

Run the unit checks with a configured disposable environment:

```sh
DATABASE_URL=sqlite:// python -m unittest backend.test_wallet backend.test_regressions backend.test_stabilization
```

The PostgreSQL harness requires `WAKA_ISOLATED_TEST=1`, a loopback-only disposable cluster and a database ending in `wallet_qa`. Never point these tests at the live POC database.

## MTN integration remaining

Replace demo confirmation controls with server-side MTN status verification; never credit from an SMS, screenshot, browser success page, or an unverified callback. Match member mapping, merchant account, payment reference, amount, currency and final success, with one credit per provider transaction. Add a durable reconciliation worker for missed confirmations and settlement mismatches. Unknown/timeout outcomes must not be retried as new payments or marked failed without verification. Provider reversals need linked correcting ledger entries and review when funds were already spent.

The Rwanda portal documents asynchronous payment requests and says callbacks are sent once, with status queries available for recovery: [MTN payment flow](https://momodeveloper.mtn.co.rw/content/html_widgets/aqnil.html), [callback documentation](https://momodeveloper.mtn.co.rw/content/html_widgets/macul.html).

Refund API methods are listed, but the available production product, partial refunds, original-source restrictions, fees, time limits, settlement and reversal behavior must be confirmed with MTN. Multiple-source refunds need separate idempotent payout legs; do not treat partial completion as complete or release amounts already refunded. A worker must independently verify each payout before consuming its reserved amount. No production refund automation is implemented here.

MTN requires sandbox testing and contractual onboarding before live credentials: [Rwanda go-live process](https://momodeveloper.mtn.co.rw/go-live). Live deployment also requires reviewed customer terms and legal/accounting treatment of prepaid balances, refund rights and the top-up pause; naming it gym credit does not decide its regulatory classification. No interest, transfers, general cash-out service, automatic renewal or automatic funding is included.

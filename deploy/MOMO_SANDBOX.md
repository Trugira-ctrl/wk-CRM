# MTN Collections sandbox

This integration calls only `https://sandbox.momodeveloper.mtn.com` with target
environment `sandbox`. It cannot be switched to a production endpoint or an
arbitrary payer. Access is ADMIN-only and requires demo mode outside production.

MTN uses test EUR, so **MoMo Sandbox** is a separate test wallet. Its verified
credits are the sum of unique sandbox payment rows. It never writes member gym
credit, memberships, payments, refund allocations or membership days. It does not
implement real-money collection, payouts, refunds or two-month cooldown changes.

## Credentials

Create a developer account and a **Collections** subscription (not Collection
Widget), then save the subscription key in a private JSON file outside Git:

```json
{"subscription_key":"ENTER_PRIVATELY"}
```

The file must have permission 600 in a private directory. Run:

```sh
python -m backend.momo_setup --config /private/path/credentials.json
```

The tool preserves its UUID before contacting MTN, provisions a sandbox API user
and API key, and tests token authentication. Credentials are saved atomically
with private permissions and never printed. It never regenerates an existing API
key. An ambiguous setup retains the reference rather than creating new users.
After investigating a failed setup, `--retry-user` permits an explicit creation
retry with the same reference. Uncertain key creation requires separate review.

Once complete, copy the three fields privately into the server `.env`:

```dotenv
MOMO_SANDBOX_ENABLED=true
MOMO_SANDBOX_SUBSCRIPTION_KEY=ENTER_PRIVATELY
MOMO_SANDBOX_API_USER=ENTER_PRIVATELY
MOMO_SANDBOX_API_KEY=ENTER_PRIVATELY
```

Append `:deploy/compose.momo-sandbox.yml` to the existing `COMPOSE_FILE` value and
use the normal versioned deployment. Leave `MOMO_SANDBOX_ENABLED=false` while
provisioning is incomplete. Existing provider modes remain simulated.

## Test flow

1. Open **MoMo Sandbox** from the admin menu.
2. Select an amount and successful, failed or pending test scenario.
3. Request a sandbox payment. HTTP 202 adds no credit.
4. Check MTN status. Only an authenticated provider GET can change verification.
5. A successful result must match amount, EUR currency, external reference, test
   payer and a provider transaction ID. A mismatch is held for review.
6. Download the JSON test receipt, including the provider response and verification
   time. It is explicitly labelled as evidence of a sandbox test, never real funds.

An idempotency key prevents a browser retry from posting a second request. Unknown
submission results preserve the original reference for status checks. Network
errors and missing status responses do not imply failure or credit. Row locks,
fixed per-payment credit and unique provider transaction IDs prevent duplicate
credit. Production integration must additionally cover authenticated callbacks,
durable polling/reconciliation, merchant approval, actual RWF accounting,
reversals and the separately approved refund route.

## Verification

Run the isolated tests with `DATABASE_URL=sqlite:// python -m unittest
backend.test_momo_sandbox -v`. These mocked tests do **not** prove MTN availability.
Record actual sandbox provider requests separately, keeping credentials and token
responses out of evidence files. Database backup and additive migration 0004 are
part of the normal deploy; no existing business records are backfilled.

Official references: [sandbox cases and currency](https://momodeveloper.mtn.com/content/html_widgets/6kfu8.html),
[API user provisioning](https://momodeveloper.mtn.com/API-collections#api=sandbox-provisioning-api),
[asynchronous payments and callbacks](https://momodeveloper.mtn.com/content/html_widgets/nqxho.html).

# WAKA — ten-step demonstration

All names, prices, payments and visit records are fictional examples.
Use **ADMIN** for the full presentation. Use other role logins to show what
reception, management and a member can access.

## Preserve existing data

Do **not** reset before this demonstration. Use new fictional names/emails and
unique simulated credential IDs for repeat runs. Existing members may already
have cards or renewed memberships; the seed descriptions below describe initial
conditions, not a promise about the current database. Keep a record of the new
member and card IDs used in the presentation.

## 1. Register a member

Open Members -> Register Member. Enter a fictional name, phone/email,
preferred branch, plan and dates. Record the simulated payment. Verify the new
profile and membership status. Aline Uwase is already seeded to make the
remaining steps reproducible on a fresh install, but use the newly registered
fictional person for a repeatable registration-to-gate demonstration. Show the
optional emergency contact and notes fields.

## 2. Register an existing card

Open the new member (or Aline if she still has no card). Start Register
Existing Card, simulate detection and confirm a unique example UID.
The credential is now active without a four-hour wait. Explain that the reader
is simulated and card/hardware reuse still requires a technical investigation.

## 3. Successful gated check-in

Open Gate Simulator (Branch 1). Select Aline's newly assigned credential and
tap. The simulator shows ACCESS GRANTED and SIMULATED SPEEDGATE OPEN.
Show the new event in the centralized check-in history.

## 4. Expired member denied

Select Eric's existing card only if his membership is still expired. Otherwise
register a new fictional expired member with an end date in the past and assign
a unique simulated card. The
simulator denies entry with the membership reason and stores the denial.
Alice's card demonstrates CARD DISABLED; an arbitrary UID demonstrates
UNKNOWN CARD.

## 5. Renew expired membership

Sign in as Eric (`eric@waka.demo`) or use staff renewal on his profile.
Review the chosen plan/illustrative RWF price and complete simulated payment.
The expiry extends, status becomes ACTIVE and a payment/audit event appears.
Return as staff and tap Eric's card: access is granted immediately.

## 6. Reminder failure and recovery

Notifications -> run the fallback scenario for a chosen fictional member.
Show SIMULATED WhatsApp FAILED -> retry FAILED -> SMS DELIVERED -> CONTACTED.
Run the all-fail scenario twice. Each run has a separate ID, timestamp and one
STAFF FOLLOW-UP REQUIRED outcome. The two all-fail runs add **two failed
chains and eight failed attempts**, not eight failed chains. The fallback run
adds two failed attempts but zero failed chains. Reload to show persisted runs.
No message is sent and access decisions never depend on these outcomes.

## 7. Internet outage

At the gate, start ONLINE and synchronize the cache. Select Simulate Internet
Outage. Cloud shows OFFLINE, while Local Access remains ACTIVE. Explain that
the real platform would use an installed branch service, not a browser tab.

## 8. Offline check-ins

Tap Aline/Patrick/Kevin cards several times. Validation uses the frozen local
cache and pending synchronization count increases. No cloud check-in request
is made for these taps. Unknown and expired cached cards remain denied.

## 9. Restore and synchronize

Restore internet. Queued UUID events synchronize and appear centrally once,
preserving their original timestamps and offline provenance. A repeated batch
does not create duplicate events. Explain that cloud revocations made during
outage cannot be known by the cache until it is refreshed.

## 10. Fitbase sample migration

As ADMIN, open Sample CSV Migration. Read the required header template before
upload: `source_record_id,full_name,phone,email,plan,start_date,end_date,branch_id`.
Download a fresh sample; arbitrary Fitbase column names are not automatically
mapped. Review validation: 10 fictional rows, 8 valid, 2 needing
review. Fix issues or skip those rows, then import. Show source-to-WAKA ID
mapping and imported/skipped totals after a page reload. Skip the two review
rows to demonstrate eight imported/two skipped; alternatively resolve them.
This is sample CSV parsing, not a confirmed Fitbase export or API integration.

## Additional reception and public-site flows

- At Branch 2 or 3, search/select a member and use manual reception check-in,
  simulated CARD, or simulated QR. These branches have **no speedgates**.
  Active membership must display ALLOWED; expired membership DENIED with the
  expiry reason. Disabled and unknown credentials must be denied. Check the
  central history and verify a valid-membership reason never appears on denial.
- Register a QR credential on a profile before demonstrating QR lookup.
- Open the public website to compare illustrative plans and see the
  fictional coach/story content. Join with a new email and password; the
  simulated payment creates a member account and portal access.
- ADMIN can edit plan data; public membership prices use those saved records.
- Reception and management must be redirected away from `/migration` and
  `/settings`, including when typed directly; MEMBER can see only their own
  portal. Reception prioritizes daily member tasks; management shows branch
  activity, expiring memberships, simulated payments and exceptions.
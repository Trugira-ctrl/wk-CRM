# WAKA — ten-step demonstration

All names, prices, payments and visit records are fictional examples.
Use **ADMIN** for the full presentation. Use other role logins to show what
reception, management and a member can access.

## Reset first (optional)

Demo Mode's reset action requires confirmation. It deletes WAKA POC records,
including anything registered during a previous presentation, then reseeds the
fictional scenarios. Do not use this database for real members.

## 1. Register a member

Open Members -> Register Member. Enter a fictional name, phone/email,
preferred branch, plan and dates. Record the simulated payment. Verify the new
profile and membership status. Aline Uwase is already seeded to make the
remaining steps reproducible; register another fictional person for this step.

## 2. Register an existing card

Open Aline Uwase. Initially she has **NO CARD REGISTERED**. Start Register
Existing Card, simulate detection and confirm UID `04-A7-91-2C-88-61-80`.
The credential is now active without a four-hour wait. Explain that the reader
is simulated and card/hardware reuse still requires a technical investigation.

## 3. Successful gated check-in

Open Gate Simulator (Branch 1). Select Aline's newly assigned credential and
tap. The simulator shows ACCESS GRANTED and SIMULATED SPEEDGATE OPEN.
Show the new event in the centralized check-in history.

## 4. Expired member denied

Select Eric Mugisha's existing card. He has an expired membership. The
simulator denies entry with the membership reason and stores the denial.
Alice's card demonstrates CARD DISABLED; an arbitrary UID demonstrates
UNKNOWN CARD.

## 5. Renew expired membership

Sign in as Eric (`eric@waka.demo`) or use staff renewal on his profile.
Review the chosen plan/illustrative RWF price and complete simulated payment.
The expiry extends, status becomes ACTIVE and a payment/audit event appears.
Return as staff and tap Eric's card: access is granted immediately.

## 6. Reminder failure and recovery

Notifications -> run the Aline renewal scenario. Her initial expiry is seven
days away. Show WhatsApp FAILED -> WhatsApp retry FAILED -> SMS DELIVERED ->
CONTACTED. Run the all-fail scenario to show STAFF FOLLOW-UP REQUIRED on the
operations dashboard. All channels are simulated; no member is contacted.

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

As ADMIN, open Migration. Download/load the sample export or upload it.
Review the field mapping and validation: 10 fictional rows, 8 valid, 2 needing
review. Fix issues or skip those rows, then import. Show source-to-WAKA ID
mapping and imported/skipped totals. This is CSV parsing, not a real Fitbase
API integration.

## Additional reception and public-site flows

- At Branch 2 or 3, search/select a member and use manual reception check-in,
  simulated CARD, or simulated QR. These branches have **no speedgates**.
- Register a QR credential on a profile before demonstrating QR lookup.
- Open the public website to compare illustrative plans and see the
  fictional coach/story content. Join with a new email and password; the
  simulated payment creates a member account and portal access.
- ADMIN can edit plan data; public membership prices use those saved records.
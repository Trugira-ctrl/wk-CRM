# WAKA n8n starter workflows

The opt-in `deploy/compose.automation.yml` runs pinned n8n 2.43.7 and a separate
PostgreSQL 17 database. The editor binds **only to server loopback**. It adds no
public port or domain and does not change AWS instance type or account plan.

## Workflows

| Workflow | Kigali schedule | Result |
| --- | --- | --- |
| Health check | Every five minutes | Checks WAKA API/database; records latest result |
| Membership expiry reminders | Daily 08:00 | Prepares a staff review for memberships ending within seven days |
| Daily operations summary | Daily 18:00 | Records membership, check-in, simulated-sales and pending-refund counts |

Each has a manual trigger. No actual WhatsApp, SMS, email, payments, refunds,
renewals, or access decisions occur. Results appear in **Automations** in the WAKA
staff menu. The expiry review displays at most 50 names and retains the full count.
It contains no contact details. These are snapshots; manual runs replace the
same day's snapshot. Internal reports retain 30 days. n8n execution history is
pruned after seven days or 1,000 executions. Containers have bounded logs.

The health workflow depends on WAKA to save its result. When the app is entirely
down, examine failed n8n executions; the staff page marks old health reports stale.
External alert delivery requires a separately agreed channel and credentials.

## Private setup

Generate and preserve three distinct random values in the server's private `.env`:
`AUTOMATION_TOKEN`, `N8N_POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY` (32+ bytes each).
Append `:deploy/compose.automation.yml` to the existing `COMPOSE_FILE` value.
Never commit these values or credential exports. The service token can only read
an operations snapshot and write three constrained internal report types. Nginx
rejects `/internal/`; the credential is usable on the private container network.

Deploy through `deploy/waka-deploy.sh`. The first run imports an encrypted header
credential, imports the three managed JSON workflows, publishes each, and restarts
n8n to apply the schedules. A digest skips unchanged imports on future pulls.
Import files are removed after use. The owner's default personal project receives
these workflows. Changes to these managed definitions in Git replace editor
changes at the next definition update; make custom workflows under other IDs.

From your computer, run `bash deploy/n8n/open-editor.sh`, keep that session open,
and visit <http://localhost:5678>. Set `WAKA_SSH_KEY` if using a different SSH key.
Complete the owner setup personally with your own email and password. Do not
publish the unclaimed setup page to the internet. Email-based password recovery
needs SMTP; no SMTP is configured in this POC.

HTTP cookies are permitted only for this loopback-only editor; browser transport
to the server is encrypted through SSH. A future public editor should use a
dedicated HTTPS domain, secure cookies and an explicitly configured webhook URL.
Avoid a reverse-proxy subfolder for n8n.

## Updates and backups

The existing local commit/push and server pull flow continues. Deploy backs up
WAKA and (once running) n8n independently before updates. Preserve the private
`.env`, especially `N8N_ENCRYPTION_KEY`, together with database backups: losing
the key makes encrypted credentials unusable. Database volumes are never pruned.
No automatic server reboot is needed. Backups stay in the private operator state
directory; copy them off-server for disaster recovery.

After a deploy, verify both readiness, all three published workflows, successful
manual executions, and the staff reports. The JSON definitions can be rebuilt
with `python3 deploy/n8n/generate-workflows.py`.

Official references: [Docker installation](https://docs.n8n.io/hosting/installation/docker/),
[CLI commands](https://docs.n8n.io/hosting/cli-commands/),
[configuration](https://docs.n8n.io/hosting/configuration/environment-variables/deployment/).

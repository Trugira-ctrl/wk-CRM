---
name: Next.js preview origins
description: Why development hot reload needs the exact preview hostname despite a wildcard allowlist.
---

Include the actual development hostname in Next.js allowedDevOrigins when
running behind the preview proxy; do not assume `*.replit.dev` covers nested
subdomains.

**Why:** Next.js accepted normal page requests while blocking the hot-reload
WebSocket from a nested preview hostname despite the single-level wildcard.
The resulting page looked healthy but did not reliably receive hot updates.

**How to apply:** Keep this as development-only optional configuration from
the provided host environment. Do not hardcode a temporary hostname, change
same-origin API URLs, or introduce a Replit dependency into the exported runtime.
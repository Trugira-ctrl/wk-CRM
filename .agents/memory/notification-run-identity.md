---
name: Notification run identity
description: Why WAKA keeps exact scenario membership and uncertainty when reporting reminder chains.
---

Treat a notification scenario run as separate from its delivery attempts and
from the member receiving it. Never infer a new run solely from a member,
minute bucket, or a range of event IDs.

**Why:** Repeated scenarios for one member can legitimately have different
outcomes. Counting failed attempts as failed chains exaggerated follow-up work,
and grouping by member made successful and unsuccessful runs look contradictory.
Concurrent inserts can also interleave event IDs.

**How to apply:** Preserve exact attempt-to-run associations and one final
outcome for every new run. Historical sequences may be reconstructed only when
their pattern is sufficiently clear; ambiguous fragments remain explicitly
uncertain and must not silently count as failed chains. If the interim
association storage is normalized in a future migration, retain these exact
associations and uncertainty flags without rewriting the attempt ledger.

The interim persistence choice deliberately avoids a schema change on existing
demo deployments. It is not a recommendation to replace relational modeling
with generic configuration storage for future features.
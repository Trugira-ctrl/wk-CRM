---
name: Synchronous API load tests
description: Why service-level benchmarks alone cannot verify FastAPI connection stability.
---
Verify concurrent requests through HTTP as well as direct service calls.
**Why:** Direct PostgreSQL service calls passed at 100 workers, but real HTTP
requests failed because authentication dependencies could retain connections
while endpoint work waited for synchronous worker threads. Bounded admission
before dispatch and prompt read-transaction release resolved the tested workload.
**How to apply:** For changes to dependency/session lifecycle, use an isolated
PostgreSQL HTTP workload; do not infer API stability from direct ORM calls or
increase the pool without inspecting thread/connection ownership.

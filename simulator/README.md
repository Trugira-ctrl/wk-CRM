# Branch 1 local-access simulator

The Phase 1 simulator runs in the frontend's Gate Simulator page and uses
browser storage for its cached credential snapshot and pending event queue.
It shares the same generated REST contract as the rest of the application.

No separate controller daemon or real hardware connection is installed.
Only Branch 1 can use SPEEDGATE_CARD. Branches 2 and 3 use reception workflows.

See `docs/architecture.md` for cache limitations and the future secured local
service requirements. This directory marks the future local-controller
boundary without introducing a premature microservice.
"""Bounded HTTP workload, invoked only within the disposable PostgreSQL harness."""
import json
import os
import socket
import subprocess
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

from sqlalchemy import func, select
from .common import now
from .db import engine, SessionLocal
from .models import Credential, Membership, Payment, User
from .security import create_session


def run(actor_id, member_id):
    if os.environ.get("WAKA_ISOLATED_TEST") != "1" or engine.url.host != "127.0.0.1":
        raise RuntimeError("Disposable local PostgreSQL harness required")
    with SessionLocal() as db:
        token = create_session(db, db.get(User, actor_id))
        db.add(Credential(member_id=member_id, type="CARD", identifier="LOAD-TEST-CARD",
                          status="ACTIVE", created_at=now()))
        db.commit()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    server = subprocess.Popen(["python", "-m", "uvicorn", "backend.main:app",
        "--host", "127.0.0.1", "--port", str(port), "--no-access-log"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def request(path, body=None):
        headers = {"Cookie": f"waka_session={token}", "Content-Type": "application/json"}
        data = json.dumps(body).encode() if body is not None else None
        with urlopen(Request(base + path, data=data, headers=headers), timeout=25) as response:
            result = json.load(response)
        if result.get("ok") is False:
            raise AssertionError("Operation returned unsuccessful result")
        return result

    try:
        for _ in range(100):
            if server.poll() is not None:
                raise RuntimeError("Isolated API failed to start")
            try:
                request("/health")
                break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError("Isolated API startup timed out")
        for concurrency in (10, 25, 50, 100):
            for kind in ("workspace", "mixed"):
                run_id = uuid.uuid4().hex
                def work(i):
                    started = time.perf_counter()
                    if kind == "workspace" or i % 7 == 0:
                        request("/api/workspace")
                    elif i % 7 == 1:
                        request("/api/actions", dict(action="register_member", member=dict(
                            full_name="Fictional workload member", email=f"{run_id}-{i}@example.test",
                            phone="fictional", branch_id=2, plan_id=1)))
                    elif i % 7 == 2:
                        # Member lookup uses the existing role-scoped snapshot contract.
                        result = request("/api/workspace")
                        assert any(m["id"] == member_id for m in result["members"])
                    elif i % 7 in (3, 4):
                        result = request("/api/actions", dict(action="checkin",
                            branch_id=1 if i % 7 == 3 else 2,
                            method="SPEEDGATE_CARD" if i % 7 == 3 else "MANUAL_RECEPTION",
                            member_id=member_id, identifier="LOAD-TEST-CARD"))
                        assert result["event"]["decision"] == "ALLOWED"
                    elif i % 7 == 5:
                        request("/api/actions", dict(action="renew_membership", member_id=member_id,
                            plan_id=1, idempotency_key=f"{run_id}-{i}"))
                    else:
                        request("/api/actions", dict(action="sync_offline", generation="test", events=[
                            dict(id=str(uuid.uuid4()), member_id=None, branch_id=1,
                                 method="SPEEDGATE_CARD", decision="DENIED", reason="Unknown credential",
                                 occurred_at=now().isoformat())]))
                    return time.perf_counter() - started
                started = time.perf_counter()
                with ThreadPoolExecutor(max_workers=concurrency) as pool:
                    # Any failure aborts subsequent, larger workloads.
                    times = sorted(pool.map(work, range(concurrency)))
                print(f"HTTP {kind} concurrency={concurrency} errors=0 avg={sum(times)/len(times):.3f}s "
                      f"p95={times[max(0, int(len(times)*.95)-1)]:.3f}s throughput={concurrency/(time.perf_counter()-started):.1f}/s")
        # Membership creation and successful payments remain one-to-one in this
        # fixture (failed-payment testing is covered by separate regression tests).
        with SessionLocal() as db:
            assert db.scalar(select(func.count()).select_from(Payment)) == db.scalar(
                select(func.count()).select_from(Membership))
        print("Bounded HTTP workload state reconciliation: PASS")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()

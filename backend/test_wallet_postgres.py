"""Financial race/rollback checks in an explicitly disposable local PostgreSQL database."""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import func, select

from .common import now
from .db import engine, SessionLocal
from .models import Member, Membership, Payment, Plan, User, WalletAccount, WalletEntry, WalletOperation
from .services import create_member
from .wallet import run_wallet_action


def main():
    if (os.environ.get("WAKA_ISOLATED_TEST") != "1" or engine.url.host != "127.0.0.1"
            or not engine.url.database.endswith("wallet_qa")):
        raise SystemExit("Use only the explicitly disposable local wallet_qa database")
    with SessionLocal() as db:
        actor = db.scalar(select(User).where(User.role == "ADMIN"))
        actor_id = actor.id
        plan = db.scalar(select(Plan))
        plan_id, price = plan.id, plan.price
        member, _ = create_member(db, dict(full_name="Wallet race fixture", email=f"{uuid.uuid4()}@example.test",
            phone="fictional", branch_id=1, plan_id=plan_id))
        db.commit()
        member_id = member.id

    def act(action, **fields):
        with SessionLocal() as db:
            return run_wallet_action(db, db.get(User, actor_id), dict(action=action, member_id=member_id, **fields))

    def parallel(fn):
        with ThreadPoolExecutor(max_workers=25) as pool:
            return list(pool.map(fn, range(25)))

    deposit = act("wallet_topup", amount=price * 3, idempotency_key=str(uuid.uuid4()))["operation"]["id"]
    parallel(lambda _: act("wallet_confirm_topup", operation_id=deposit, outcome="SUCCESSFUL"))
    with SessionLocal() as db:
        assert db.get(WalletAccount, member_id).balance == price * 3
        assert db.scalar(select(func.count()).select_from(WalletEntry).where(WalletEntry.member_id == member_id)) == 1
    print("25 duplicate deposit confirmations: one credit PASS", flush=True)

    key = str(uuid.uuid4())
    results = parallel(lambda _: act("wallet_purchase", plan_id=plan_id, idempotency_key=key))
    assert len({r["operation"]["id"] for r in results}) == 1
    print("25 duplicate wallet purchases: one debit/extension PASS", flush=True)

    def competing_purchase(_):
        try:
            act("wallet_purchase", plan_id=plan_id, idempotency_key=str(uuid.uuid4()))
            return "SUCCESS"
        except HTTPException as exc:
            assert exc.status_code == 409
            return "INSUFFICIENT"
    results = parallel(competing_purchase)
    assert results.count("SUCCESS") == 2 and results.count("INSUFFICIENT") == 23
    print("25 competing purchases: only two available purchases succeed PASS", flush=True)

    deposit = act("wallet_topup", amount=price * 2, idempotency_key=str(uuid.uuid4()))["operation"]["id"]
    act("wallet_confirm_topup", operation_id=deposit, outcome="SUCCESSFUL")
    with SessionLocal() as db:
        before = (db.scalar(select(func.count()).select_from(Membership).where(Membership.member_id == member_id)),
                  db.scalar(select(func.count()).select_from(Payment).where(Payment.member_id == member_id)))
        try:
            with patch("backend.wallet.entry", side_effect=RuntimeError("Injected before commit")):
                run_wallet_action(db, db.get(User, actor_id), dict(action="wallet_purchase", member_id=member_id,
                    plan_id=plan_id, idempotency_key=str(uuid.uuid4())))
        except RuntimeError:
            db.rollback()
        after = (db.scalar(select(func.count()).select_from(Membership).where(Membership.member_id == member_id)),
                 db.scalar(select(func.count()).select_from(Payment).where(Payment.member_id == member_id)))
        assert before == after and db.get(WalletAccount, member_id).balance == price * 2
    print("Failure before commit: balance/payment/membership all roll back PASS", flush=True)

    key = str(uuid.uuid4())
    requests = parallel(lambda _: act("wallet_request_refund", amount=price, reason="Fictional voluntary refund",
                                     idempotency_key=key))
    refund_id = requests[0]["operation"]["id"]
    assert len({r["operation"]["id"] for r in requests}) == 1
    parallel(lambda _: act("wallet_review_refund", operation_id=refund_id, decision="APPROVE", category="VOLUNTARY"))
    parallel(lambda _: act("wallet_confirm_refund", operation_id=refund_id, outcome="SUCCESSFUL"))
    with SessionLocal() as db:
        account = db.get(WalletAccount, member_id)
        assert (account.balance, account.reserved) == (price, 0)
        sums = db.execute(select(func.sum(WalletEntry.balance_delta), func.sum(WalletEntry.reserved_delta))
            .where(WalletEntry.member_id == member_id)).one()
        remaining = db.scalar(select(func.sum(WalletOperation.remaining)).where(WalletOperation.member_id == member_id))
        assert tuple(sums) == (price, 0) and remaining == price
        assert account.topup_blocked_until is not None
    print("25 repeated refund requests/reviews/confirmations: one payout; ledger reconciles PASS", flush=True)


if __name__ == "__main__":
    main()

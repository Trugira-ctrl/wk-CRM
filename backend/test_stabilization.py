"""Isolated regression tests for the stabilization brief."""
import uuid
import unittest
from datetime import timedelta
from unittest.mock import patch

from fastapi import HTTPException, Response
from sqlalchemy import func, select

from .common import today, now
from .main import join
from .models import AccessEvent, Membership, Payment, User
from .security import create_session, session_user
from .services import run_action
from .serializers import workspace, day_start
from .test_regressions import RegressionTests


class StabilizationTests(unittest.TestCase):
    setUp = RegressionTests.setUp
    tearDown = RegressionTests.tearDown
    input = RegressionTests.input

    def renew(self, key=None, **extra):
        return run_action(self.db, self.admin, dict(
            action="renew_membership", member_id=self.member.id, plan_id=1,
            idempotency_key=key or str(uuid.uuid4()), **extra))

    def test_duplicate_and_independent_purchases(self):
        before = max(m.end_date for m in self.member.memberships)
        key = str(uuid.uuid4())
        first = self.renew(key)
        again = self.renew(key)
        self.assertEqual(first["operation_id"], again["operation_id"])
        self.renew()
        self.db.expire_all()
        self.assertEqual(max(m.end_date for m in self.member.memberships), before + timedelta(days=60))
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Payment)), 3)

    def test_expired_renewal_is_exact_plan_duration_inclusive(self):
        ms = self.db.scalar(select(Membership))
        ms.start_date = today() - timedelta(days=50)
        ms.end_date = today() - timedelta(days=20)
        self.db.commit()
        result = self.renew()
        self.assertEqual(result["member"]["start_date"], today().isoformat())
        self.assertEqual(result["member"]["end_date"], (today() + timedelta(days=29)).isoformat())

    def test_failed_payment_does_not_grant_entitlement_and_is_replayable(self):
        before = self.db.scalar(select(func.count()).select_from(Membership))
        key = str(uuid.uuid4())
        result = self.renew(key, simulate_failure=True)
        self.assertFalse(result["ok"])
        self.assertEqual(self.renew(key, simulate_failure=True), result)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Membership)), before)
        with self.assertRaises(HTTPException) as caught:
            self.renew(key)
        self.assertEqual(caught.exception.status_code, 409)

    def test_missing_idempotency_and_invalid_inputs(self):
        for changes in ({"idempotency_key": ""}, {"plan_id": -1}, {"plan_id": 999},
                        {"member_id": -1}, {"end_date": "2036-01-01"}, {"role": "ADMIN"}):
            body = dict(action="renew_membership", member_id=self.member.id, plan_id=1,
                        idempotency_key=str(uuid.uuid4()))
            body.update(changes)
            with self.subTest(changes=changes), self.assertRaises(HTTPException):
                run_action(self.db, self.admin, body)
            self.db.rollback()

    def test_public_dates_and_privileges_rejected(self):
        for extra in ({"end_date": "2036-01-01"}, {"start_date": "bad"},
                      {"role": "ADMIN"}, {"plan_id": -1}, {"plan_id": 999999}):
            with self.subTest(extra=extra), self.assertRaises(HTTPException):
                join({**self.input("join@example.test"), "password": "fictional-password", **extra},
                     Response(), self.db)
            self.db.rollback()

    def test_simulated_activation_fails_closed(self):
        with patch("backend.services.DEMO_MODE", False):
            with self.assertRaises(HTTPException) as caught:
                self.renew()
            self.assertEqual(caught.exception.status_code, 403)
            with self.assertRaises(HTTPException):
                join({**self.input("join@example.test"), "password": "fictional-password"}, Response(), self.db)

    def test_existing_demo_session_revoked_but_regular_session_preserved(self):
        self.admin.is_demo_seed = True
        demo_token = create_session(self.db, self.admin)
        regular = User(name="Regular", email="regular@example.test", role="MEMBER",
                       password_hash="unused", created_at=self.admin.created_at)
        self.db.add(regular); self.db.flush()
        regular_token = create_session(self.db, regular)
        self.db.commit()
        with patch("backend.security.DEMO_MODE", False):
            self.assertIsNone(session_user(self.db, demo_token))
            self.assertEqual(session_user(self.db, regular_token).id, regular.id)

    def test_reception_cannot_adjust_entitlement(self):
        actor = User(role="RECEPTION", email="reception@example.test")
        with self.assertRaises(HTTPException) as caught:
            run_action(self.db, actor, {"action": "update_member", "member_id": self.member.id,
                "member": {**self.input(), "end_date": "2036-01-01"}})
        self.assertEqual(caught.exception.status_code, 403)

    def test_offline_partial_unknown_replay_and_conflict(self):
        unknown = dict(id=str(uuid.uuid4()), member_id=None, branch_id=1,
                       method="SPEEDGATE_CARD", decision="DENIED", reason="Unknown credential",
                       occurred_at=now().isoformat())
        valid = {**unknown, "id": str(uuid.uuid4()), "member_id": self.member.id,
                 "decision": "ALLOWED", "reason": "Cached membership valid"}
        def sync(events):
            return run_action(self.db, self.admin, dict(action="sync_offline", generation="test", events=events))
        first = sync([unknown, {**valid, "id": "invalid"}, valid])
        self.assertFalse(first["ok"])
        self.assertEqual([r["status"] for r in first["results"]], ["SYNCED", "REJECTED", "SYNCED"])
        replay = sync([valid, unknown])
        self.assertEqual([r["status"] for r in replay["results"]], ["DUPLICATE", "DUPLICATE"])
        conflict = sync([{**valid, "decision": "DENIED"}, {**unknown, "id": str(uuid.uuid4()), "decision": "ALLOWED"}])
        self.assertTrue(all(r["status"] == "REJECTED" for r in conflict["results"]))
        self.assertEqual(self.db.scalar(select(func.count()).select_from(AccessEvent)), 2)

    def test_revenue_reconciles_beyond_display_limit(self):
        self.db.query(Payment).delete()
        start = day_start(today())
        self.db.add_all([Payment(member_id=self.member.id, amount=123,
            currency="RWF", provider="SIMULATED", status="SUCCESS",
            created_at=start + timedelta(seconds=i)) for i in range(251)])
        for status, currency, at in (("FAILED", "RWF", start), ("PENDING", "RWF", start),
                                     ("SUCCESS", "USD", start),
                                     ("SUCCESS", "RWF", start - timedelta(seconds=1))):
            self.db.add(Payment(member_id=self.member.id, amount=999999, currency=currency,
                               provider="SIMULATED", status=status, created_at=at))
        self.db.commit()
        self.assertEqual(len(workspace(self.db, self.admin)["payments"]), 200)
        self.assertEqual(workspace(self.db, self.admin)["metrics"]["payments_today"], 251 * 123)
        with patch("backend.serializers.ENVIRONMENT", "production"):
            self.assertEqual(workspace(self.db, self.admin)["metrics"]["payments_today"], 0)
        from .reporting import payment_page
        first = payment_page(self.db, self.admin, 1, 200)
        second = payment_page(self.db, self.admin, 2, 200)
        self.assertEqual((first["total"], len(second["items"])), (255, 55))
        self.assertFalse({p["id"] for p in first["items"]} & {p["id"] for p in second["items"]})


if __name__ == "__main__":
    unittest.main()

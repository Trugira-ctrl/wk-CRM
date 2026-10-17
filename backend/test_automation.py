"""Automation scope and reporting invariants; isolated in-memory databases only."""
import json
import unittest
from datetime import timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from . import automation
from .common import now, today
from .db import Base
from .models import Branch, Config, Member, Membership, Payment, Plan, User


class AutomationTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.add(Branch(id=1, name="Test", type="RECEPTION"))
        self.db.add(Plan(id=1, name="Test", price=100, duration_days=30, description="Test"))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def member(self, index, days=3, status="ACTIVE", start=-20):
        member = Member(full_name=f"Fictional {index}", phone="private", email=f"{index}@example.test",
                        branch_id=1, created_at=now())
        self.db.add(member)
        self.db.flush()
        self.db.add(Membership(member_id=member.id, plan_id=1, start_date=today()+timedelta(days=start),
            end_date=today()+timedelta(days=days), status=status, created_at=now()))
        self.db.commit()
        return member

    def body(self, **updates):
        return dict(workflow="health-check", day=today().isoformat(), status="HEALTHY",
                    summary="Test report", payload={}, **updates)

    def test_service_requires_configured_exact_bearer_and_handles_unicode(self):
        with patch.object(automation, "AUTOMATION_TOKEN", ""):
            with self.assertRaises(HTTPException) as caught:
                automation.service_auth(None)
            self.assertEqual(caught.exception.status_code, 503)
        with patch.object(automation, "AUTOMATION_TOKEN", "a"*48):
            for invalid in (None, "a"*48, "Bearer " + "a"*47, "Bearer 🔒"):
                with self.assertRaises(HTTPException) as caught:
                    automation.service_auth(invalid)
                self.assertEqual(caught.exception.status_code, 403)
            automation.service_auth("Bearer " + "a"*48)

    def test_snapshot_uses_latest_membership_and_does_not_expose_contact_data(self):
        member = self.member(1)
        self.db.add(Membership(member_id=member.id, plan_id=1, start_date=today(),
            end_date=today()+timedelta(days=40), status="ACTIVE", created_at=now()))
        self.member(2, status="PAUSED")
        self.member(3, days=-1)
        self.member(4, start=1)
        self.member(5, days=0)
        self.member(6, days=7)
        self.db.commit()
        data = automation.snapshot(self.db)
        self.assertEqual(data["metrics"]["members_total"], 6)
        self.assertEqual(data["metrics"]["active_members"], 3)
        self.assertEqual(data["metrics"]["expired_members"], 1)
        self.assertEqual(data["metrics"]["expiring_members"], 2)
        self.assertEqual([r["days_remaining"] for r in data["expiring_members"]], [0, 7])
        self.assertNotIn("phone", json.dumps(data))
        self.assertNotIn("email", json.dumps(data))

    def test_full_count_is_not_limited_with_review_list(self):
        for index in range(51):
            self.member(index)
        data = automation.snapshot(self.db)
        self.assertEqual(data["metrics"]["expiring_members"], 51)
        self.assertEqual(len(data["expiring_members"]), 50)
        self.assertTrue(data["expiring_list_truncated"])

    def test_reports_upsert_retry_preserve_business_data_and_prune_own_history(self):
        member = self.member(1)
        self.db.add(Payment(member_id=member.id, amount=100, currency="RWF", provider="SIMULATED",
                            status="SUCCESS", created_at=now()))
        old = (today()-timedelta(days=31)).isoformat()
        self.db.add_all([Config(key=f"automation:{old}:health-check", value="{}"),
                         Config(key="demo_generation", value="preserve")])
        self.db.commit()
        report = self.body()
        automation.record_report(self.db, report)
        report["status"] = "UNHEALTHY"
        automation.record_report(self.db, report)
        result = automation.reports(self.db, User(role="RECEPTION"))
        self.assertEqual(len(result["reports"]), 1)
        self.assertEqual(result["reports"][0]["status"], "UNHEALTHY")
        self.assertFalse(result["reports"][0]["external_messages_sent"])
        self.assertFalse(result["external_messages_enabled"])
        self.assertEqual(self.db.get(Config, "demo_generation").value, "preserve")
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Membership)), 1)
        self.assertEqual(self.db.scalar(select(Payment.amount)), 100)

    def test_bad_dates_status_payload_and_member_scope_are_rejected(self):
        for changes in ({"day": "2026-02-30"}, {"day": (today()-timedelta(days=1)).isoformat()},
                        {"status": "READY"}, {"payload": {"data": "x"*65536}}, {"extra": "no"}):
            with self.assertRaises(HTTPException):
                automation.record_report(self.db, {**self.body(), **changes})
        with self.assertRaises(HTTPException) as caught:
            automation.reports(self.db, User(role="MEMBER"))
        self.assertEqual(caught.exception.status_code, 403)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Config)), 0)


if __name__ == "__main__":
    unittest.main()

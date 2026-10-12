"""Run: DATABASE_URL=sqlite:// python -m unittest backend.test_regressions -v

Every test uses a fresh in-memory SQLite engine, never the configured database.
No application startup, migrations, seed, or reset commands are invoked.
"""
import json
import unittest
import uuid
from datetime import timedelta

from fastapi import HTTPException, Response
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from .common import now, today
from .db import Base
from .main import join, sample_export
from .models import (AccessEvent, Branch, Config, Credential, Member, Membership,
                     MigrationRecord, NotificationEvent, Payment, Plan, User)
from .serializers import branch_checkins_today, day_start, event_json, notification_runs, workspace
from .services import create_member, get_member, run_action


class RegressionTests(unittest.TestCase):
    def test_aggregated_visits_keep_kigali_boundaries_scope_and_full_counts(self):
        start = day_start(today())
        # More than the displayed 200-row log: counts must not inherit its limit.
        events = [
            AccessEvent(id=str(uuid.uuid4()), member_id=self.member.id,
                        member_name="Fictional Member", branch_id=2,
                        method="MANUAL_RECEPTION", decision="ALLOWED",
                        reason="Membership valid", occurred_at=start + timedelta(minutes=i),
                        offline=False, sync_status="SYNCED")
            for i in range(205)
        ]
        for at, decision in [(start - timedelta(seconds=1), "ALLOWED"),
                             (start, "DENIED"), (start, "MANUAL_OVERRIDE")]:
            events.append(AccessEvent(id=str(uuid.uuid4()), member_id=None,
                member_name="Other", branch_id=3, method="MANUAL_RECEPTION",
                decision=decision, reason="Test", occurred_at=at,
                offline=False, sync_status="SYNCED"))
        self.db.add_all(events)
        self.db.commit()
        self.assertEqual(branch_checkins_today(self.db), {2: 205, 3: 1})
        staff = workspace(self.db, self.admin)
        self.assertEqual(len(staff["access_events"]), 200)
        self.assertEqual(staff["metrics"]["checkins_today"], 206)
        self.assertEqual(staff["visit_trend"][-2]["branch3"], 1)
        member_user = User(name="Member", email="scoped@example.test", role="MEMBER",
                           member_id=self.member.id, password_hash="unused", created_at=now())
        self.db.add(member_user)
        self.db.commit()
        own = workspace(self.db, member_user)
        self.assertEqual(own["metrics"]["checkins_today"], 205)
        self.assertTrue(all(day["branch3"] == 0 for day in own["visit_trend"]))

    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.db.add_all([Branch(id=i, name=f"Branch {i}", type="GATED" if i == 1 else "RECEPTION")
                         for i in (1, 2, 3)])
        self.db.add(Plan(id=1, name="Editable Demo", price=75000, duration_days=30, description="Illustrative"))
        self.db.add(Config(key="demo_generation", value="test"))
        self.admin = User(name="Admin", email="admin@example.test", role="ADMIN",
                          password_hash="unused", created_at=now())
        self.db.add(self.admin)
        self.db.commit()
        self.member, _ = create_member(self.db, self.input())
        self.db.commit()
        for typ in ("CARD", "QR"):
            self.db.add(Credential(member_id=self.member.id, type=typ, identifier=typ,
                                   status="ACTIVE", created_at=now()))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def input(self, email="fictional@example.test"):
        return dict(full_name="Fictional Member", email=email, phone="+250788000111",
                    branch_id=2, plan_id=1, notes="Demo notes", emergency_contact="Fictional contact")

    def action(self, action, **body):
        return run_action(self.db, self.admin, {"action": action, **body})

    def check(self, branch, method, **kw):
        return self.action("checkin", branch_id=branch, method=method,
                           member_id=self.member.id, **kw)["event"]

    def test_all_access_methods_share_effective_membership_rules(self):
        ms = self.db.scalar(select(Membership))
        cases = [(today() - timedelta(days=1), today() + timedelta(days=10), "ACTIVE", "ALLOWED", "Membership valid"),
                 (today() - timedelta(days=10), today() - timedelta(days=1), "ACTIVE", "DENIED", "expired"),
                 (today() + timedelta(days=1), today() + timedelta(days=10), "ACTIVE", "DENIED", "pending"),
                 (today(), today(), "ACTIVE", "ALLOWED", "Membership valid"),
                 (today(), today() + timedelta(days=10), "PAUSED", "DENIED", "paused")]
        methods = [(1, "SPEEDGATE_CARD", "CARD")] + [
            (b, m, c) for b in (2, 3) for m, c in
            [("MANUAL_RECEPTION", None), ("RECEPTION_CARD", "CARD"), ("RECEPTION_QR", "QR")]]
        for start, end, status, decision, reason in cases:
            ms.start_date, ms.end_date, ms.status = start, end, status
            self.db.commit()
            for branch, method, identifier in methods:
                with self.subTest(status=reason, branch=branch, method=method):
                    event = self.check(branch, method, identifier=identifier)
                    self.assertEqual(event["decision"], decision)
                    self.assertIn(reason, event["reason"])

    def test_unknown_disabled_wrong_type_and_branch_restrictions(self):
        card = self.db.scalar(select(Credential).where(Credential.type == "CARD"))
        card.status = "DISABLED"; self.db.commit()
        for branch in (2, 3):
            for identifier, reason in [("CARD", "disabled"), ("UNKNOWN", "Unknown"), ("QR", "CARD credential required")]:
                event = self.check(branch, "RECEPTION_CARD", identifier=identifier)
                self.assertEqual(event["decision"], "DENIED")
                self.assertIn(reason, event["reason"])
        for branch, method in [(1, "MANUAL_RECEPTION"), (1, "RECEPTION_QR"), (2, "SPEEDGATE_CARD"), (3, "SPEEDGATE_CARD")]:
            with self.assertRaises(HTTPException) as caught:
                self.check(branch, method)
            self.assertEqual(caught.exception.status_code, 400)

    def test_registration_assign_existing_card_and_immediate_gate(self):
        result = self.action("register_member", member={
            **self.input("new-registration@example.test"),
            "start_date": today().isoformat(),
            "end_date": (today() + timedelta(days=30)).isoformat()})
        member_id = result["member"]["id"]
        result = self.action("assign_card", member_id=member_id,
                             identifier="FICTIONAL-EXISTING-CARD", credential_type="CARD")
        self.assertEqual(result["member"]["credentials"][0]["identifier"], "FICTIONAL-EXISTING-CARD")
        event = self.action("checkin", branch_id=1, method="SPEEDGATE_CARD",
                            identifier="FICTIONAL-EXISTING-CARD")["event"]
        self.assertEqual(event["decision"], "ALLOWED")
        self.assertEqual(event["member_id"], member_id)

    def test_missing_membership_and_legacy_serialization(self):
        missing = Member(full_name="No membership", phone="1", email="none@example.test", branch_id=2, created_at=now())
        self.db.add(missing); self.db.commit()
        result = self.action("checkin", branch_id=2, method="MANUAL_RECEPTION", member_id=missing.id)
        self.assertEqual(result["event"]["decision"], "DENIED")
        self.assertIn("missing", result["event"]["reason"])
        snapshot = workspace(self.db, self.admin)
        self.assertEqual(snapshot["members"][-1]["status"], "MISSING")
        stored = self.db.get(AccessEvent, result["event"]["id"])
        stored.decision = "MANUAL_OVERRIDE"
        self.db.commit()
        self.assertEqual(event_json(stored)["decision"], "ALLOWED")
        self.assertEqual(stored.decision, "MANUAL_OVERRIDE")

    def test_reminder_runs_metrics_and_exact_registry(self):
        ids = [self.action("run_reminders", member_id=self.member.id, all_fail=fail)["run_id"]
               for fail in (True, True, False)]
        self.assertEqual(len(set(ids)), 3)
        data = workspace(self.db, self.admin)
        self.assertEqual(len(data["notification_runs"]), 3)
        self.assertEqual(data["metrics"]["failed_notification_chains"], 2)
        self.assertEqual(data["metrics"]["followup_count"], 2)
        self.assertEqual(data["metrics"]["failed_notification_attempts"], 10)
        self.assertEqual(data["metrics"]["failed_notifications"], 10)
        for run in data["notification_runs"]:
            registry = json.loads(self.db.get(Config, "notification_run:" + run["id"]).value)
            self.assertEqual(registry["event_ids"], [n["id"] for n in run["attempts"]])
            self.assertFalse(run["legacy"])
        self.db.expire_all()
        self.assertEqual({r["id"] for r in workspace(self.db, self.admin)["notification_runs"]}, set(ids))

    def test_interleaved_registry_ids_and_conservative_legacy(self):
        # Simulate interleaved auto-increment allocation across two transactions.
        grouped = [[], []]
        for attempt, channel in enumerate(["WHATSAPP", "WHATSAPP", "SMS", "EMAIL"], 1):
            for group in grouped:
                n = NotificationEvent(member_id=self.member.id, channel=channel, status="FAILED",
                                      attempt=attempt, final_status="STAFF FOLLOW-UP REQUIRED",
                                      created_at=now() + timedelta(seconds=attempt))
                self.db.add(n); self.db.flush(); group.append(n.id)
        for group in grouped:
            self.db.add(Config(key="notification_run:" + str(uuid.uuid4()), value=json.dumps({"event_ids": group})))
        self.db.commit()
        self.assertEqual(len(notification_runs(self.db, self.db.scalars(select(NotificationEvent)).all())), 2)
        # Known seed-style all-fail history reconstructs one chain without writes.
        for attempt, channel in enumerate(["WHATSAPP", "WHATSAPP", "SMS", "EMAIL"], 1):
            self.db.add(NotificationEvent(member_id=self.member.id, channel=channel, status="FAILED",
                       attempt=attempt, final_status="STAFF FOLLOW-UP REQUIRED", created_at=now() + timedelta(minutes=attempt)))
        self.db.add(NotificationEvent(member_id=self.member.id, channel="SMS", status="FAILED",
                    attempt=3, final_status="STAFF FOLLOW-UP REQUIRED", created_at=now()))
        self.db.commit()
        data = workspace(self.db, self.admin)
        legacy = [r for r in data["notification_runs"] if r["legacy"]]
        self.assertEqual(len(legacy), 2)
        self.assertEqual(sum(r["uncertain"] for r in legacy), 1)
        self.assertEqual(data["metrics"]["failed_notification_chains"], 3)

    def test_csv_batches_replay_and_persistent_mappings(self):
        raw = sample_export(self.admin, self.db).body.decode()
        rows = self.action("preview_migration", csv=raw)["rows"]
        self.assertEqual(sum(not r["issues"] for r in rows), 8)
        for r in rows:
            r["skip"] = bool(r["issues"])
        result = self.action("import_migration", rows=rows)
        self.assertEqual((result["imported"], result["skipped"]), (8, 2))
        replay = self.action("import_migration", rows=rows)
        self.assertEqual((replay["imported"], replay["skipped"]), (0, 10))
        self.db.expire_all()
        history = workspace(self.db, self.admin)["migrations"]
        self.assertEqual(len(history), 10)
        self.assertEqual(sum(r["waka_member_id"] is not None for r in history), 8)
        fresh = self.action("preview_migration", csv=sample_export(self.admin, self.db).body.decode())["rows"]
        self.assertEqual(sum(not r["issues"] for r in fresh), 8)
        self.assertFalse(set(r["source_record_id"] for r in rows) & set(r["source_record_id"] for r in fresh))

    def test_roles_and_member_snapshot(self):
        for role in ("RECEPTION", "MANAGEMENT", "MEMBER"):
            actor = User(role=role, member_id=self.member.id, email=f"{role}@example.test")
            for action in ("preview_migration", "import_migration", "update_plan", "reset_demo"):
                with self.assertRaises(HTTPException) as caught:
                    run_action(self.db, actor, {"action": action})
                self.assertEqual(caught.exception.status_code, 403)
            with self.assertRaises(HTTPException):
                sample_export(actor, self.db)
        other, _ = create_member(self.db, self.input("other@example.test"))
        self.db.commit()
        actor = User(role="MEMBER", member_id=self.member.id, email=self.member.email, name="Member", id=99)
        data = workspace(self.db, actor)
        self.assertEqual([m["id"] for m in data["members"]], [self.member.id])
        self.assertTrue(all(p["member_id"] == self.member.id for p in data["payments"]))
        self.assertEqual(data["migrations"], [])
        self.assertEqual(data["system_events"], [])
        with self.assertRaises(HTTPException):
            run_action(self.db, actor, {"action": "renew_membership", "member_id": other.id, "plan_id": 1})
        with self.assertRaises(HTTPException):
            run_action(self.db, actor, {"action": "checkin"})

    def test_join_simulated_payment_and_renewal_immediate_access(self):
        response = Response()
        result = join({**self.input("joined@example.test"), "password": "fictional-password",
                       "record_payment": False}, response, self.db)
        member_id = result["member"]["id"]
        user = self.db.scalar(select(User).where(User.member_id == member_id))
        self.assertEqual(user.role, "MEMBER")
        payment = self.db.scalar(select(Payment).where(Payment.member_id == member_id))
        self.assertEqual((payment.provider, payment.status, int(payment.amount)), ("SIMULATED", "SUCCESS", 75000))
        self.assertIn("waka_session", response.headers["set-cookie"])
        self.assertEqual(result["member"]["notes"], "Demo notes")
        ms = self.db.scalar(select(Membership).where(Membership.member_id == self.member.id))
        ms.end_date = today() - timedelta(days=1)
        ms.start_date = today() - timedelta(days=31)
        self.db.commit()
        self.assertEqual(self.check(1, "SPEEDGATE_CARD", identifier="CARD")["decision"], "DENIED")
        for _ in range(2):
            self.action("renew_membership", member_id=self.member.id, plan_id=1)
            self.assertEqual(self.check(1, "SPEEDGATE_CARD", identifier="CARD")["decision"], "ALLOWED")

    def test_offline_sync_two_events_idempotent(self):
        events = [dict(id=str(uuid.uuid4()), member_id=self.member.id, branch_id=1, method="SPEEDGATE_CARD",
                       decision="ALLOWED", reason="Cached membership valid", occurred_at=now().isoformat()) for _ in range(2)]
        self.assertEqual(self.action("sync_offline", generation="test", events=events)["synced"], 2)
        self.assertEqual(self.action("sync_offline", generation="test", events=events)["synced"], 0)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(AccessEvent)), 2)


if __name__ == "__main__":
    unittest.main()
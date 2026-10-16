"""Isolated fictional money tests; never connect to a live database."""
import uuid
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import func, select

from .common import now, today
from .models import Member, Membership, Payment, User, WalletAccount, WalletEntry, WalletOperation
from .serializers import member_json, workspace
from .services import run_action
from .test_regressions import RegressionTests
from .wallet import run_wallet_action, two_months_after, wallet_view


class WalletTests(unittest.TestCase):
    setUp = RegressionTests.setUp
    tearDown = RegressionTests.tearDown
    input = RegressionTests.input

    def act(self, action, actor=None, **fields):
        if action in {"wallet_topup", "wallet_purchase", "wallet_request_refund"}:
            fields.setdefault("idempotency_key", str(uuid.uuid4()))
        return run_wallet_action(self.db, actor or self.admin,
                                 dict(action=action, member_id=self.member.id, **fields))

    def fund(self, amount=100000):
        op = self.act("wallet_topup", amount=amount)["operation"]
        self.act("wallet_confirm_topup", operation_id=op["id"], outcome="SUCCESSFUL")
        return op["id"]

    def refund(self, amount=25000, category="VOLUNTARY", outcome="SUCCESSFUL"):
        op = self.act("wallet_request_refund", amount=amount, reason="Leaving the gym")["operation"]
        self.act("wallet_review_refund", operation_id=op["id"], decision="APPROVE", category=category)
        self.act("wallet_confirm_refund", operation_id=op["id"], outcome=outcome)
        return op["id"]

    def view(self):
        return wallet_view(self.db, self.admin, self.member.id)

    def check_reconciled(self):
        account = self.db.get(WalletAccount, self.member.id)
        sums = self.db.execute(select(func.coalesce(func.sum(WalletEntry.balance_delta), 0),
            func.coalesce(func.sum(WalletEntry.reserved_delta), 0))).one()
        remaining = self.db.scalar(select(func.coalesce(func.sum(WalletOperation.remaining), 0)))
        self.assertEqual((account.balance, account.reserved), tuple(sums))
        self.assertEqual(account.balance - account.reserved, remaining)

    def test_deposit_is_pending_until_success_and_does_not_renew(self):
        before = member_json(self.member)
        pending = self.act("wallet_topup", amount=100000)["operation"]
        self.assertEqual(self.view()["available"], 0)
        self.act("wallet_confirm_topup", operation_id=pending["id"], outcome="SUCCESSFUL")
        self.assertEqual(self.view()["available"], 100000)
        self.assertEqual(member_json(self.member), before)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Payment)), 1)
        self.check_reconciled()

    def test_duplicate_confirmation_and_changed_outcome(self):
        deposit = self.fund()
        self.act("wallet_confirm_topup", operation_id=deposit, outcome="SUCCESSFUL")
        self.assertEqual(self.view()["balance"], 100000)
        with self.assertRaises(HTTPException):
            self.act("wallet_confirm_topup", operation_id=deposit, outcome="FAILED")
        self.db.rollback()
        self.check_reconciled()

    def test_failed_deposit_adds_no_credit(self):
        op = self.act("wallet_topup", amount=100000)["operation"]
        self.act("wallet_confirm_topup", operation_id=op["id"], outcome="FAILED")
        self.assertEqual(self.view()["balance"], 0)
        self.check_reconciled()

    def test_purchase_and_replay_extend_once_without_double_counting_deposit(self):
        before = max(ms.end_date for ms in self.member.memberships)
        self.fund()
        key = str(uuid.uuid4())
        first = self.act("wallet_purchase", plan_id=1, idempotency_key=key)
        replay = self.act("wallet_purchase", plan_id=1, idempotency_key=key)
        self.assertEqual(first["operation"]["id"], replay["operation"]["id"])
        self.db.expire_all()
        self.assertEqual(max(ms.end_date for ms in self.member.memberships), before + timedelta(days=30))
        self.assertEqual(self.view()["balance"], 25000)
        self.assertEqual(workspace(self.db, self.admin)["metrics"]["payments_today"], 150000)
        self.check_reconciled()

    def test_insufficient_credit_cannot_create_payment_or_membership(self):
        self.fund(100)
        before = self.db.scalar(select(func.count()).select_from(Membership))
        with self.assertRaises(HTTPException):
            self.act("wallet_purchase", plan_id=1)
        self.db.rollback()
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Membership)), before)
        self.assertEqual(self.view()["balance"], 100)

    def test_refund_reserves_funds_and_only_success_starts_cooldown(self):
        self.fund()
        op = self.act("wallet_request_refund", amount=50000, reason="Leaving WAKA")["operation"]
        self.assertEqual((self.view()["balance"], self.view()["available"]), (100000, 50000))
        self.assertTrue(self.view()["can_topup"])
        with self.assertRaises(HTTPException):
            self.act("wallet_purchase", plan_id=1)
        self.db.rollback()
        self.act("wallet_review_refund", operation_id=op["id"], decision="APPROVE", category="VOLUNTARY")
        self.assertTrue(self.view()["can_topup"])
        self.act("wallet_confirm_refund", operation_id=op["id"], outcome="SUCCESSFUL")
        self.act("wallet_confirm_refund", operation_id=op["id"], outcome="SUCCESSFUL")
        self.assertEqual(self.view()["balance"], 50000)
        self.assertFalse(self.view()["can_topup"])
        self.assertEqual(self.view()["topup_blocked_until"], two_months_after(today()).isoformat())
        self.check_reconciled()

    def test_cooldown_blocks_topups_but_allows_existing_credit_and_direct_purchase(self):
        self.fund(200000)
        self.refund()
        with self.assertRaises(HTTPException):
            self.act("wallet_topup", amount=1000)
        self.db.rollback()
        self.act("wallet_purchase", plan_id=1)
        run_action(self.db, self.admin, dict(action="renew_membership", member_id=self.member.id,
            plan_id=1, idempotency_key=str(uuid.uuid4())))
        self.assertEqual(self.view()["balance"], 100000)
        self.check_reconciled()

    def test_failed_refund_releases_reserve_without_cooldown(self):
        self.fund()
        self.refund(outcome="FAILED")
        self.assertEqual((self.view()["available"], self.view()["reserved"]), (100000, 0))
        self.assertTrue(self.view()["can_topup"])
        self.check_reconciled()

    def test_rejected_refund_releases_credit(self):
        self.fund()
        op = self.act("wallet_request_refund", amount=100000, reason="Changed mind")["operation"]
        self.act("wallet_review_refund", operation_id=op["id"], decision="REJECT", category="VOLUNTARY")
        self.assertEqual(self.view()["available"], 100000)
        self.check_reconciled()

    def test_payment_error_refund_does_not_penalize_member(self):
        self.fund()
        self.refund(category="PAYMENT_ERROR")
        self.assertTrue(self.view()["can_topup"])
        self.check_reconciled()

    def test_two_calendar_months_month_end_and_exact_unblock_day(self):
        self.assertEqual(two_months_after(date(2026, 12, 31)), date(2027, 2, 28))
        self.assertEqual(two_months_after(date(2027, 12, 31)), date(2028, 2, 29))
        self.fund()
        self.refund()
        until = self.db.get(WalletAccount, self.member.id).topup_blocked_until
        with patch("backend.wallet.today", return_value=until):
            self.assertTrue(self.view()["can_topup"])
            self.act("wallet_topup", amount=1000)

    def test_late_deposit_is_credited_during_cooldown(self):
        self.fund()
        op = self.act("wallet_topup", amount=10000)["operation"]
        self.refund()
        self.act("wallet_confirm_topup", operation_id=op["id"], outcome="SUCCESSFUL")
        self.assertEqual(self.view()["balance"], 85000)
        self.check_reconciled()

    def test_cross_member_and_admin_refund_permissions(self):
        self.fund()
        stranger = User(role="MEMBER", member_id=999)
        with self.assertRaises(HTTPException):
            wallet_view(self.db, stranger, self.member.id)
        op = self.act("wallet_request_refund", amount=1000, reason="Example reason")["operation"]
        own = User(role="MEMBER", member_id=self.member.id)
        with self.assertRaises(HTTPException):
            self.act("wallet_review_refund", actor=own, operation_id=op["id"], decision="APPROVE", category="PAYMENT_ERROR")
        self.db.rollback()

    def test_strict_inputs_and_production_fail_closed(self):
        for amount in (-1, 0, 1.5, True, "1000"):
            with self.subTest(amount=amount), self.assertRaises(HTTPException):
                self.act("wallet_topup", amount=amount)
            self.db.rollback()
        with patch("backend.services.DEMO_MODE", False), self.assertRaises(HTTPException):
            self.act("wallet_topup", amount=1000)

    def test_idempotency_key_cannot_change_amount_or_operation(self):
        key = str(uuid.uuid4())
        first = self.act("wallet_topup", amount=1000, idempotency_key=key)
        replay = self.act("wallet_topup", amount=1000, idempotency_key=key)
        self.assertEqual(first["operation"]["id"], replay["operation"]["id"])
        with self.assertRaises(HTTPException):
            self.act("wallet_topup", amount=2000, idempotency_key=key)

    def test_stale_admin_form_cannot_erase_direct_or_wallet_renewal(self):
        for wallet in (False, True):
            with self.subTest(wallet=wallet):
                before = member_json(self.member)
                if wallet:
                    self.fund()
                    self.act("wallet_purchase", plan_id=1)
                else:
                    run_action(self.db, self.admin, dict(action="renew_membership", member_id=self.member.id,
                        plan_id=1, idempotency_key=str(uuid.uuid4())))
                end = max(ms.end_date for ms in self.member.memberships)
                with self.assertRaises(HTTPException) as caught:
                    run_action(self.db, self.admin, dict(action="update_member", member_id=self.member.id,
                        expected_version=before["version"], member={**self.input(), "notes": "Stale edit",
                            "start_date": before["start_date"], "end_date": before["end_date"]}))
                self.assertEqual(caught.exception.status_code, 409)
                self.db.rollback()
                self.assertEqual(max(ms.end_date for ms in self.member.memberships), end)

    def test_current_profile_save_succeeds(self):
        result = run_action(self.db, self.admin, dict(action="update_member", member_id=self.member.id,
            expected_version=self.member.version, member={**self.input(), "notes": "Current edit"}))
        self.assertEqual(result["member"]["notes"], "Current edit")
        self.assertEqual(result["member"]["version"], 1)


if __name__ == "__main__":
    unittest.main()

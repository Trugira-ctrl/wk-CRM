"""Provider-verified sandbox credit invariants; no external calls or configured DB."""
import json
import unittest
import uuid
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from . import momo_sandbox as lab
from .common import now
from .db import Base
from .models import MomoSandboxPayment, User, WalletAccount, WalletEntry, Membership, Payment
from .momo_client import MomoSandboxClient, ProviderError, TEST_PAYERS


class FakeProvider:
    configured = True
    def __init__(self, state="SUCCESSFUL", changes=None, submit_error=None):
        self.state, self.changes, self.submit_error = state, changes or {}, submit_error
        self.posts, self.gets = 0, 0

    def submit(self, reference, amount, scenario):
        self.posts += 1
        self.amount, self.scenario = amount, scenario
        if self.submit_error:
            raise self.submit_error

    def status(self, reference):
        self.gets += 1
        return {"status": self.state, "amount": f"{self.amount / 100:.2f}", "currency": "EUR",
            "externalId": reference, "payer": {"partyIdType": "MSISDN", "partyId": TEST_PAYERS[self.scenario]},
            "financialTransactionId": "TEST-"+reference, **self.changes}


class MomoSandboxTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.user = User(name="Test admin", email="sandbox@example.test", role="ADMIN", password_hash="unused", created_at=now())
        self.db.add(self.user)
        self.db.commit()
        self.flags = patch.dict("os.environ", {"MOMO_SANDBOX_ENABLED": "true"})
        self.flags.start()

    def tearDown(self):
        self.flags.stop()
        self.db.close()
        self.engine.dispose()

    def start(self, provider, **updates):
        return lab.start(self.db, self.user, {"idempotency_key":str(uuid.uuid4()), "amount_minor":1000,
            "scenario":"SUCCESSFUL", **updates}, provider)

    def test_accepted_request_is_not_payment_and_success_is_credited_once(self):
        provider = FakeProvider()
        data = self.start(provider)
        self.assertEqual((data["status"], data["credited_minor"]), ("PENDING", 0))
        for _ in range(3):
            result = lab.check(self.db, self.user, data["id"], provider)
        self.assertEqual((result["status"], result["credited_minor"]), ("SUCCESSFUL", 1000))
        self.assertEqual(provider.gets, 1)
        proof = lab.receipt(self.db, self.user, data["id"])
        self.assertFalse(proof["real_money"])
        self.assertEqual(proof["provider_response"]["externalId"], data["id"])
        self.assertEqual(proof["verification_method"], "authenticated_provider_status_check")
        for model in (WalletAccount, WalletEntry, Membership, Payment):
            self.assertEqual(self.db.scalar(select(func.count()).select_from(model)), 0)

    def test_failure_and_pending_add_no_credit(self):
        for state in ("FAILED", "PENDING"):
            provider = FakeProvider(state)
            data = self.start(provider, scenario=state)
            result = lab.check(self.db, self.user, data["id"], provider)
            self.assertEqual((result["status"], result["credited_minor"]), (state, 0))

    def test_payment_mismatch_requires_review(self):
        for changes in ({"amount":"20.00"}, {"currency":"RWF"}, {"externalId":"wrong"},
                        {"amount":"NaN"}, {"financialTransactionId":""}, {"payer":{}}, {"status":"OTHER"}):
            provider = FakeProvider(changes=changes)
            data = self.start(provider)
            result = lab.check(self.db, self.user, data["id"], provider)
            self.assertEqual((result["status"], result["credited_minor"]), ("REVIEW", 0))

    def test_same_provider_transaction_cannot_fund_two_payments(self):
        for index in range(2):
            provider = FakeProvider(changes={"financialTransactionId":"SAME-TRANSACTION"})
            data = self.start(provider)
            result = lab.check(self.db, self.user, data["id"], provider)
            self.assertEqual(result["status"], "SUCCESSFUL" if index == 0 else "REVIEW")
        self.assertEqual(self.db.scalar(select(func.sum(MomoSandboxPayment.credited_minor))), 1000)

    def test_uncertain_submission_keeps_reference_and_retry_does_not_post_again(self):
        provider = FakeProvider(submit_error=ProviderError(504, "Uncertain submission"))
        key = str(uuid.uuid4())
        first = self.start(provider, idempotency_key=key)
        second = self.start(provider, idempotency_key=key)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["status"], "SUBMISSION_UNKNOWN")
        self.assertEqual(provider.posts, 1)
        with self.assertRaises(HTTPException) as error:
            self.start(provider, idempotency_key=key, amount_minor=1200)
        self.assertEqual(error.exception.status_code, 409)
        self.assertEqual(lab.check(self.db,self.user,first["id"],provider)["credited_minor"], 1000)

    def test_permissions_and_configuration_are_enforced(self):
        for role in ("MEMBER", "RECEPTION", "MANAGEMENT"):
            with self.assertRaises(HTTPException):
                lab.overview(self.db, User(role=role))
        with patch.object(lab, "ENVIRONMENT", "production"):
            with self.assertRaises(HTTPException):
                self.start(FakeProvider())
        with patch.dict("os.environ", {"MOMO_SANDBOX_ENABLED":"false"}):
            with self.assertRaises(HTTPException):
                self.start(FakeProvider())
        with self.assertRaises(HTTPException):
            self.start(FakeProvider(), scenario="ANY", payer="REAL_PHONE")

    def test_http_client_uses_only_sandbox_and_preserves_reference(self):
        client = MomoSandboxClient("a"*32,str(uuid.uuid4()),"b"*32)
        self.assertTrue(client.configured)
        calls = []
        def request(method,path,body=None,headers=None):
            calls.append((method,path,body,headers))
            return (200,{"access_token":"TEST-TOKEN"}) if path == "/collection/token/" else (202,{})
        with patch.object(client,"request",side_effect=request):
            reference = str(uuid.uuid4())
            client.submit(reference,1000,"FAILED")
        self.assertEqual(calls[-1][2]["currency"], "EUR")
        self.assertEqual(calls[-1][2]["payer"]["partyId"],TEST_PAYERS["FAILED"])
        self.assertEqual(calls[-1][3]["X-Reference-Id"],reference)
        self.assertEqual(calls[-1][2]["externalId"],reference)


if __name__ == "__main__":
    unittest.main()

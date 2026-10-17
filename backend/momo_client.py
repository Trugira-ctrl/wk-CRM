"""MTN Collections sandbox only. No production URL or arbitrary payer is accepted."""
import base64
import json
import os
import uuid
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

SANDBOX_URL = "https://sandbox.momodeveloper.mtn.com"
TEST_PAYERS = {"SUCCESSFUL": "46733123499", "FAILED": "46733123450", "PENDING": "46733123453"}


class ProviderError(Exception):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class MomoSandboxClient:
    def __init__(self, subscription_key=None, api_user=None, api_key=None):
        self.subscription_key = subscription_key or os.environ.get("MOMO_SANDBOX_SUBSCRIPTION_KEY", "")
        self.api_user = api_user or os.environ.get("MOMO_SANDBOX_API_USER", "")
        self.api_key = api_key or os.environ.get("MOMO_SANDBOX_API_KEY", "")
        self.opener = build_opener(NoRedirect())

    @property
    def configured(self):
        try:
            return bool(len(self.subscription_key) >= 16 and uuid.UUID(self.api_user).version == 4 and len(self.api_key) >= 16)
        except ValueError:
            return False

    def request(self, method, path, body=None, headers=None):
        # Constant origin and no redirects prevent credentials reaching another host.
        data = None if body is None else json.dumps(body).encode()
        request = Request(SANDBOX_URL + path, data=data, method=method, headers={
            "Ocp-Apim-Subscription-Key": self.subscription_key,
            "X-Target-Environment": "sandbox", "Content-Type": "application/json", **(headers or {})})
        try:
            with self.opener.open(request, timeout=10) as response:
                raw = response.read(65537)
                if len(raw) > 65536:
                    raise ProviderError(502, "MTN returned an oversized response")
                return response.status, json.loads(raw) if raw else {}
        except HTTPError as error:
            # Never include token, key, HTTP headers or provider error bodies in logs/UI.
            code = error.code
            error.close()
            raise ProviderError(code, f"MTN sandbox returned HTTP {code}") from None
        except (URLError, TimeoutError, OSError):
            raise ProviderError(504, "MTN sandbox could not be reached; check this payment's status before retrying") from None
        except (ValueError, UnicodeError):
            raise ProviderError(502, "MTN returned an unreadable response") from None

    def token(self):
        if not self.configured:
            raise ProviderError(503, "MTN sandbox credentials are not configured")
        auth = base64.b64encode(f"{self.api_user}:{self.api_key}".encode()).decode()
        code, data = self.request("POST", "/collection/token/", {}, {"Authorization": "Basic " + auth})
        if code != 200 or not isinstance(data, dict) or not isinstance(data.get("access_token"), str):
            raise ProviderError(502, "MTN did not return an access token")
        return data["access_token"]

    def submit(self, reference, amount_minor, scenario):
        reference = str(uuid.UUID(reference))
        if scenario not in TEST_PAYERS or type(amount_minor) is not int or not 100 <= amount_minor <= 100000:
            raise ProviderError(400, "Invalid sandbox test request")
        token = self.token()
        body = {"amount": f"{amount_minor // 100}.{amount_minor % 100:02d}", "currency": "EUR",
                "externalId": reference, "payer": {"partyIdType": "MSISDN", "partyId": TEST_PAYERS[scenario]},
                "payerMessage": "WAKA sandbox test", "payeeNote": "WAKA sandbox test"}
        code, _ = self.request("POST", "/collection/v1_0/requesttopay", body,
                               {"Authorization": "Bearer " + token, "X-Reference-Id": reference})
        if code != 202:
            raise ProviderError(502, "MTN did not accept the sandbox request")

    def status(self, reference):
        reference = str(uuid.UUID(reference))
        code, body = self.request("GET", "/collection/v1_0/requesttopay/" + reference,
                                 headers={"Authorization": "Bearer " + self.token()})
        if code != 200 or not isinstance(body, dict):
            raise ProviderError(502, "MTN returned an invalid payment status")
        return body

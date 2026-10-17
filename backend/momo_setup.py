"""Provision sandbox credentials from a private local JSON file; never print secrets."""
import argparse
import json
import os
from pathlib import Path
import uuid

from .momo_client import MomoSandboxClient, ProviderError


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--callback-host", default="44.210.143.148")
    parser.add_argument("--retry-user", action="store_true", help="Explicitly retry unresolved user creation with the SAME reference")
    args = parser.parse_args()
    os.umask(0o077)
    path = Path(args.config)
    if path.stat().st_mode & 0o077:
        raise SystemExit("Credential file must be private (permission 600)")
    settings = json.loads(path.read_text())
    if settings.get("api_key"):
        print("Existing sandbox credentials preserved; no key rotation performed.")
        return
    settings.setdefault("api_user", str(uuid.uuid4()))
    settings.setdefault("callback_host", args.callback_host)
    def save():
        temporary = path.with_suffix(".pending")
        temporary.write_text(json.dumps(settings, indent=2)+"\n")
        temporary.chmod(0o600)
        temporary.replace(path)
    save()
    client = MomoSandboxClient(settings["subscription_key"], settings["api_user"], "")
    reference = settings["api_user"]
    if not settings.get("user_created"):
        try:
            code, details = client.request("GET", "/v1_0/apiuser/"+reference)
            exists = code == 200 and details.get("targetEnvironment") == "sandbox"
        except ProviderError as error:
            # An unprovisioned user may trigger a provider-side 500. Permit
            # exactly one initial creation attempt, retaining its reference.
            if error.code != 404 and not (error.code == 500 and (not settings.get("user_creation_attempted") or args.retry_user)):
                raise SystemExit(str(error)) from None
            exists = False
        if not exists:
            if settings.get("user_creation_attempted") and not args.retry_user:
                raise SystemExit("Previous user creation is unresolved. Check MTN before another creation attempt.")
            settings["user_creation_attempted"] = True
            save()
            try:
                code, _ = client.request("POST", "/v1_0/apiuser", {"providerCallbackHost":settings["callback_host"]},
                                         {"X-Reference-Id":reference})
                if code != 201:
                    raise ProviderError(code, "MTN did not confirm API user creation")
            except ProviderError as error:
                settings["last_setup_error"] = str(error)
                save()
                raise SystemExit(str(error)+". The same user reference is retained for status checking.") from None
        settings["user_created"] = True
        settings.pop("last_setup_error",None)
        save()
    if settings.get("key_creation_uncertain"):
        raise SystemExit("Previous key creation was uncertain. Review MTN provisioning before requesting another key.")
    settings["key_creation_uncertain"] = True
    save()
    try:
        code, response = client.request("POST", "/v1_0/apiuser/"+reference+"/apikey", {})
        if code != 201 or not isinstance(response.get("apiKey"),str):
            raise ProviderError(code, "MTN did not return a sandbox API key")
    except ProviderError as error:
        raise SystemExit(str(error)+". No credentials were printed; review provisioning before retrying.") from None
    settings["api_key"] = response["apiKey"]
    settings["key_creation_uncertain"] = False
    save()
    client = MomoSandboxClient(settings["subscription_key"],reference,settings["api_key"])
    client.token()
    print("Sandbox API user and key created, saved privately and authenticated. No real-money endpoint is enabled.")


if __name__ == "__main__":
    main()

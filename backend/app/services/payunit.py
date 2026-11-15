"""PayUnit REST API client (https://developer.payunit.net/rest-api)."""
import base64

import httpx

from ..config import settings


class PayUnitError(Exception):
    pass


def _headers() -> dict[str, str]:
    creds = base64.b64encode(
        f"{settings.payunit_api_user}:{settings.payunit_api_password}".encode()
    ).decode()
    return {
        "Content-Type": "application/json",
        "Authorization": f"Basic {creds}",
        "x-api-key": settings.payunit_api_key,
        "mode": settings.payunit_mode,
    }


def _check(resp: httpx.Response) -> dict:
    try:
        data = resp.json()
    except ValueError:
        raise PayUnitError(f"PayUnit returned non-JSON response ({resp.status_code})")
    if resp.status_code >= 400 or data.get("status") != "SUCCESS":
        raise PayUnitError(data.get("message") or f"PayUnit error ({resp.status_code})")
    return data


def initialize_payment(*, transaction_id: str, amount: float, currency: str,
                       return_url: str, notify_url: str) -> dict:
    """Create a hosted-page payment. Returns data incl. transaction_url."""
    payload = {
        "total_amount": amount,
        "currency": currency,
        "transaction_id": transaction_id,
        "return_url": return_url,
        "notify_url": notify_url,
    }
    if settings.payunit_country:
        payload["payment_country"] = settings.payunit_country
    resp = httpx.post(f"{settings.payunit_base_url}/api/gateway/initialize",
                      json=payload, headers=_headers(), timeout=30)
    return _check(resp)["data"]


def get_payment_status(transaction_id: str) -> dict:
    """Poll transaction status. Returns data.transaction_status."""
    resp = httpx.get(f"{settings.payunit_base_url}/api/gateway/paymentstatus/{transaction_id}",
                     headers=_headers(), timeout=30)
    return _check(resp)["data"]

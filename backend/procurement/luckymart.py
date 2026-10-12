"""Small client for the Lucky Mart backend (Go/Gin, /api/v1).

The portal logs in to Lucky Mart as a service account with a warehouse role,
keeps the access token in memory, and logs in again once if it expires.
"""

import logging
import threading

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class LuckyMartError(Exception):
    pass


class LuckyMartNotConfigured(LuckyMartError):
    pass


class LuckyMartClient:
    def __init__(self, api_url, phone_number, password, timeout=10.0, session=None):
        self.api_url = api_url.rstrip("/")
        self.phone_number = phone_number
        self.password = password
        self.timeout = timeout
        self.session = session or requests.Session()
        self._token = None
        self._lock = threading.Lock()

    @classmethod
    def from_settings(cls):
        cfg = settings.LUCKY_MART
        if not (cfg["API_URL"] and cfg["PHONE_NUMBER"] and cfg["PASSWORD"]):
            raise LuckyMartNotConfigured("Lucky Mart integration is not configured.")
        return cls(cfg["API_URL"], cfg["PHONE_NUMBER"], cfg["PASSWORD"], cfg["TIMEOUT_SECONDS"])

    def _login(self):
        try:
            resp = self.session.post(
                f"{self.api_url}/api/v1/auth/login",
                json={"phone_number": self.phone_number, "password": self.password},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise LuckyMartError(f"Cannot reach Lucky Mart: {exc}") from exc
        if resp.status_code != 200:
            raise LuckyMartError(f"Lucky Mart login failed (HTTP {resp.status_code}).")
        token = (resp.json().get("data") or {}).get("access_token")
        if not token:
            raise LuckyMartError("Lucky Mart login response has no access token.")
        return token

    def _request(self, method, path, **kwargs):
        with self._lock:
            if self._token is None:
                self._token = self._login()
            token = self._token

        for attempt in (1, 2):
            try:
                resp = self.session.request(
                    method,
                    f"{self.api_url}/api/v1{path}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=self.timeout,
                    **kwargs,
                )
            except requests.RequestException as exc:
                raise LuckyMartError(f"Cannot reach Lucky Mart: {exc}") from exc

            if resp.status_code == 401 and attempt == 1:
                # Token expired: log in again and retry once.
                with self._lock:
                    self._token = self._login()
                    token = self._token
                continue
            break

        if resp.status_code >= 400:
            try:
                message = resp.json().get("message", "")
            except ValueError:
                message = resp.text[:200]
            raise LuckyMartError(f"Lucky Mart returned HTTP {resp.status_code}: {message}")
        return resp.json().get("data")

    def low_stock_items(self):
        """Products at or below their minimum stock level."""
        return self._request("GET", "/inventory/low-stock") or []

    def add_stock(self, product_unit_id, quantity, reference, notes):
        """Record goods received from a supplier as a STOCK_IN movement."""
        return self._request(
            "POST",
            "/inventory/adjust",
            json={
                "product_unit_id": str(product_unit_id),
                "adjustment_type": "STOCK_IN",
                "quantity_changed": quantity,
                "reference_number": reference,
                "notes": notes,
            },
        )


_client = None


def get_client():
    """Shared client, so the token is reused between requests."""
    global _client
    if _client is None:
        _client = LuckyMartClient.from_settings()
    return _client


def reset_client():
    global _client
    _client = None

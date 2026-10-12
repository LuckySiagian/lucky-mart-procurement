import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from rest_framework.test import APIClient

from accounts import cognito
from accounts.models import User

pytestmark = pytest.mark.django_db

POOL = "ap-southeast-3_TestPool"
CLIENT = "test-client-id"
ISSUER = f"https://cognito-idp.ap-southeast-3.amazonaws.com/{POOL}"

PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeJwksClient:
    """Stands in for Cognito's JWKS endpoint: always returns our test public key."""

    def get_signing_key_from_jwt(self, token):
        return jwt.PyJWK.from_dict(
            {
                **jwt.algorithms.RSAAlgorithm.to_jwk(PRIVATE_KEY.public_key(), as_dict=True),
                "kid": "test",
                "alg": "RS256",
            }
        )


@pytest.fixture(autouse=True)
def cognito_enabled(settings, monkeypatch):
    settings.COGNITO = {"REGION": "ap-southeast-3", "USER_POOL_ID": POOL, "APP_CLIENT_ID": CLIENT}
    monkeypatch.setattr(cognito, "jwks_client", lambda: FakeJwksClient())


def token(key=PRIVATE_KEY, **overrides):
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "sub": "8f1c-sub",
        "username": "siti",
        "client_id": CLIENT,
        "token_use": "access",
        "cognito:groups": ["STAFF"],
        "iat": now,
        "exp": now + 600,
        **overrides,
    }
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": "test"})


def me(bearer):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {bearer}")
    return client.get("/api/auth/me/")


def test_valid_token_signs_in_and_creates_the_user():
    resp = me(token())
    assert resp.status_code == 200
    assert resp.data["username"] == "siti"
    assert resp.data["role"] == "STAFF"
    assert not User.objects.get(username="siti").has_usable_password()


def test_owner_group_becomes_owner_role_and_role_follows_cognito():
    assert me(token(**{"cognito:groups": ["OWNER"]})).data["role"] == "OWNER"
    assert me(token(**{"cognito:groups": ["STAFF"]})).data["role"] == "STAFF"


@pytest.mark.parametrize(
    "bad",
    [
        {"client_id": "another-app"},
        {"token_use": "id"},
        {"exp": int(time.time()) - 10},
    ],
)
def test_rejected_tokens(bad):
    assert me(token(**bad)).status_code == 401


def test_wrong_signature_is_rejected():
    assert me(token(key=OTHER_KEY)).status_code == 401


def test_disabled_user_is_rejected():
    User.objects.create_user(username="siti", role=User.Role.STAFF, is_active=False)
    assert me(token()).status_code == 401


def test_local_login_still_works_next_to_cognito():
    User.objects.create_user(username="owner", password="test-pass-123", role=User.Role.OWNER)
    login = APIClient().post(
        "/api/auth/login/", {"username": "owner", "password": "test-pass-123"}, format="json"
    )
    assert me(login.data["access"]).data["username"] == "owner"


def test_healthz_skips_host_validation(client):
    resp = client.get("/healthz", HTTP_HOST="10.0.12.34:8000")
    assert resp.status_code == 200
    assert resp.content == b"ok"

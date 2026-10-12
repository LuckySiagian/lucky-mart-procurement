"""Sign-in with Amazon Cognito access tokens.

When COGNITO_USER_POOL_ID is set (on AWS, see infra/), the API accepts access tokens
issued by that user pool. The token's signature is checked against the pool's public
keys (JWKS), and the Cognito group (OWNER or STAFF) becomes the portal role.

Tokens from another issuer are left to the next authentication class, so the local
username/password login (Simple JWT) keeps working next to Cognito.
"""

from functools import lru_cache

import jwt
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import User


def issuer():
    cfg = settings.COGNITO
    return f"https://cognito-idp.{cfg['REGION']}.amazonaws.com/{cfg['USER_POOL_ID']}"


@lru_cache(maxsize=1)
def jwks_client():
    # PyJWKClient caches the keys, so Cognito is only asked again when a new key id shows up.
    return jwt.PyJWKClient(f"{issuer()}/.well-known/jwks.json", cache_keys=True)


class CognitoAuthentication(BaseAuthentication):
    def authenticate_header(self, request):
        return 'Bearer realm="api"'

    def authenticate(self, request):
        if not settings.COGNITO["USER_POOL_ID"]:
            return None

        parts = get_authorization_header(request).split()
        if len(parts) != 2 or parts[0].lower() != b"bearer":
            return None
        token = parts[1].decode()

        try:
            unverified = jwt.decode(token, options={"verify_signature": False})
        except jwt.InvalidTokenError:
            return None
        if unverified.get("iss") != issuer():
            return None  # Not a Cognito token: let Simple JWT handle it.

        try:
            key = jwks_client().get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=issuer(),
                options={"require": ["exp", "iat", "token_use", "client_id"]},
            )
        except (jwt.InvalidTokenError, jwt.PyJWKClientError) as exc:
            raise AuthenticationFailed(_("Invalid or expired token.")) from exc

        # Cognito access tokens carry client_id instead of aud.
        if (
            claims["token_use"] != "access"
            or claims["client_id"] != settings.COGNITO["APP_CLIENT_ID"]
        ):
            raise AuthenticationFailed(_("Invalid or expired token."))

        groups = claims.get("cognito:groups", [])
        role = User.Role.OWNER if "OWNER" in groups else User.Role.STAFF
        user, created = User.objects.get_or_create(
            username=claims["username"], defaults={"role": role}
        )
        if created:
            user.set_unusable_password()  # Cognito owns the password.
            user.save(update_fields=["password"])
        elif user.role != role:
            user.role = role
            user.save(update_fields=["role"])
        if not user.is_active:
            raise AuthenticationFailed(_("This account is disabled."))
        return user, claims

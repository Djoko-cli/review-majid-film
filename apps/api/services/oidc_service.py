"""Generic OIDC login client — provider-agnostic, same principle as
Transfer's own generic OIDC provider (backend/src/oauth/provider/genericOidc.provider.ts
there), pointed at a self-hosted Pocket ID instance but not hardcoded to it:
any standards-compliant OpenID Connect provider (discovery document,
Authorization Code + PKCE) works.

Deliberate improvements over Transfer's reference implementation, found
during research rather than assumed:
- The ID token's signature IS verified against the provider's JWKS
  (Transfer's own reference fetches the JWKS but never actually uses it —
  a real gap, not mirrored here).
- PKCE (S256) is always used, not just for public clients — cheap, and this
  confidential-client credential exchange happens server-side either way.
- State/nonce/PKCE verifier are stored in Redis (see services/redis_service.py),
  not split across a cookie (state) and an in-process cache (nonce) — one
  store, one lookup, matches every other short-lived-token pattern already
  in this codebase (magic codes, invite tokens).
"""
import base64
import hashlib
import json
import logging
import secrets
import time
from urllib.parse import urlencode

import httpx
from jose import jwt as jose_jwt
from jose.exceptions import JOSEError

from ..config import settings
from ..services import redis_service

log = logging.getLogger("oidc")

PROVIDER_NAME = "oidc"

# Discovery + JWKS documents change essentially never in practice; a simple
# process-local cache with a TTL avoids a round trip to the provider on every
# single login without ever needing an invalidation path — matches
# branding_service.py's own org-name caching convention (short TTL, self-heals).
_CACHE_TTL_SECONDS = 3600
_discovery_cache: dict | None = None
_discovery_cached_at: float = 0
_jwks_cache: dict | None = None
_jwks_cached_at: float = 0


def is_enabled() -> bool:
    return bool(
        settings.oidc_enabled
        and settings.oidc_discovery_url
        and settings.oidc_client_id
        and settings.oidc_client_secret
        and settings.oidc_redirect_uri
    )


def _discovery_document() -> dict:
    global _discovery_cache, _discovery_cached_at
    if _discovery_cache is None or (time.time() - _discovery_cached_at) > _CACHE_TTL_SECONDS:
        resp = httpx.get(settings.oidc_discovery_url, timeout=10)
        resp.raise_for_status()
        _discovery_cache = resp.json()
        _discovery_cached_at = time.time()
    return _discovery_cache


def _jwks() -> dict:
    global _jwks_cache, _jwks_cached_at
    if _jwks_cache is None or (time.time() - _jwks_cached_at) > _CACHE_TTL_SECONDS:
        jwks_uri = _discovery_document()["jwks_uri"]
        resp = httpx.get(jwks_uri, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cached_at = time.time()
    return _jwks_cache


def _pkce_pair() -> tuple[str, str]:
    """(code_verifier, code_challenge) per RFC 7636 (S256)."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def build_authorize_url() -> str:
    """Starts a login: generates state/nonce/PKCE, remembers them in Redis
    (see redis_service.store_oidc_state), returns the URL to redirect the
    browser to."""
    doc = _discovery_document()
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    code_verifier, code_challenge = _pkce_pair()
    redis_service.store_oidc_state(state, nonce, code_verifier)

    params = {
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "scope": settings.oidc_scope,
        "redirect_uri": settings.oidc_redirect_uri,
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{doc['authorization_endpoint']}?{urlencode(params)}"


class OIDCError(Exception):
    """Any failure in the callback exchange — the router turns this into a
    redirect to the frontend's error state rather than a raw 401/500, since
    this endpoint's caller is the browser via a 3rd-party redirect, not an
    API client that can read a JSON error body."""


def handle_callback(code: str, state: str) -> dict:
    """Exchanges the authorization code and returns the VERIFIED ID token
    claims dict (sub, email, name, ... per the provider's scopes). Raises
    OIDCError on any failure: missing/expired/reused state, a token
    exchange error, or a claim/signature/nonce that doesn't check out."""
    remembered = redis_service.pop_oidc_state(state)
    if not remembered:
        raise OIDCError("This sign-in link has expired or was already used. Try again.")

    doc = _discovery_document()
    try:
        resp = httpx.post(
            doc["token_endpoint"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.oidc_redirect_uri,
                "client_id": settings.oidc_client_id,
                "client_secret": settings.oidc_client_secret,
                "code_verifier": remembered["code_verifier"],
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        token_response = resp.json()
    except httpx.HTTPError as e:
        log.warning("OIDC token exchange failed: %s", e)
        raise OIDCError("Sign-in failed talking to the identity provider. Try again.")

    id_token = token_response.get("id_token")
    if not id_token:
        raise OIDCError("The identity provider didn't return an ID token.")

    try:
        claims = jose_jwt.decode(
            id_token,
            _jwks(),
            algorithms=["RS256", "ES256", "PS256"],
            audience=settings.oidc_client_id,
            issuer=doc.get("issuer"),
        )
    except JOSEError as e:
        log.warning("OIDC ID token verification failed: %s", e)
        raise OIDCError("Could not verify the identity provider's response.")

    if claims.get("nonce") != remembered["nonce"]:
        raise OIDCError("Could not verify the identity provider's response.")
    if claims.get("email_verified") is False:
        raise OIDCError("Your identity provider account's email isn't verified yet.")

    return claims

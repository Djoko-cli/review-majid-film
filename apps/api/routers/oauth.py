import logging
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..config import settings
from ..models.user import User, UserStatus
from ..models.oauth_identity import OAuthIdentity
from ..services import oidc_service, redis_service
from ..services.auth_service import create_access_token, create_refresh_token
from ..schemas.auth import TokenResponse
from ..middleware.rate_limit import rate_limit

router = APIRouter(prefix="/oauth", tags=["oauth"])
log = logging.getLogger("oauth")


class OAuthProviderOut(BaseModel):
    provider: str
    label: str


class OAuthExchangeRequest(BaseModel):
    code: str


@router.get("/providers", response_model=list[OAuthProviderOut])
def list_providers():
    """Public: which OIDC providers (if any) are configured to sign in with."""
    if not oidc_service.is_enabled():
        return []
    return [OAuthProviderOut(provider=oidc_service.PROVIDER_NAME, label=settings.oidc_provider_label)]


def _frontend_error_redirect(reason: str) -> RedirectResponse:
    url = f"{settings.frontend_url}/login?{urlencode({'oauth_error': reason})}"
    return RedirectResponse(url, status_code=302)


@router.get("/auth/{provider}", dependencies=[Depends(rate_limit("oauth_auth", 20, 600))])
def start_oauth(provider: str):
    """Public: redirects the browser to the provider's login screen."""
    if provider != oidc_service.PROVIDER_NAME or not oidc_service.is_enabled():
        return _frontend_error_redirect("not_configured")
    return RedirectResponse(oidc_service.build_authorize_url(), status_code=302)


@router.get("/callback/{provider}", dependencies=[Depends(rate_limit("oauth_callback", 20, 600))])
def oauth_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Public: the provider redirects here after login. Resolves (or, per
    Review's explicit choice, auto-creates) the local User, then hands the
    browser off to the frontend with a one-time exchange code rather than
    tokens directly in the URL — see redis_service's oidc_exchange_* helpers
    and POST /oauth/exchange below."""
    if provider != oidc_service.PROVIDER_NAME or not oidc_service.is_enabled():
        return _frontend_error_redirect("not_configured")

    try:
        claims = oidc_service.handle_callback(code, state)
    except oidc_service.OIDCError as e:
        log.warning("OIDC callback failed: %s", e)
        return _frontend_error_redirect("failed")

    sub = claims.get("sub")
    email = claims.get("email")
    name = claims.get("name") or claims.get("preferred_username") or email

    identity = db.query(OAuthIdentity).filter(
        OAuthIdentity.provider == oidc_service.PROVIDER_NAME,
        OAuthIdentity.provider_user_id == sub,
    ).first()

    if identity:
        user = db.query(User).filter(User.id == identity.user_id, User.deleted_at.is_(None)).first()
        if not user or user.status == UserStatus.deactivated:
            return _frontend_error_redirect("deactivated")
    else:
        if not email:
            return _frontend_error_redirect("no_email")
        # Explicit product choice (not Transfer's default): a verified-email
        # match against an existing, unlinked account auto-links rather than
        # erroring — Pocket ID's own auth (passkey-backed) is treated as a
        # strong enough identity signal for that, on a single-tenant,
        # invite-only instance the owner fully controls.
        user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
        if not user:
            user = User(
                email=email,
                name=name or email,
                status=UserStatus.active,
                email_verified=True,
                password_hash=None,
            )
            db.add(user)
            db.flush()
        elif user.status == UserStatus.deactivated:
            return _frontend_error_redirect("deactivated")

        identity = OAuthIdentity(
            provider=oidc_service.PROVIDER_NAME,
            provider_user_id=sub,
            provider_username=claims.get("preferred_username"),
            user_id=user.id,
        )
        db.add(identity)

    db.commit()

    access_token = create_access_token(str(user.id), token_version=user.token_version)
    refresh_token = create_refresh_token(str(user.id), token_version=user.token_version)
    exchange_code = secrets.token_urlsafe(32)
    redis_service.store_oidc_exchange_code(exchange_code, access_token, refresh_token)

    url = f"{settings.frontend_url}/oauth/complete?{urlencode({'code': exchange_code})}"
    return RedirectResponse(url, status_code=302)


@router.post("/exchange", response_model=TokenResponse, dependencies=[Depends(rate_limit("oauth_exchange", 20, 600))])
def exchange_oauth_code(body: OAuthExchangeRequest):
    """Public: the frontend's /oauth/complete page trades the one-time code
    from the callback redirect for real tokens — the tokens themselves never
    ride in a URL (browser history, referrer headers, server access logs)."""
    tokens = redis_service.pop_oidc_exchange_code(body.code)
    if not tokens:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired sign-in link.")
    return TokenResponse(access_token=tokens["access_token"], refresh_token=tokens["refresh_token"], needs_password=False)

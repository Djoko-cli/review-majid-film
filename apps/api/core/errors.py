"""Machine-readable error codes for HTTPException, additive to the plain-
string convention already used everywhere else in this codebase.

Part of the i18n rollout: the backend keeps owning the *decision* of what
went wrong (status code + a stable code identifying it), the frontend owns
*translating* it — see apps/web/lib/api-error.ts. AppHTTPException carries
both the existing English message (copied verbatim from the call site being
migrated, never freshly written here) and the code/params a French message
in errors.json can be looked up and interpolated from.

Migration is additive and per-call-site: apps/web/lib/api.ts accepts both
the old plain-string detail and this new {code, message, params} shape, so
call sites can move over one at a time without a flag day.
"""
from typing import Any

from fastapi import HTTPException


class AppHTTPException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
        **params: Any,
    ) -> None:
        # `headers` is a real HTTP response header (e.g. Retry-After), not an
        # interpolation value — kept out of **params so it never leaks into the
        # translated-message payload and always reaches FastAPI's own handling.
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, "params": params},
            headers=headers,
        )

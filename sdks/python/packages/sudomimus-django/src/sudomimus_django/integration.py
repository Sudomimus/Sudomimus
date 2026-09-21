"""Django views and session helpers for Connect callbacks."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from django.conf import settings  # type: ignore[import-untyped]
from django.http import (  # type: ignore[import-untyped]
    HttpRequest,
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseNotAllowed,
    HttpResponseRedirect,
)
from sudomimus_connect import (  # type: ignore[import-untyped]
    ConnectClient,
    EstablishRequest,
    RedeemRequest,
    ReturnMethodCallback,
)
from sudomimus_session import (  # type: ignore[import-untyped]
    LogoutRequest,
    RefreshRequest,
    SessionApiError,
    SessionClient,
)

from .store import Credential, DjangoCredentialStore

_PENDING = "_sudomimus_pending"
_SESSION = "_sudomimus_session"


@dataclass(frozen=True)
class DjangoLoginConfig:
    application_anchor: str
    callback_url: str
    after_login_url: str
    after_logout_url: str
    via_url: str = "https://via.sudomimus.com/"
    pending_ttl_seconds: int = 600
    session_ttl_seconds: int = 2592000

    def __post_init__(self) -> None:
        callback = urlsplit(self.callback_url)
        query = dict(parse_qsl(callback.query))
        if "exposure-key" in query or "confirmation-key" in query:
            raise ValueError("callback_url must not contain Inquiry keys")
        if self.pending_ttl_seconds <= 0 or self.session_ttl_seconds <= 0:
            raise ValueError("session TTLs must be positive")


class ConnectDjango:
    """Use a server-side Django session and an atomic credential store."""

    def __init__(
        self,
        config: DjangoLoginConfig,
        connect: ConnectClient,
        session: SessionClient,
        store: DjangoCredentialStore,
    ) -> None:
        if settings.SESSION_ENGINE == "django.contrib.sessions.backends.signed_cookies":
            raise ValueError("Sudomimus requires a server-side Django session backend")
        self.config = config
        self.connect = connect
        self.session = session
        self.store = store

    def start(self, request: HttpRequest) -> HttpResponse:
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        inquiry = self.connect.establish(
            EstablishRequest(
                applicationAnchor=self.config.application_anchor,
                returnMethods=[
                    ReturnMethodCallback(
                        type="CALLBACK", payload={"callbackUrl": self.config.callback_url}
                    )
                ],
            )
        )
        request.session[_PENDING] = {
            "exposure": inquiry.exposureKey,
            "hidden": inquiry.hiddenKey,
            "expires": time.time() + self.config.pending_ttl_seconds,
        }
        via = urlsplit(self.config.via_url)
        query = dict(parse_qsl(via.query))
        query["exposure-key"] = inquiry.exposureKey
        return HttpResponseRedirect(
            urlunsplit((via.scheme, via.netloc, via.path, urlencode(query), via.fragment))
        )

    def callback(self, request: HttpRequest) -> HttpResponse:
        if request.method != "GET":
            return HttpResponseNotAllowed(["GET"])
        pending = request.session.get(_PENDING)
        exposure = request.GET.get("exposure-key")
        confirmation = request.GET.get("confirmation-key")
        if (
            not isinstance(pending, dict)
            or not exposure
            or not confirmation
            or exposure != pending.get("exposure")
            or time.time() >= pending.get("expires", 0)
        ):
            return HttpResponseBadRequest("Invalid or expired login callback")
        del request.session[_PENDING]
        issued = self.connect.redeem(
            RedeemRequest(
                exposureKey=exposure,
                hiddenKey=pending["hidden"],
                confirmationKey=confirmation,
            )
        )
        verified = self.session.verify_access_token(issued.accessToken)
        request.session.cycle_key()
        session_id = uuid.uuid4().hex
        self.store.put(session_id, {
            "subject": verified.body.sub,
            "access": issued.accessToken,
            "refresh": issued.refreshToken,
            "expires": verified.body.exp,
        }, self.config.session_ttl_seconds)
        request.session[_SESSION] = session_id
        return HttpResponseRedirect(self.config.after_login_url)

    def current(self, request: HttpRequest) -> dict[str, str] | None:
        """Return current identity and access token, rotating credentials when needed."""
        session_id = request.session.get(_SESSION)
        if not isinstance(session_id, str):
            return None

        def access(value: Credential | None) -> tuple[Credential | None, dict[str, str] | None]:
            if value is None:
                return None, None
            if int(value["expires"]) <= time.time() + 30:
                try:
                    rotated = self.session.refresh(
                        RefreshRequest(refreshToken=str(value["refresh"]))
                    )
                except SessionApiError as error:
                    if error.status == 401:
                        return None, None
                    raise
                verified = self.session.verify_access_token(rotated.accessToken)
                if verified.body.sub != value["subject"]:
                    return None, None
                value.update(
                    access=rotated.accessToken,
                    refresh=rotated.refreshToken,
                    expires=verified.body.exp,
                )
            return value, {"subject": str(value["subject"]), "access_token": str(value["access"])}

        return self.store.update(session_id, access)

    def logout(self, request: HttpRequest) -> HttpResponse:
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])
        session_id = request.session.get(_SESSION)
        if isinstance(session_id, str):

            def revoke(value: Credential | None) -> tuple[None, None]:
                if value is not None:
                    self.session.logout(LogoutRequest(refreshToken=str(value["refresh"])))
                return None, None

            self.store.update(session_id, revoke)
        request.session.flush()
        return HttpResponseRedirect(self.config.after_logout_url)

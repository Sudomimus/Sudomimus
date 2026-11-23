"""Device response models with runtime browser URL validation."""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from pydantic import AnyUrl, field_validator

from ._generated.models import DeviceAuthorizeResponse as GeneratedDeviceAuthorizeResponse

_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f-\x9f]")
_LOOPBACK_AUTHORITY = re.compile(r"(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?", re.I)


class DeviceAuthorizeResponse(GeneratedDeviceAuthorizeResponse):
    """Device authorization details safe to pass to the browser opener."""

    @field_validator("verificationUri", "verificationUriComplete", mode="before")
    @classmethod
    def _validate_verification_url(cls, value: object) -> object:
        if not isinstance(value, (str, AnyUrl)):
            raise ValueError("A verification URL must be an absolute HTTP(S) URL.")

        raw = str(value)
        if raw != raw.strip() or "\\" in raw or _CONTROL_CHARACTERS.search(raw):
            raise ValueError("A verification URL must exclude whitespace and control characters.")

        url = urlsplit(raw)
        if (
            not url.hostname
            or "@" in url.netloc
            or (
                url.scheme != "https"
                and (url.scheme != "http" or not _LOOPBACK_AUTHORITY.fullmatch(url.netloc))
            )
        ):
            raise ValueError(
                "A verification URL must use HTTPS or loopback HTTP without credentials."
            )
        return value

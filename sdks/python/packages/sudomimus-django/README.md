# sudomimus-django

Django integration for the ordinary Sudomimus Connect callback flow.

```python
from django.urls import path
from sudomimus_connect import ConnectClient, ConnectClientAuthWithKey
from sudomimus_session import SessionClient
from sudomimus_django import ConnectDjango, DjangoLoginConfig, MemoryDjangoCredentialStore

integration = ConnectDjango(
    DjangoLoginConfig(
        application_anchor="my-app",
        callback_url="https://my-app.example/auth/callback",
        after_login_url="/dashboard",
        after_logout_url="/",
    ),
    ConnectClient(client_auth=ConnectClientAuthWithKey(
        application_anchor="my-app", private_key_pem=private_key_pem,
    )),
    SessionClient(),
    MemoryDjangoCredentialStore(),  # development only
)

urlpatterns = [
    path("auth/start", integration.start),
    path("auth/callback", integration.callback),
    path("auth/logout", integration.logout),
]
```

Call `integration.current(request)` from a server view to obtain the current
sector subject and access token. It does not create a Django `User`; map the
pairwise subject to your own user record if needed. Use a server-side Django
session backend (database or cache), not signed-cookie sessions. For production,
implement `DjangoCredentialStore` with a shared database or Redis. Its `update`
method must serialize the callback across all workers for each session ID, so
concurrent refreshes cannot overwrite the rotated token. Keep Django's CSRF
middleware enabled for the POST start/logout views. The callback URL must be
permitted by the application's CALLBACK ReturnRule.

When redemption requires Basic Terms or current claim consent, or the
Inquiry's identity authority is stale, the callback consumes the pending login
and redirects to `reauthentication_url`. It defaults to `after_logout_url`.
Serve a sign-in page there with a CSRF-protected POST to `start`. When refresh
requires Basic Terms, `current` returns `None` and marks the stored session as
requiring reauthentication. `logout` can still revoke it with the stored
refresh token.

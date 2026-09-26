# Sudomimus Django example

This local Django app uses `sudomimus-django` for the Connect callback, session
rotation, and logout. The application private key and tokens stay server-side;
the browser has a Django session cookie. Forms retain Django CSRF protection.

Register a Sudomimus application with a `CALLBACK` return rule permitting
`http://localhost:8000/auth/callback`. From `sdks/python`, install local
dependencies and start the example:

```bash
uv sync --frozen
export SUDOMIMUS_APPLICATION_ANCHOR='your-anchor'
export SUDOMIMUS_PRIVATE_KEY_PEM="$(cat /path/to/private-key.pem)"
uv run python ../../examples/python/django/manage.py migrate
uv run python ../../examples/python/django/manage.py runserver
```

Open <http://localhost:8000>, log in, then log out. The sample uses SQLite for
Django's server-side sessions and `MemoryDjangoCredentialStore` for Sudomimus
tokens. The latter loses sessions on restart and does not work across workers;
implement a shared `DjangoCredentialStore` before deployment. Set a strong
`DJANGO_SECRET_KEY`, disable debug mode, configure allowed hosts and HTTPS in a
deployed application.

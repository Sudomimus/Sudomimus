"""Development-only settings for the Sudomimus Django example."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "local-example-change-before-deployment")
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
ROOT_URLCONF = "urls"
INSTALLED_APPS = ["django.contrib.sessions"]
MIDDLEWARE = [
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.csrf"]},
    }
]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_HTTPONLY = True

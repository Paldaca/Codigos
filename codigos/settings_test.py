"""Ajustes para pruebas automatizadas. Usa SQLite en memoria."""
from .settings import *  # noqa: F403, F401

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

MIDDLEWARE = [mw for mw in MIDDLEWARE if "whitenoise" not in mw]

# Ningun test sale a la red: los que prueban la emision la simulan.
PALDACA_NOTIFICACIONES_ACTIVAS = False

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

"""Configuración de Códigos (Cereipo, Fase 5)."""

from __future__ import annotations

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .db import APP_CODIGO, get_databases
from .entorno import bool_env, csv_env, int_env, obligatoria

BASE_DIR = Path(__file__).resolve().parent.parent

_ENV_LOCAL = BASE_DIR / ".env"
if _ENV_LOCAL.exists():
    from dotenv import load_dotenv

    load_dotenv(_ENV_LOCAL, override=False)

import os  # noqa: E402

REDIS_DB_LOCAL = 2
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
CONTRATO_VERSION = 1

DEBUG = bool_env("DJANGO_DEBUG", False)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Falta DJANGO_SECRET_KEY (obligatoria con DJANGO_DEBUG=false).")
    SECRET_KEY = f"solo-local-{APP_CODIGO}-no-usar-en-servidor"

ALLOWED_HOSTS = csv_env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1" if DEBUG else "")
CSRF_TRUSTED_ORIGINS = csv_env("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5192,http://localhost:5190" if DEBUG else "")

SESSION_COOKIE_NAME = f"cereipo_{APP_CODIGO}_sesion"
SESSION_COOKIE_DOMAIN = None
CSRF_COOKIE_NAME = f"cereipo_{APP_CODIGO}_csrf"
SESSION_COOKIE_SECURE = bool_env("DJANGO_COOKIES_SEGURAS", not DEBUG)
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
SESSION_COOKIE_SAMESITE = "Lax"

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_CONTENT_TYPE_NOSNIFF = True

SECURE_HSTS_SECONDS = int_env("DJANGO_HSTS_SEGUNDOS", 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = bool_env("DJANGO_HSTS_SUBDOMINIOS", False)
SECURE_HSTS_PRELOAD = False

SILENCED_SYSTEM_CHECKS = [
    "security.W008",
    "security.W021",
    "security.W002",
]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "cereipo_sso",
    "core",
    "integracion",
    "catalogos",
    "registro",
    "api",
]

MIDDLEWARE = [
    "config.peticion.IdPeticionMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "cereipo_sso.embebido.EmbebidoMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "cereipo_sso.middleware.IdentidadMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "EXCEPTION_HANDLER": "core.exceptions.manejador_excepciones",
}

CEREIPO_SSO_ACTIVO = bool_env("CEREIPO_SSO_ACTIVO", False)
CEREIPO_SHELL_URL = os.getenv("CEREIPO_SHELL_URL", "http://localhost:5190" if DEBUG else "").strip()
CEREIPO_SHELL_API_URL = os.getenv("CEREIPO_SHELL_API_URL", "http://127.0.0.1:8100" if DEBUG else "").strip()
CEREIPO_APP_CODIGO = os.getenv("CEREIPO_APP_CODIGO", APP_CODIGO).strip()
CEREIPO_APP_SECRETO = os.getenv("CEREIPO_APP_SECRETO", "").strip()

DATABASES = get_databases()
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if bool_env("RUNNING_IN_DOCKER") and not os.getenv("REDIS_URL", "").strip():
    obligatoria("REDIS_URL")
REDIS_URL = os.getenv("REDIS_URL", "").strip() or f"redis://127.0.0.1:6391/{REDIS_DB_LOCAL}"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "KEY_PREFIX": APP_CODIGO,
        "TIMEOUT": 300,
        "OPTIONS": {
            "socket_connect_timeout": int_env("REDIS_CONNECT_TIMEOUT", 2),
            "socket_timeout": int_env("REDIS_TIMEOUT", 2),
        },
    }
}
SESSION_ENGINE = "django.contrib.sessions.backends.cache"

LANGUAGE_CODE = "es"
TIME_ZONE = "America/Caracas"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

SPA_DIR = Path(os.getenv("CEREIPO_SPA_DIR", "") or BASE_DIR / "spa")
WHITENOISE_ROOT = SPA_DIR if SPA_DIR.exists() else None


def _es_inmutable(ruta: str, url: str) -> bool:
    return url.startswith("/assets/")


WHITENOISE_IMMUTABLE_FILE_TEST = _es_inmutable

_ARCHIVOS = Path(os.getenv("CEREIPO_ARCHIVOS_DIR", "") or "archivos")
ARCHIVOS_DIR = _ARCHIVOS if _ARCHIVOS.is_absolute() else BASE_DIR / _ARCHIVOS

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
        "OPTIONS": {"location": ARCHIVOS_DIR, "base_url": None},
    },
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

EMAIL_HOST = os.getenv("EMAIL_HOST", "").strip()
EMAIL_PORT = int_env("EMAIL_PORT", 465)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "").strip()
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "").strip()
EMAIL_USE_SSL = bool_env("EMAIL_USE_SSL", True)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "notificaciones@cereipo.com").strip()
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.locmem.EmailBackend"
)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"peticion": {"()": "config.peticion.FiltroIdPeticion"}},
    "formatters": {
        "simple": {"format": "{asctime} {levelname} {name} [{peticion}] {message}", "style": "{"},
    },
    "handlers": {
        "consola": {"class": "logging.StreamHandler", "formatter": "simple", "filters": ["peticion"]},
    },
    "root": {"handlers": ["consola"], "level": os.getenv("LOG_LEVEL", "INFO")},
}

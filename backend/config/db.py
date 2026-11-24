"""Base de datos propia de Códigos en PostgreSQL (D-03, D-21)."""

from __future__ import annotations

import os
from urllib.parse import quote, urlparse

from django.core.exceptions import ImproperlyConfigured

APP_CODIGO = "codigos"
MOTOR = "django.db.backends.postgresql"
_LOCALES = {"localhost", "127.0.0.1", "::1"}


def _bool_env(nombre: str, defecto: str = "false") -> bool:
    return os.getenv(nombre, defecto).strip().lower() in {"1", "true", "yes", "on", "si"}


def _int_env(nombre: str, defecto: int) -> int:
    valor = os.getenv(nombre, "").strip()
    if not valor:
        return defecto
    try:
        return int(valor)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{nombre} debe ser un número entero (vale {valor!r}).") from exc


def _url_desde_partes() -> str:
    usuario = os.getenv("POSTGRES_USER", APP_CODIGO)
    clave = os.getenv("POSTGRES_PASSWORD", f"{APP_CODIGO}_local")
    host = os.getenv("POSTGRES_HOST", "127.0.0.1")
    puerto = os.getenv("POSTGRES_PORT", "5440")
    base = os.getenv("POSTGRES_DB", f"cereipo_{APP_CODIGO}")
    return f"postgres://{quote(usuario, safe='')}:{quote(clave, safe='')}@{host}:{puerto}/{base}"


def url_enmascarada(url: str) -> str:
    partes = urlparse(url)
    usuario = partes.username or "?"
    host = partes.hostname or "?"
    puerto = partes.port or 5432
    base = (partes.path or "").lstrip("/") or "?"
    return f"{partes.scheme}://{usuario}:***@{host}:{puerto}/{base}"


def get_databases() -> dict:
    import dj_database_url

    url = os.getenv("DATABASE_URL", "").strip()
    en_docker = _bool_env("RUNNING_IN_DOCKER")

    if en_docker and not url:
        raise ImproperlyConfigured(
            "DATABASE_URL es obligatoria en el contenedor: "
            f"postgres://{APP_CODIGO}:clave@host-de-la-base:5432/cereipo_{APP_CODIGO}"
        )
    if not url:
        url = _url_desde_partes()

    pgbouncer = _bool_env("DB_PGBOUNCER")
    conn_max_age = 0 if pgbouncer else _int_env("DB_CONN_MAX_AGE", 60)
    config = dj_database_url.parse(url, conn_max_age=conn_max_age, conn_health_checks=True)

    if config.get("ENGINE") != MOTOR:
        raise ImproperlyConfigured(
            f"Cereipo usa solo PostgreSQL (D-21); DATABASE_URL apunta a otro motor: {url_enmascarada(url)}"
        )
    if en_docker and (config.get("HOST") or "").lower() in _LOCALES:
        raise ImproperlyConfigured(
            "En el contenedor la base no puede estar en localhost (D-31): "
            f"usa el host de red del servicio. Ahora: {url_enmascarada(url)}"
        )

    opciones = config.setdefault("OPTIONS", {})
    opciones.setdefault("application_name", f"cereipo-{APP_CODIGO}")
    opciones.setdefault("connect_timeout", _int_env("DB_CONNECT_TIMEOUT", 5))
    if pgbouncer:
        config["DISABLE_SERVER_SIDE_CURSORS"] = True

    return {"default": config}

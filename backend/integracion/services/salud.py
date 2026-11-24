"""Verificación de salud de PostgreSQL y Redis (contratos §7, D-31)."""

from __future__ import annotations

import logging

from django.core.cache import cache
from django.db import connection

log = logging.getLogger(__name__)

OK = "ok"
ERROR = "error"


def revisar_base() -> str:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return OK
    except Exception:
        log.exception("Salud: la base de datos no responde")
        return ERROR


def revisar_redis() -> str:
    try:
        cache.set("salud", "1", timeout=10)
        if cache.get("salud") != "1":
            raise RuntimeError("Redis no devolvió el valor guardado")
        return OK
    except Exception:
        log.exception("Salud: Redis no responde")
        return ERROR

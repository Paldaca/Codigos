"""Lectura de variables de entorno (D-31)."""

from __future__ import annotations

import os

from django.core.exceptions import ImproperlyConfigured

_VERDADEROS = {"1", "true", "yes", "on", "si"}


def bool_env(nombre: str, defecto: bool = False) -> bool:
    valor = os.getenv(nombre, "").strip().lower()
    if not valor:
        return defecto
    return valor in _VERDADEROS


def int_env(nombre: str, defecto: int) -> int:
    valor = os.getenv(nombre, "").strip()
    if not valor:
        return defecto
    try:
        return int(valor)
    except ValueError as exc:
        raise ImproperlyConfigured(f"{nombre} debe ser un número entero (vale {valor!r}).") from exc


def csv_env(nombre: str, defecto: str = "") -> list[str]:
    valor = os.getenv(nombre, defecto)
    return [parte.strip() for parte in valor.split(",") if parte.strip()]


def obligatoria(nombre: str) -> str:
    valor = os.getenv(nombre, "").strip()
    if not valor:
        raise ImproperlyConfigured(f"Falta la variable de entorno {nombre}.")
    return valor

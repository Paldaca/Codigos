"""Validadores transversales para la metodología de 8 segmentos de Códigos."""

from __future__ import annotations

import re

from .exceptions import ErrorNegocio

REGEX_SIGLA = re.compile(r"^[A-Z0-9]{2,10}$")
REGEX_ANIO = re.compile(r"^\d{4}$")
REGEX_SEGMENTO = re.compile(r"^[A-Z0-9]{1,10}$")


def validar_sigla_organizacion(valor: str) -> str:
    sigla = (valor or "").strip().upper()
    if not REGEX_SIGLA.match(sigla):
        raise ErrorNegocio(
            "La sigla de la organización debe tener entre 2 y 10 caracteres alfanuméricos en mayúsculas.",
            "sigla-invalida",
            400,
        )
    return sigla


def validar_anio(valor: str | int) -> str:
    anio = str(valor or "").strip()
    if not REGEX_ANIO.match(anio):
        raise ErrorNegocio("El año debe tener exactamente 4 dígitos (ej. 2026).", "anio-invalido", 400)
    num = int(anio)
    if num < 2015 or num > 2100:
        raise ErrorNegocio("El año está fuera del rango permitido (2015–2100).", "anio-invalido", 400)
    return anio


def normalizar_codigo_segmento(valor: str, nombre: str) -> str:
    limpio = (valor or "").strip().upper()
    if not limpio or not REGEX_SEGMENTO.match(limpio):
        raise ErrorNegocio(
            f"El segmento «{nombre}» es inválido ({valor!r}).",
            "segmento-invalido",
            400,
        )
    return limpio

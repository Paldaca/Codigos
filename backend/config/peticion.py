"""Identificador de petición en los logs (tarea 2.9)."""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar

from django.core.signals import request_finished

CABECERA = "X-Request-ID"
_VALIDO = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
_actual: ContextVar[str] = ContextVar("id_peticion", default="-")


def id_actual() -> str:
    return _actual.get()


class IdPeticionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        recibido = request.headers.get(CABECERA, "")
        valor = recibido if _VALIDO.match(recibido) else uuid.uuid4().hex
        request.id_peticion = valor
        _actual.set(valor)
        respuesta = self.get_response(request)
        respuesta[CABECERA] = valor
        return respuesta


def _limpiar(**kwargs) -> None:
    _actual.set("-")


request_finished.connect(_limpiar, dispatch_uid="cereipo_id_peticion")


class FiltroIdPeticion(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.peticion = _actual.get()
        return True

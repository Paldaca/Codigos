"""Excepciones de dominio y manejador homogéneo para DRF."""

from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import exception_handler


class ErrorNegocio(Exception):
    def __init__(
        self,
        mensaje: str,
        codigo: str = "datos-invalidos",
        estado_http: int = 400,
        extra: dict | None = None,
    ):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo
        self.estado_http = estado_http
        self.extra = extra or {}

    def como_dict(self) -> dict:
        datos = {"error": self.codigo, "mensaje": self.mensaje}
        datos.update(self.extra)
        return datos


def manejador_excepciones(exc, context):
    if isinstance(exc, ErrorNegocio):
        return Response(exc.como_dict(), status=exc.estado_http)
    return exception_handler(exc, context)

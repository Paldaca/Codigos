"""Reporte tolerante a fallos hacia la bitácora centralizada de servicios del Shell (D-16)."""

from __future__ import annotations

from cereipo_sso.servicios import reportar_uso_servicio


def registrar_llamada(*, ctx, operacion: str, estado_http: int, cantidad: int = 1, referencia: str = "") -> None:
    if ctx is None:
        return
    reportar_uso_servicio(
        consumidor=ctx.consumidor,
        servicio=ctx.servicio,
        organizacion_id=ctx.organizacion_id,
        operacion=operacion,
        estado_http=estado_http,
        cantidad=cantidad,
        referencia=referencia,
    )

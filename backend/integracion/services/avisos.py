"""Emisión de avisos hacia el bus del Shell (contratos §6)."""

from __future__ import annotations

import json
import logging

from django.conf import settings

from cereipo_sso import cliente
from cereipo_sso.firma import cabeceras

log = logging.getLogger(__name__)
RUTA_EVENTOS = "/api/avisos/eventos/"


def emitir_aviso(
    *,
    id_evento: str,
    tipo: str,
    organizacion_id: str,
    titulo: str,
    cuerpo: str,
    ruta: str,
    severidad: str = "advertencia",
    permiso: str | None = None,
    usuarios: list[str] | None = None,
) -> bool:
    """Emite un evento al bus de avisos del Shell; tolerante a fallos (nunca lanza)."""
    shell_api = getattr(settings, "CEREIPO_SHELL_API_URL", "").rstrip("/")
    app_codigo = getattr(settings, "CEREIPO_APP_CODIGO", "")
    app_secreto = getattr(settings, "CEREIPO_APP_SECRETO", "")
    if not getattr(settings, "CEREIPO_SSO_ACTIVO", False) or not shell_api or not app_secreto:
        return False

    destinatarios: dict = {}
    if usuarios:
        destinatarios["usuarios"] = usuarios
    if permiso:
        destinatarios["permiso"] = permiso

    payload = json.dumps(
        {
            "id_evento": id_evento,
            "tipo": tipo,
            "organizacion": str(organizacion_id),
            "titulo": titulo[:200],
            "cuerpo": cuerpo[:500],
            "ruta": ruta,
            "severidad": severidad,
            "destinatarios": destinatarios,
        },
        ensure_ascii=False,
    ).encode()
    headers = cabeceras(app_codigo, app_secreto, "POST", RUTA_EVENTOS)
    headers["Content-Type"] = "application/json"
    headers["Accept"] = "application/json"
    try:
        resp = cliente.request_http("POST", shell_api + RUTA_EVENTOS, headers, cuerpo=payload)
        return 200 <= resp.estado < 300
    except Exception as error:
        log.warning("No se pudo emitir aviso %s al Shell: %s", tipo, error)
        return False

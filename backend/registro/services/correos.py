"""Notificación por correo al generar códigos manualmente (tolerante a fallos, BR-12)."""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import BadHeaderError, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.timezone import localtime, now

from catalogos.services import obtener_info_notificacion

log = logging.getLogger(__name__)


def enviar_correo_nuevo_codigo(
    *,
    codigo: str,
    motivo: str,
    actor_nombre: str,
    destino: str | None = None,
    habilitado: bool | None = None,
) -> str | None:
    if destino is None or habilitado is None:
        destino, habilitado = obtener_info_notificacion()
    if not habilitado or not destino:
        return None
    fecha_txt = localtime(now()).strftime("%d/%m/%Y %H:%M")
    contexto = {
        "usuario": actor_nombre or "Sistema",
        "fecha": fecha_txt,
        "codigo": codigo,
        "motivo": motivo,
    }
    texto = (
        f"Se ha generado un nuevo código:\n"
        f"Usuario: {contexto['usuario']}\n"
        f"Fecha: {fecha_txt}\n"
        f"Código: {codigo}\n"
        f"Motivo: {motivo}\n"
    )
    try:
        html = render_to_string("registro/emails/nuevo_codigo.html", contexto)
        correo = EmailMultiAlternatives(
            "Nuevo código generado",
            texto,
            settings.DEFAULT_FROM_EMAIL,
            [destino],
        )
        correo.encoding = "utf-8"
        correo.attach_alternative(html, "text/html")
        correo.send(fail_silently=False)
        return None
    except BadHeaderError:
        log.exception("BadHeaderError enviando correo codigo=%s", codigo)
        return "El código se guardó, pero el encabezado del correo es inválido."
    except Exception:
        log.exception("Error enviando correo codigo=%s", codigo)
        return "El código se guardó, pero no se pudo enviar el correo de notificación."

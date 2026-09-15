"""Avisos de Codigos en la campana del Portal (bus de notificaciones)."""

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.urls import reverse

from .constants import MODULO_CODIGO
from .notificaciones_portal import emitir_al_confirmar, url_en_portal

CODIGO_SOLICITUD_ANULACION = "codigos.solicitud_anulacion"
_PERMISO_APP = "documentos"
_PERMISO = "puede_anular_codigo"


def aprobadores_por_permiso_ids():
    """Titulares del permiso Django de anulacion con acceso a Codigos.

    Son la otra mitad de `es_aprobador_codigos()`: los administradores del modulo
    y los superadmins los resuelve el Portal por su cuenta.
    """
    permiso = Q(
        user_permissions__codename=_PERMISO,
        user_permissions__content_type__app_label=_PERMISO_APP,
    ) | Q(
        groups__permissions__codename=_PERMISO,
        groups__permissions__content_type__app_label=_PERMISO_APP,
    )
    return list(
        get_user_model()
        .objects.filter(
            permiso,
            is_active=True,
            accesos_modulo__modulo__codigo=MODULO_CODIGO,
            accesos_modulo__modulo__activo=True,
        )
        .distinct()
        .values_list("pk", flat=True)
    )


def avisar_solicitud_anulacion(solicitud):
    codigo = solicitud.codigo
    solicitante = solicitud.solicitante
    nombre = (solicitante.get_full_name() or "").strip() or solicitante.username
    emitir_al_confirmar(
        codigo=CODIGO_SOLICITUD_ANULACION,
        titulo=f"Solicitud de anulación: {codigo.codigo}",
        cuerpo=f"{nombre} pidió anular {codigo.codigo}. Motivo: {solicitud.motivo[:300]}",
        payload={
            "usuario_ids": aprobadores_por_permiso_ids(),
            "url": url_en_portal(reverse("solicitudes_anulacion")),
            "solicitud_id": solicitud.pk,
            "codigo": codigo.codigo,
        },
        emisor=solicitante,
    )

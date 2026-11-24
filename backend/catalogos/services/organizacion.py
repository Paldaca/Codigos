"""Gestión de la sigla fija de la organización activa."""

from __future__ import annotations

from django.db import transaction

from cereipo_sso.historial import calcular_cambios, capturar_estado, registrar_cambio
from cereipo_sso.organizacion import organizacion_actual
from core.exceptions import ErrorNegocio
from core.validators import validar_sigla_organizacion

from catalogos.models import ConfiguracionOrganizacion
from .publicacion import construir_snapshot_catalogos, publicar_snapshot_catalogos


def obtener_configuracion() -> ConfiguracionOrganizacion | None:
    return ConfiguracionOrganizacion.objects.first()


def obtener_sigla_obligatoria() -> str:
    config = obtener_configuracion()
    if config is None or not config.sigla:
        raise ErrorNegocio(
            "La organización todavía no tiene configurada su sigla inicial en Códigos.",
            "sigla-no-configurada",
            409,
        )
    return config.sigla


def obtener_info_notificacion() -> tuple[str, bool]:
    config = obtener_configuracion()
    if config is None:
        return "", False
    return config.correo_notificacion, config.notificar_por_correo


@transaction.atomic
def guardar_configuracion(
    *,
    sigla: str,
    correo_notificacion: str = "",
    notificar_por_correo: bool = False,
    actor_persona_id: str = "",
    actor_nombre: str = "",
    motivo: str = "",
) -> ConfiguracionOrganizacion:
    sigla_limpia = validar_sigla_organizacion(sigla)
    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    existente = ConfiguracionOrganizacion.objects.select_for_update().first()
    if existente is not None:
        antes = capturar_estado(existente, ["sigla", "correo_notificacion", "notificar_por_correo"])
        if existente.bloqueada_por_codigos and sigla_limpia != existente.sigla:
            raise ErrorNegocio(
                "No se puede cambiar la sigla inicial porque la organización ya tiene códigos generados.",
                "sigla-bloqueada",
                409,
            )
        existente.sigla = sigla_limpia
        existente.correo_notificacion = (correo_notificacion or "").strip()
        existente.notificar_por_correo = bool(notificar_por_correo)
        existente.save()
        config = existente
        accion = "editado"
    else:
        antes = None
        config = ConfiguracionOrganizacion.objects.create(
            sigla=sigla_limpia,
            correo_notificacion=(correo_notificacion or "").strip(),
            notificar_por_correo=bool(notificar_por_correo),
        )
        accion = "creado"

    despues = capturar_estado(config, ["sigla", "correo_notificacion", "notificar_por_correo"])
    registrar_cambio(
        objeto=config,
        accion=accion,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
        cambios=calcular_cambios(antes or {}, despues),
        motivo=motivo,
    )
    snapshot = construir_snapshot_catalogos(org_id)
    transaction.on_commit(lambda: publicar_snapshot_catalogos(org_id, snapshot))
    return config


def marcar_sigla_bloqueada() -> None:
    ConfiguracionOrganizacion.objects.filter(bloqueada_por_codigos=False).update(bloqueada_por_codigos=True)


def configurar_migracion_organizacion(
    *,
    organizacion_id: str,
    sigla: str,
    correo_notificacion: str,
    bloquear_sigla: bool,
) -> None:
    existente = ConfiguracionOrganizacion.objects.filter(organizacion_id=organizacion_id).first()
    bloqueada = (existente.bloqueada_por_codigos if existente is not None else False) or bloquear_sigla
    ConfiguracionOrganizacion.objects.update_or_create(
        organizacion_id=organizacion_id,
        defaults={
            "sigla": sigla,
            "correo_notificacion": correo_notificacion,
            "notificar_por_correo": bool(correo_notificacion),
            "bloqueada_por_codigos": bloqueada,
        },
    )

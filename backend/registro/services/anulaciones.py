"""Anulación directa, solicitudes de anulación y aprobación/rechazo."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils.timezone import now

from cereipo_sso.historial import calcular_cambios, capturar_estado, registrar_cambio
from cereipo_sso.organizacion import organizacion_actual
from core.exceptions import ErrorNegocio
from core.utils import texto_limpio
from integracion.services.avisos import emitir_aviso

from registro.models import CodigoRegistro, SolicitudAnulacion
from .generador import CAMPOS_HISTORIAL


def _aplicar_anulacion(
    reg: CodigoRegistro,
    *,
    motivo: str,
    actor_persona_id: str,
    actor_nombre: str,
) -> bool:
    """Marca un código como anulado y cierra sus solicitudes pendientes. Retorna True si cambió."""
    if reg.estado == CodigoRegistro.Estado.ANULADO:
        return False
    antes = capturar_estado(reg, CAMPOS_HISTORIAL)
    ahora = now()
    reg.estado = CodigoRegistro.Estado.ANULADO
    reg.motivo_anulacion = motivo
    reg.anulado_por_persona_id = str(actor_persona_id or "")[:64]
    reg.anulado_por_nombre = texto_limpio(actor_nombre, 200)
    reg.fecha_anulacion = ahora
    reg.save(
        update_fields=[
            "estado",
            "motivo_anulacion",
            "anulado_por_persona_id",
            "anulado_por_nombre",
            "fecha_anulacion",
        ]
    )
    SolicitudAnulacion.objects.filter(
        codigo_registro=reg,
        estado=SolicitudAnulacion.Estado.PENDIENTE,
    ).update(
        estado=SolicitudAnulacion.Estado.APROBADA,
        resuelto_por_persona_id=str(actor_persona_id or "")[:64],
        resuelto_por_nombre=texto_limpio(actor_nombre, 200),
        motivo_resolucion="Cerrada por anulación del código.",
        fecha_resolucion=ahora,
    )
    registrar_cambio(
        objeto=reg,
        accion="anulado",
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
        cambios=calcular_cambios(antes, capturar_estado(reg, CAMPOS_HISTORIAL)),
        motivo=motivo,
    )
    org_id = organizacion_actual() or reg.organizacion_id
    transaction.on_commit(
        lambda: emitir_aviso(
            id_evento=f"codigos:anulado:{reg.id}",
            tipo="codigos.codigo_anulado",
            organizacion_id=str(org_id),
            titulo=f"Código anulado: {reg.codigo}",
            cuerpo=f"{actor_nombre or 'Sistema'} anuló {reg.codigo}. Motivo: {motivo}",
            ruta=f"/registro/?codigo={reg.codigo}",
            permiso="codigos:registro:ver",
        )
    )
    return True


@transaction.atomic
def anular_codigo_directo(
    *,
    codigo_id,
    motivo: str,
    actor_persona_id: str,
    actor_nombre: str,
    es_aprobador: bool,
) -> CodigoRegistro:
    motivo_limpio = texto_limpio(motivo, 1000)
    if not motivo_limpio:
        raise ErrorNegocio("El motivo de anulación es obligatorio.", "datos-invalidos", 400)

    reg = CodigoRegistro.objects.select_for_update().filter(pk=codigo_id).first()
    if reg is None:
        raise ErrorNegocio("Código no encontrado.", "no-encontrado", 404)
    actor_id = str(actor_persona_id or "")
    if not es_aprobador and (not actor_id or reg.creado_por_persona_id != actor_id):
        raise ErrorNegocio("No tienes permiso para anular este código.", "sin-acceso", 403)
    if reg.estado == CodigoRegistro.Estado.ANULADO:
        raise ErrorNegocio("El código ya se encuentra anulado.", "ya-anulado", 400)

    _aplicar_anulacion(
        reg,
        motivo=motivo_limpio,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
    )
    return reg


@transaction.atomic
def anular_lote_servicio(
    *,
    codigos: list[str] | None = None,
    referencias_externas: list[str] | None = None,
    motivo: str,
    actor_persona_id: str = "",
    actor_nombre: str = "",
) -> list[dict]:
    motivo_limpio = texto_limpio(motivo, 1000)
    if not motivo_limpio:
        raise ErrorNegocio("El motivo de anulación es obligatorio.", "datos-invalidos", 400)

    cods = [str(c).strip() for c in (codigos or []) if str(c).strip()]
    refs = [str(r).strip() for r in (referencias_externas or []) if str(r).strip()]
    if not cods and not refs:
        raise ErrorNegocio("Indica códigos o referencias externas a anular.", "datos-invalidos", 400)
    if cods and refs:
        raise ErrorNegocio("Envía «codigos» o «referencias_externas», no ambos.", "datos-invalidos", 400)

    qs = CodigoRegistro.objects.select_for_update().order_by("id")
    qs = qs.filter(codigo__in=cods) if cods else qs.filter(referencia_externa__in=refs)
    encontrados = list(qs)
    if not encontrados:
        raise ErrorNegocio("No se encontraron códigos para anular.", "no-encontrado", 404)
    if cods:
        hallados = {r.codigo for r in encontrados}
        faltantes = sorted(set(cods) - hallados)
        if faltantes:
            raise ErrorNegocio(f"Códigos no encontrados: {', '.join(faltantes)}", "no-encontrado", 404)

    salida = []
    for reg in encontrados:
        cambio = _aplicar_anulacion(
            reg,
            motivo=motivo_limpio,
            actor_persona_id=actor_persona_id,
            actor_nombre=actor_nombre,
        )
        salida.append(
            {
                "id": str(reg.id),
                "codigo": reg.codigo,
                "referencia_externa": reg.referencia_externa,
                "estado": reg.estado,
                "repetido": not cambio,
            }
        )
    return salida


@transaction.atomic
def crear_solicitud_anulacion(
    *,
    codigo_id,
    motivo: str,
    solicitante_persona_id: str,
    solicitante_nombre: str,
) -> SolicitudAnulacion:
    motivo_limpio = texto_limpio(motivo, 1000)
    if not motivo_limpio:
        raise ErrorNegocio("El motivo de la solicitud es obligatorio.", "datos-invalidos", 400)
    if not solicitante_persona_id:
        raise ErrorNegocio("Se requiere la identidad de la persona solicitante.", "datos-invalidos", 400)

    reg = CodigoRegistro.objects.select_for_update().filter(pk=codigo_id).first()
    if reg is None:
        raise ErrorNegocio("Código no encontrado.", "no-encontrado", 404)
    if reg.estado == CodigoRegistro.Estado.ANULADO:
        raise ErrorNegocio("El código ya se encuentra anulado.", "ya-anulado", 400)

    try:
        solicitud = SolicitudAnulacion.objects.create(
            codigo_registro=reg,
            solicitante_persona_id=str(solicitante_persona_id)[:64],
            solicitante_nombre=texto_limpio(solicitante_nombre, 200),
            motivo=motivo_limpio,
        )
    except IntegrityError as exc:
        raise ErrorNegocio(
            "Ya tienes una solicitud de anulación pendiente para este código.",
            "solicitud-duplicada",
            400,
        ) from exc

    org_id = organizacion_actual() or reg.organizacion_id
    transaction.on_commit(
        lambda: emitir_aviso(
            id_evento=f"codigos:solicitud:{solicitud.pk}",
            tipo="codigos.solicitud_anulacion",
            organizacion_id=str(org_id),
            titulo=f"Solicitud de anulación: {reg.codigo}",
            cuerpo=f"{solicitante_nombre or 'Un usuario'} solicitó anular {reg.codigo}. Motivo: {motivo_limpio[:250]}",
            ruta="/anulaciones/",
            permiso="codigos:codigos:anular",
        )
    )
    return solicitud


@transaction.atomic
def resolver_solicitud_anulacion(
    *,
    solicitud_id: int,
    accion: str,
    actor_persona_id: str,
    actor_nombre: str,
    motivo_resolucion: str = "",
) -> SolicitudAnulacion:
    if accion not in ("aprobar", "rechazar"):
        raise ErrorNegocio("La acción debe ser «aprobar» o «rechazar».", "datos-invalidos", 400)

    solicitud_ref = SolicitudAnulacion.objects.filter(pk=solicitud_id).values("codigo_registro_id").first()
    if solicitud_ref is None:
        raise ErrorNegocio("Solicitud de anulación no encontrada.", "no-encontrado", 404)
    # Bloquear primero CodigoRegistro y luego SolicitudAnulacion (mismo orden que anular_codigo_directo).
    reg = CodigoRegistro.objects.select_for_update().get(pk=solicitud_ref["codigo_registro_id"])
    solicitud = SolicitudAnulacion.objects.select_for_update().get(pk=solicitud_id)
    if solicitud.estado != SolicitudAnulacion.Estado.PENDIENTE:
        raise ErrorNegocio("Esta solicitud ya fue procesada.", "estado-invalido", 409)

    ahora = now()
    resolucion = texto_limpio(motivo_resolucion, 500)
    if accion == "aprobar":
        cambio = _aplicar_anulacion(
            reg,
            motivo=solicitud.motivo,
            actor_persona_id=actor_persona_id,
            actor_nombre=actor_nombre,
        )
        if not cambio:
            solicitud.estado = SolicitudAnulacion.Estado.APROBADA
            solicitud.resuelto_por_persona_id = str(actor_persona_id or "")[:64]
            solicitud.resuelto_por_nombre = texto_limpio(actor_nombre, 200)
            solicitud.motivo_resolucion = resolucion or "Cerrada (el código ya estaba anulado)."
            solicitud.fecha_resolucion = ahora
            solicitud.save(
                update_fields=[
                    "estado",
                    "resuelto_por_persona_id",
                    "resuelto_por_nombre",
                    "motivo_resolucion",
                    "fecha_resolucion",
                ]
            )
            return solicitud
        solicitud.refresh_from_db()
        if resolucion:
            solicitud.motivo_resolucion = resolucion
            solicitud.save(update_fields=["motivo_resolucion"])
    else:
        solicitud.estado = SolicitudAnulacion.Estado.RECHAZADA
        solicitud.resuelto_por_persona_id = str(actor_persona_id or "")[:64]
        solicitud.resuelto_por_nombre = texto_limpio(actor_nombre, 200)
        solicitud.motivo_resolucion = resolucion
        solicitud.fecha_resolucion = ahora
        solicitud.save(
            update_fields=[
                "estado",
                "resuelto_por_persona_id",
                "resuelto_por_nombre",
                "motivo_resolucion",
                "fecha_resolucion",
            ]
        )
    return solicitud

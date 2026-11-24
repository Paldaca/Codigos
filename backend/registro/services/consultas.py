"""Consultas, búsqueda avanzada y resumen del registro de códigos."""

from __future__ import annotations

from datetime import datetime, time

from django.core.paginator import Paginator
from django.utils.dateparse import parse_date
from django.utils.timezone import make_aware

from registro.models import CodigoRegistro, SolicitudAnulacion


def serializar_codigo(reg: CodigoRegistro, *, pendientes_usuario: set | None = None) -> dict:
    return {
        "id": str(reg.id),
        "codigo": reg.codigo,
        "sigla": reg.sigla,
        "anio": reg.anio,
        "numero_proyecto": reg.numero_proyecto,
        "subproyecto": reg.subproyecto,
        "departamento": reg.departamento,
        "disciplina": reg.disciplina,
        "tipo_documento": reg.tipo_documento,
        "consecutivo": reg.consecutivo,
        "estado": reg.estado,
        "origen": reg.origen,
        "app_origen": reg.app_origen,
        "referencia_externa": reg.referencia_externa,
        "proyecto_shell_codigo": reg.proyecto_shell_codigo,
        "disciplina_shell_codigo": reg.disciplina_shell_codigo,
        "motivo": reg.motivo,
        "motivo_anulacion": reg.motivo_anulacion,
        "creado_por_persona_id": reg.creado_por_persona_id,
        "creado_por_nombre": reg.creado_por_nombre,
        "anulado_por_persona_id": reg.anulado_por_persona_id,
        "anulado_por_nombre": reg.anulado_por_nombre,
        "fecha_creacion": reg.fecha_creacion.isoformat(),
        "fecha_confirmacion": reg.fecha_confirmacion.isoformat() if reg.fecha_confirmacion else None,
        "fecha_anulacion": reg.fecha_anulacion.isoformat() if reg.fecha_anulacion else None,
        "tiene_solicitud_pendiente": bool(pendientes_usuario and reg.id in pendientes_usuario),
    }


def buscar_codigos(
    *,
    codigo: str = "",
    estado: str = "",
    origen: str = "",
    numero_proyecto: str = "",
    disciplina: str = "",
    tipo_documento: str = "",
    creado_por: str = "",
    fecha_inicio: str = "",
    fecha_fin: str = "",
    incluir_anulados: bool = True,
    pagina: int = 1,
    tamano: int = 25,
    persona_id: str = "",
) -> dict:
    qs = CodigoRegistro.objects.all()
    if codigo:
        qs = qs.filter(codigo__icontains=codigo.strip())
    if estado:
        qs = qs.filter(estado=estado.strip())
    elif not incluir_anulados:
        qs = qs.exclude(estado=CodigoRegistro.Estado.ANULADO)
    if origen:
        qs = qs.filter(origen=origen.strip())
    if numero_proyecto:
        qs = qs.filter(numero_proyecto=numero_proyecto.strip().upper())
    if disciplina:
        qs = qs.filter(disciplina=disciplina.strip().upper())
    if tipo_documento:
        qs = qs.filter(tipo_documento=tipo_documento.strip().upper())
    if creado_por:
        qs = qs.filter(creado_por_nombre__icontains=creado_por.strip())
    if fecha_inicio:
        d1 = parse_date(fecha_inicio)
        if d1:
            qs = qs.filter(fecha_creacion__gte=make_aware(datetime.combine(d1, time.min)))
    if fecha_fin:
        d2 = parse_date(fecha_fin)
        if d2:
            qs = qs.filter(fecha_creacion__lte=make_aware(datetime.combine(d2, time.max)))

    paginador = Paginator(qs.order_by("-fecha_creacion", "-consecutivo"), max(1, min(100, tamano)))
    page_obj = paginador.get_page(pagina)

    pendientes_usuario: set = set()
    if persona_id:
        ids_pagina = [c.id for c in page_obj.object_list]
        if ids_pagina:
            pendientes_usuario = set(
                SolicitudAnulacion.objects.filter(
                    codigo_registro_id__in=ids_pagina,
                    solicitante_persona_id=persona_id,
                    estado=SolicitudAnulacion.Estado.PENDIENTE,
                ).values_list("codigo_registro_id", flat=True)
            )

    return {
        "total": paginador.count,
        "pagina": page_obj.number,
        "paginas": paginador.num_pages,
        "resultados": [serializar_codigo(c, pendientes_usuario=pendientes_usuario) for c in page_obj.object_list],
    }


def consultar_codigos_exactos(*, codigos: list[str] | None = None, referencias_externas: list[str] | None = None) -> list[dict]:
    cods = [str(c).strip() for c in (codigos or []) if str(c).strip()]
    refs = [str(r).strip() for r in (referencias_externas or []) if str(r).strip()]
    if not cods and not refs:
        return []
    qs = CodigoRegistro.objects.filter(codigo__in=cods) if cods else CodigoRegistro.objects.filter(referencia_externa__in=refs)
    return [serializar_codigo(c) for c in qs]


def listar_solicitudes(*, estado: str = "") -> list[dict]:
    qs = SolicitudAnulacion.objects.select_related("codigo_registro").order_by("-fecha_solicitud")
    if estado:
        qs = qs.filter(estado=estado)
    return [
        {
            "id": s.pk,
            "codigo_id": str(s.codigo_registro_id),
            "codigo": s.codigo_registro.codigo,
            "motivo_codigo": s.codigo_registro.motivo,
            "solicitante_persona_id": s.solicitante_persona_id,
            "solicitante_nombre": s.solicitante_nombre,
            "motivo": s.motivo,
            "estado": s.estado,
            "resuelto_por_nombre": s.resuelto_por_nombre,
            "motivo_resolucion": s.motivo_resolucion,
            "fecha_solicitud": s.fecha_solicitud.isoformat(),
            "fecha_resolucion": s.fecha_resolucion.isoformat() if s.fecha_resolucion else None,
        }
        for s in qs[:200]
    ]


def resumen_registro() -> dict:
    qs = CodigoRegistro.objects.all()
    return {
        "total": qs.count(),
        "confirmados": qs.filter(estado=CodigoRegistro.Estado.CONFIRMADO).count(),
        "reservados": qs.filter(estado=CodigoRegistro.Estado.RESERVADO).count(),
        "anulados": qs.filter(estado=CodigoRegistro.Estado.ANULADO).count(),
        "manuales": qs.filter(origen=CodigoRegistro.Origen.MANUAL).count(),
        "automaticos": qs.filter(origen=CodigoRegistro.Origen.API).count(),
        "solicitudes_pendientes": SolicitudAnulacion.objects.filter(estado=SolicitudAnulacion.Estado.PENDIENTE).count(),
    }

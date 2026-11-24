"""Vistas REST del programa manual de Códigos (`/api/registro/...`)."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from cereipo_sso.historial import historial_de, serializar_historial
from core.exceptions import ErrorNegocio
from integracion.permissions import TieneIdentidad, requiere_permiso, tiene_permiso

from .models import CodigoRegistro
from .serializers import ItemManualSerializer, MotivoSerializer, ResolverSolicitudSerializer
from .services import (
    anular_codigo_directo,
    buscar_codigos,
    crear_solicitud_anulacion,
    listar_solicitudes,
    previsualizar_lote,
    reservar_o_generar_lote,
    resolver_solicitud_anulacion,
    resumen_registro,
    serializar_codigo,
)


def _extraer_items(data) -> list[dict]:
    if isinstance(data, dict) and "items" in data:
        raw = data["items"]
    elif isinstance(data, dict):
        raw = [data]
    else:
        raise ErrorNegocio("El cuerpo debe ser un objeto JSON o una lista de ítems.", "datos-invalidos", 400)
    if not isinstance(raw, list) or not raw:
        raise ErrorNegocio("Debes enviar al menos un ítem válido.", "datos-invalidos", 400)
    serializer = ItemManualSerializer(data=raw, many=True)
    if not serializer.is_valid():
        raise ErrorNegocio("Datos inválidos en los ítems.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
    return list(serializer.validated_data)


@api_view(["GET"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:inicio:ver")])
def resumen(request):
    return Response(resumen_registro())


@api_view(["POST"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:codigos:generar")])
def previsualizar(request):
    items = _extraer_items(request.data)
    return Response(previsualizar_lote(items))


@api_view(["POST"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:codigos:generar")])
def generar(request):
    items = _extraer_items(request.data)
    identidad = request.cereipo
    resultado = reservar_o_generar_lote(
        items=items,
        actor_persona_id=identidad.persona_id,
        actor_nombre=identidad.nombre,
        origen=CodigoRegistro.Origen.MANUAL,
        confirmar_inmediato=True,
    )
    return Response(resultado, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:registro:ver")])
def lista_codigos(request):
    p = request.GET
    try:
        pagina = int(p.get("pagina", 1))
        tamano = int(p.get("tamano", 25))
    except ValueError as exc:
        raise ErrorNegocio("Parámetros de paginación inválidos.", "datos-invalidos", 400) from exc

    datos = buscar_codigos(
        codigo=p.get("codigo", ""),
        estado=p.get("estado", ""),
        origen=p.get("origen", ""),
        numero_proyecto=p.get("numero_proyecto", ""),
        disciplina=p.get("disciplina", ""),
        tipo_documento=p.get("tipo_documento", ""),
        creado_por=p.get("creado_por", ""),
        fecha_inicio=p.get("fecha_inicio", ""),
        fecha_fin=p.get("fecha_fin", ""),
        incluir_anulados=p.get("incluir_anulados", "1") != "0",
        pagina=pagina,
        tamano=tamano,
        persona_id=request.cereipo.persona_id,
    )
    return Response(datos)


@api_view(["GET"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:registro:ver")])
def detalle_codigo(request, codigo_id):
    reg = get_object_or_404(CodigoRegistro, pk=codigo_id)
    return Response(
        {
            "codigo": serializar_codigo(reg),
            "historial": serializar_historial(historial_de(objeto=reg)),
        }
    )


@api_view(["POST"])
@permission_classes([TieneIdentidad])
def anular(request, codigo_id):
    identidad = request.cereipo
    es_aprobador = tiene_permiso(identidad, "codigos:codigos:anular")
    puede_generar = tiene_permiso(identidad, "codigos:codigos:generar")
    if not es_aprobador and not puede_generar:
        return Response({"error": "sin-acceso", "mensaje": "No tienes permiso para anular códigos."}, status=403)

    serializer = MotivoSerializer(data=request.data)
    if not serializer.is_valid():
        raise ErrorNegocio("El motivo de anulación es obligatorio.", "datos-invalidos", 400)
    reg = anular_codigo_directo(
        codigo_id=codigo_id,
        motivo=serializer.validated_data["motivo"],
        actor_persona_id=identidad.persona_id,
        actor_nombre=identidad.nombre,
        es_aprobador=es_aprobador,
    )
    return Response({"codigo": serializar_codigo(reg)})


@api_view(["POST"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:codigos:generar")])
def solicitar_anulacion(request, codigo_id):
    serializer = MotivoSerializer(data=request.data)
    if not serializer.is_valid():
        raise ErrorNegocio("El motivo de la solicitud es obligatorio.", "datos-invalidos", 400)
    identidad = request.cereipo
    sol = crear_solicitud_anulacion(
        codigo_id=codigo_id,
        motivo=serializer.validated_data["motivo"],
        solicitante_persona_id=identidad.persona_id,
        solicitante_nombre=identidad.nombre,
    )
    return Response({"id": sol.pk, "estado": sol.estado}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:codigos:anular")])
def solicitudes_anulacion(request):
    estado = request.GET.get("estado", "").strip()
    return Response({"resultados": listar_solicitudes(estado=estado)})


@api_view(["POST"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:codigos:anular")])
def resolver_solicitud(request, solicitud_id: int):
    serializer = ResolverSolicitudSerializer(data=request.data)
    if not serializer.is_valid():
        raise ErrorNegocio("Datos inválidos para resolver la solicitud.", "datos-invalidos", 400)
    d = serializer.validated_data
    identidad = request.cereipo
    sol = resolver_solicitud_anulacion(
        solicitud_id=solicitud_id,
        accion=d["accion"],
        actor_persona_id=identidad.persona_id,
        actor_nombre=identidad.nombre,
        motivo_resolucion=d["motivo_resolucion"],
    )
    return Response({"id": sol.pk, "estado": sol.estado})

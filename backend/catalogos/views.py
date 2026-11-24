"""Vistas REST de `catalogos` (sigla única de la organización y segmentos)."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from cereipo_sso.historial import historial_de, serializar_historial
from core.exceptions import ErrorNegocio
from integracion.permissions import TieneIdentidad, requiere_permiso, tiene_permiso

from .models import CatalogoSegmento
from .serializers import (
    ConfiguracionOrganizacionSerializer,
    SegmentoActualizarSerializer,
    SegmentoCrearSerializer,
)
from .services import (
    catalogo_agrupado,
    crear_o_actualizar_segmento,
    guardar_configuracion,
    obtener_configuracion,
    sembrar_catalogos_estandar,
)


def _puede_leer_catalogos(identidad) -> bool:
    return any(
        tiene_permiso(identidad, slug)
        for slug in ("codigos:registro:ver", "codigos:codigos:generar", "codigos:catalogos:administrar")
    )


@api_view(["GET", "PUT"])
@permission_classes([TieneIdentidad])
def configuracion_organizacion(request):
    identidad = request.cereipo
    if request.method == "GET":
        if not _puede_leer_catalogos(identidad):
            return Response({"error": "sin-acceso", "mensaje": "No tienes permiso para consultar catálogos."}, status=403)
        config = obtener_configuracion()
        if config is None:
            return Response({"configurada": False, "sigla": "", "correo_notificacion": "", "notificar_por_correo": False, "bloqueada_por_codigos": False})
        return Response(
            {
                "configurada": True,
                "sigla": config.sigla,
                "correo_notificacion": config.correo_notificacion,
                "notificar_por_correo": config.notificar_por_correo,
                "bloqueada_por_codigos": config.bloqueada_por_codigos,
            }
        )

    if not tiene_permiso(identidad, "codigos:catalogos:administrar"):
        return Response({"error": "sin-acceso", "mensaje": "Requiere permiso codigos:catalogos:administrar."}, status=403)
    serializer = ConfiguracionOrganizacionSerializer(data=request.data)
    if not serializer.is_valid():
        raise ErrorNegocio("Datos inválidos.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
    d = serializer.validated_data
    config = guardar_configuracion(
        sigla=d["sigla"],
        correo_notificacion=d["correo_notificacion"],
        notificar_por_correo=d["notificar_por_correo"],
        actor_persona_id=identidad.persona_id,
        actor_nombre=identidad.nombre,
        motivo=d["motivo"],
    )
    return Response(
        {
            "configurada": True,
            "sigla": config.sigla,
            "correo_notificacion": config.correo_notificacion,
            "notificar_por_correo": config.notificar_por_correo,
            "bloqueada_por_codigos": config.bloqueada_por_codigos,
        }
    )


@api_view(["GET"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:registro:ver")])
def historial_configuracion(request):
    config = obtener_configuracion()
    if config is None:
        return Response({"resultados": []})
    return Response({"resultados": serializar_historial(historial_de(objeto=config))})


@api_view(["GET", "POST"])
@permission_classes([TieneIdentidad])
def segmentos(request):
    identidad = request.cereipo
    if request.method == "GET":
        if not _puede_leer_catalogos(identidad):
            return Response({"error": "sin-acceso", "mensaje": "No tienes permiso para consultar catálogos."}, status=403)
        solo_activos = request.GET.get("incluir_inactivos") != "1"
        datos = catalogo_agrupado(solo_activos=solo_activos)
        tipo = request.GET.get("tipo", "").strip()
        if tipo:
            if tipo not in datos:
                raise ErrorNegocio(f"Tipo inválido: {tipo!r}.", "tipo-segmento-invalido", 400)
            return Response({"tipo": tipo, "elementos": datos[tipo]})
        return Response({"segmentos": datos})

    if not tiene_permiso(identidad, "codigos:catalogos:administrar"):
        return Response({"error": "sin-acceso", "mensaje": "Requiere permiso codigos:catalogos:administrar."}, status=403)
    serializer = SegmentoCrearSerializer(data=request.data)
    if not serializer.is_valid():
        raise ErrorNegocio("Datos inválidos.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
    d = serializer.validated_data
    seg = crear_o_actualizar_segmento(
        tipo=d["tipo"],
        codigo=d["codigo"],
        nombre=d["nombre"],
        codigo_shell=d["codigo_shell"],
        orden=d["orden"],
        activo=d["activo"],
        actor_persona_id=identidad.persona_id,
        actor_nombre=identidad.nombre,
        motivo=d["motivo"],
    )
    return Response(
        {
            "id": seg.pk,
            "tipo": seg.tipo,
            "codigo": seg.codigo,
            "nombre": seg.nombre,
            "codigo_shell": seg.codigo_shell,
            "orden": seg.orden,
            "activo": seg.activo,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:catalogos:administrar")])
def segmento_detalle(request, segmento_id: int):
    seg = get_object_or_404(CatalogoSegmento, pk=segmento_id)
    serializer = SegmentoActualizarSerializer(data=request.data)
    if not serializer.is_valid():
        raise ErrorNegocio("Datos inválidos.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
    d = serializer.validated_data
    actualizado = crear_o_actualizar_segmento(
        tipo=seg.tipo,
        codigo=seg.codigo,
        nombre=d.get("nombre", seg.nombre),
        codigo_shell=d.get("codigo_shell", seg.codigo_shell),
        orden=d.get("orden", seg.orden),
        activo=d.get("activo", seg.activo),
        actor_persona_id=request.cereipo.persona_id,
        actor_nombre=request.cereipo.nombre,
        motivo=d.get("motivo", ""),
    )
    return Response(
        {
            "id": actualizado.pk,
            "tipo": actualizado.tipo,
            "codigo": actualizado.codigo,
            "nombre": actualizado.nombre,
            "codigo_shell": actualizado.codigo_shell,
            "orden": actualizado.orden,
            "activo": actualizado.activo,
        }
    )


@api_view(["POST"])
@permission_classes([TieneIdentidad, requiere_permiso("codigos:catalogos:administrar")])
def sembrar_estandar(request):
    resumen = sembrar_catalogos_estandar(
        actor_persona_id=request.cereipo.persona_id,
        actor_nombre=request.cereipo.nombre,
    )
    return Response(resumen)

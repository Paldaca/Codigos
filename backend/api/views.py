"""Vistas del servicio declarado `codigos/generar-codigos` (modo automático, D-16).

Esta app no define modelos propios ni importa modelos de otras apps (D-19):
delega todo en `catalogos.services` y `registro.services` bajo el contexto de
organización validado por `ServicioAPIMixin` (ORM + RLS).
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogos.services import catalogo_agrupado, obtener_sigla_obligatoria
from core.exceptions import ErrorNegocio
from integracion.permissions import ServicioAPIMixin
from registro.services import (
    anular_lote_servicio,
    confirmar_lote,
    consultar_codigos_exactos,
    reservar_o_generar_lote,
)

from .serializers import (
    AnularServicioSerializer,
    ConfirmarServicioSerializer,
    ConsultarServicioSerializer,
    LoteCodigosServicioSerializer,
)
from .services.bitacora import registrar_llamada


class ServicioBaseView(ServicioAPIMixin, APIView):
    servicio_codigo = "generar-codigos"


class CatalogosServicioView(ServicioBaseView):
    def get(self, request):
        ctx = request.cereipo_servicio
        sigla = obtener_sigla_obligatoria()
        segmentos = catalogo_agrupado(solo_activos=True)
        registrar_llamada(ctx=ctx, operacion="catalogos", estado_http=200)
        return Response(
            {
                "v": 1,
                "organizacion_id": ctx.organizacion_id,
                "sigla": sigla,
                "segmentos": segmentos,
            }
        )


class _AsignacionLoteView(ServicioBaseView):
    confirmar_inmediato: bool = False
    operacion_nombre: str = "reservar"

    def post(self, request):
        ctx = request.cereipo_servicio
        serializer = LoteCodigosServicioSerializer(data=request.data)
        if not serializer.is_valid():
            raise ErrorNegocio("Payload inválido.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
        d = serializer.validated_data
        resultado = reservar_o_generar_lote(
            items=d["items"],
            actor_persona_id=d["actor_persona_id"],
            actor_nombre=d["actor_nombre"],
            origen="api",
            app_origen=ctx.consumidor,
            confirmar_inmediato=self.confirmar_inmediato,
        )
        items_res = resultado["resultados"]
        hubo_nuevos = any(not item["repetido"] for item in items_res)
        estado_http = status.HTTP_201_CREATED if hubo_nuevos else status.HTTP_200_OK
        registrar_llamada(
            ctx=ctx,
            operacion=self.operacion_nombre,
            estado_http=estado_http,
            cantidad=len(items_res),
            referencia=items_res[0]["referencia_externa"] if items_res else "",
        )
        return Response({"v": 1, "resultados": items_res}, status=estado_http)


class ReservarServicioView(_AsignacionLoteView):
    confirmar_inmediato = False
    operacion_nombre = "reservar"


class GenerarServicioView(_AsignacionLoteView):
    confirmar_inmediato = True
    operacion_nombre = "generar"


class ConfirmarServicioView(ServicioBaseView):
    def post(self, request):
        ctx = request.cereipo_servicio
        serializer = ConfirmarServicioSerializer(data=request.data)
        if not serializer.is_valid():
            raise ErrorNegocio("Payload inválido.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
        d = serializer.validated_data
        resultados = confirmar_lote(
            codigos=d["codigos"],
            claves_idempotencia=d["claves_idempotencia"],
            actor_persona_id=d["actor_persona_id"],
            actor_nombre=d["actor_nombre"],
        )
        registrar_llamada(ctx=ctx, operacion="confirmar", estado_http=200, cantidad=len(resultados))
        return Response({"v": 1, "resultados": resultados})


class AnularServicioView(ServicioBaseView):
    def post(self, request):
        ctx = request.cereipo_servicio
        serializer = AnularServicioSerializer(data=request.data)
        if not serializer.is_valid():
            raise ErrorNegocio("Payload inválido.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
        d = serializer.validated_data
        resultados = anular_lote_servicio(
            codigos=d["codigos"],
            referencias_externas=d["referencias_externas"],
            motivo=d["motivo"],
            actor_persona_id=d["actor_persona_id"],
            actor_nombre=d["actor_nombre"],
        )
        registrar_llamada(ctx=ctx, operacion="anular", estado_http=200, cantidad=len(resultados))
        return Response({"v": 1, "resultados": resultados})


class ConsultarServicioView(ServicioBaseView):
    def post(self, request):
        ctx = request.cereipo_servicio
        serializer = ConsultarServicioSerializer(data=request.data)
        if not serializer.is_valid():
            raise ErrorNegocio("Payload inválido.", "datos-invalidos", 400, extra={"detalles": serializer.errors})
        d = serializer.validated_data
        resultados = consultar_codigos_exactos(
            codigos=d["codigos"],
            referencias_externas=d["referencias_externas"],
        )
        registrar_llamada(ctx=ctx, operacion="consultar", estado_http=200, cantidad=len(resultados))
        return Response({"v": 1, "resultados": resultados})

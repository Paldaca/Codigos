"""Vistas de integración con Cereipo Shell (/salud/, /api/yo/, panel D-42, maestros)."""

from __future__ import annotations

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

from cereipo_sso.decoradores import requiere_identidad

from .models import AmbitoPropio, MaestroShellCache
from .services.salud import OK, revisar_base, revisar_redis


@never_cache
@require_GET
def salud(request):
    componentes = {"base": revisar_base(), "redis": revisar_redis()}
    sano = all(estado == OK for estado in componentes.values())
    return JsonResponse(
        {
            "estado": OK if sano else "error",
            "version": settings.APP_VERSION,
            "contrato": settings.CONTRATO_VERSION,
            "componentes": componentes,
        },
        status=200 if sano else 503,
    )


@never_cache
@ensure_csrf_cookie
@require_GET
@requiere_identidad
def yo(request):
    i = request.cereipo
    return JsonResponse(
        {
            "persona": {"id": i.persona_id, "nombre": i.nombre, "correo": i.correo},
            "organizacion": i.organizacion,
            "es_admin_organizacion": i.es_admin_organizacion,
            "rol": i.rol(),
            "permisos": sorted(i.permisos()),
            "proyectos": i.proyectos,
            "gracia": i.gracia,
        }
    )


@never_cache
@require_GET
@requiere_identidad
def ambitos(request):
    i = request.cereipo
    if not (i.es_admin_organizacion or i.puede("codigos:administracion:gestionar")):
        return JsonResponse({"error": "sin-acceso", "mensaje": "No tienes permiso para ver ámbitos."}, status=403)
    proyecto = request.GET.get("proyecto", "")
    consulta = AmbitoPropio.objects.all()
    if proyecto:
        consulta = consulta.filter(proyecto=proyecto)
    return JsonResponse(
        {
            "ambitos": [
                {"proyecto": a.proyecto, "codigo": a.codigo, "nombre": a.nombre, "activo": a.activo}
                for a in consulta[:500]
            ]
        }
    )


@never_cache
@require_GET
@requiere_identidad
def maestros_shell(request):
    i = request.cereipo
    permitidos = ("codigos:inicio:ver", "codigos:registro:ver", "codigos:codigos:generar", "codigos:catalogos:administrar")
    if not any(i.puede(p) for p in permitidos):
        return JsonResponse({"error": "sin-acceso", "mensaje": "No tienes permiso para consultar maestros."}, status=403)
    entidad = request.GET.get("entidad", "").strip()
    if entidad and entidad not in MaestroShellCache.Entidad.values:
        return JsonResponse({"error": "datos-invalidos", "mensaje": f"Entidad inválida: {entidad!r}."}, status=400)
    qs = MaestroShellCache.objects.filter(activo=True)
    if entidad:
        qs = qs.filter(entidad=entidad)
    return JsonResponse(
        {
            "resultados": [
                {"entidad": m.entidad, "clave": m.clave, "datos": m.datos}
                for m in qs[:500]
            ]
        }
    )

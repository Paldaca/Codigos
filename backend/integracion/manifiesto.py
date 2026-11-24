"""Manifiesto de Códigos (`GET /.well-known/cereipo-app.json`, contratos §4)."""

from __future__ import annotations

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from config.db import APP_CODIGO

CODIGO = APP_CODIGO
REQUIERE_PROYECTO = False
RECURSO_AMBITO = None

GESTIONAR = f"{CODIGO}:administracion:gestionar"
RUTA_PANEL = "/proyectos/{proyecto}/administracion/" if REQUIERE_PROYECTO else "/administracion/"


def manifiesto() -> dict:
    permisos = [
        {"slug": f"{CODIGO}:inicio:ver", "descripcion": "Ver el resumen inicial de Códigos"},
        {"slug": f"{CODIGO}:registro:ver", "descripcion": "Consultar códigos generados, búsqueda e historial"},
        {"slug": f"{CODIGO}:codigos:generar", "descripcion": "Generar códigos manualmente y solicitar anulaciones"},
        {"slug": f"{CODIGO}:codigos:anular", "descripcion": "Anular códigos y aprobar o rechazar solicitudes"},
        {"slug": f"{CODIGO}:catalogos:administrar", "descripcion": "Configurar la sigla de organización y los catálogos de segmentos"},
        {"slug": GESTIONAR, "descripcion": "Usar el panel de administración de la app"},
    ]
    todos = [p["slug"] for p in permisos]
    return {
        "contrato": settings.CONTRATO_VERSION,
        "codigo": CODIGO,
        "nombre": "Códigos",
        "descripcion": "Codificación estructurada de documentos y planos (manual y vía API).",
        "version": settings.APP_VERSION,
        "icono": "hash",
        "color": "#5B21B6",
        "grupo": "procesos-medulares",
        "ruta_inicio": "/",
        "requiere_proyecto": REQUIERE_PROYECTO,
        "capacidades": ["navegar", "contexto", "visibilidad"],
        "menu": [
            {"id": "inicio", "etiqueta": "Inicio", "ruta": "/", "icono": "home", "permiso": f"{CODIGO}:inicio:ver"},
            {"id": "generar", "etiqueta": "Generar códigos", "ruta": "/generar/", "icono": "plus-circle", "permiso": f"{CODIGO}:codigos:generar"},
            {"id": "registro", "etiqueta": "Registro", "ruta": "/registro/", "icono": "list", "permiso": f"{CODIGO}:registro:ver"},
            {"id": "anulaciones", "etiqueta": "Anulaciones", "ruta": "/anulaciones/", "icono": "ban", "permiso": f"{CODIGO}:codigos:anular"},
            {"id": "catalogos", "etiqueta": "Catálogos", "ruta": "/catalogos/", "icono": "sliders", "permiso": f"{CODIGO}:catalogos:administrar"},
            {"id": "administracion", "etiqueta": "Administración", "ruta": RUTA_PANEL, "icono": "settings", "permiso": GESTIONAR},
        ],
        "permisos": permisos,
        "roles_sugeridos": [
            {"slug": "administrador", "nombre": "Administrador de Códigos", "alcance_disciplina": "todas", "permisos": todos},
            {
                "slug": "aprobador",
                "nombre": "Aprobador de codificación",
                "alcance_disciplina": "todas",
                "permisos": [
                    f"{CODIGO}:inicio:ver",
                    f"{CODIGO}:registro:ver",
                    f"{CODIGO}:codigos:generar",
                    f"{CODIGO}:codigos:anular",
                    f"{CODIGO}:catalogos:administrar",
                ],
            },
            {
                "slug": "generador",
                "nombre": "Generador",
                "alcance_disciplina": "todas",
                "permisos": [f"{CODIGO}:inicio:ver", f"{CODIGO}:registro:ver", f"{CODIGO}:codigos:generar"],
            },
            {
                "slug": "consulta",
                "nombre": "Consulta",
                "alcance_disciplina": "todas",
                "permisos": [f"{CODIGO}:inicio:ver", f"{CODIGO}:registro:ver"],
            },
        ],
        "servicios": [
            {
                "codigo": "generar-codigos",
                "nombre": "Generación y anulación de códigos",
                "descripcion": "Reserva en lote, confirma, consulta y anula códigos de documentos y planos.",
                "version": 1,
                "ruta": "/api/servicios/generar-codigos/",
            },
        ],
        "avisos": [
            {"tipo": "codigos.solicitud_anulacion", "nombre": "Solicitud de anulación de código", "severidad": "advertencia", "silenciable": False},
            {"tipo": "codigos.codigo_anulado", "nombre": "Código anulado", "severidad": "advertencia", "silenciable": True},
        ],
        "maestros_propios": ["codigos.catalogos"],
        "publica": [
            {"dato": "codigos.catalogos", "clase": "maestro"},
            {"dato": "codigos.codigo_anulado", "clase": "hecho"},
        ],
        "consume": [
            {"dato": "shell.clientes", "tipo": "enriquece", "respaldo": "manual"},
            {"dato": "shell.proyectos", "tipo": "enriquece", "respaldo": "manual"},
            {"dato": "shell.disciplinas", "tipo": "enriquece", "respaldo": "manual"},
        ],
        "salud": "/salud/",
    }


@require_GET
def vista(request):
    respuesta = JsonResponse(manifiesto(), json_dumps_params={"ensure_ascii": False})
    respuesta["Cache-Control"] = "no-cache"
    return respuesta

"""Sincronización de datos maestros consumidos y publicados hacia el Shell (tarea 5.5)."""

from __future__ import annotations

import logging

from cereipo_sso.maestros import ErrorMaestros, leer_maestro, sincronizar_maestro
from cereipo_sso.organizacion import TODAS, con_organizacion

from integracion.models import CursorMaestro, MaestroShellCache

log = logging.getLogger(__name__)

ENTIDADES_CONSUMIDAS = ("shell.clientes", "shell.proyectos", "shell.disciplinas")


def refrescar_maestros_shell() -> dict[str, int]:
    """Lee cambios incrementales de clientes, proyectos y disciplinas desde el Shell."""
    resumen: dict[str, int] = {}
    for entidad in ENTIDADES_CONSUMIDAS:
        with con_organizacion(TODAS):
            cursor, _ = CursorMaestro.objects.get_or_create(entidad=entidad)
            desde = cursor.marca or None
        actualizados = 0
        while True:
            respuesta = leer_maestro(entidad, desde=desde)
            with con_organizacion(TODAS):
                cursor, _ = CursorMaestro.objects.get_or_create(entidad=entidad)
                for item in respuesta.resultados:
                    org_id = str(item.get("organizacion_id") or "").strip()
                    clave = str(item.get("clave") or "").strip()
                    if not org_id or not clave:
                        continue
                    MaestroShellCache.todas_las_organizaciones.update_or_create(
                        organizacion_id=org_id,
                        entidad=entidad,
                        clave=clave,
                        defaults={
                            "datos": item.get("datos") or {},
                            "activo": bool(item.get("activo", True)),
                        },
                    )
                    actualizados += 1
                if respuesta.marca:
                    cursor.marca = respuesta.marca
                    cursor.save(update_fields=["marca", "actualizado_en"])
            if not respuesta.hay_mas or not respuesta.marca or respuesta.marca == desde:
                break
            desde = respuesta.marca
        resumen[entidad] = actualizados
    return resumen


def publicar_catalogo_maestro(organizacion_id: str, registros: list[dict], *, completo: bool = True) -> dict | None:
    """Publica `codigos.catalogos` en el Shell. Tolerante a fallos si el Shell no responde."""
    try:
        return sincronizar_maestro(
            "codigos.catalogos",
            organizacion_id=str(organizacion_id),
            registros=registros,
            completo=completo,
        )
    except (ErrorMaestros, OSError) as error:
        log.warning("No se pudo publicar codigos.catalogos al Shell para org=%s: %s", organizacion_id, error)
        return None

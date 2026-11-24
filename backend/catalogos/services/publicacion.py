"""Publicación del maestro `codigos.catalogos` hacia Cereipo Shell (tarea 5.5)."""

from __future__ import annotations

from cereipo_sso.organizacion import organizacion_actual

from catalogos.models import CatalogoSegmento, ConfiguracionOrganizacion
from integracion.services.maestros import publicar_catalogo_maestro


def publicar_catalogos_activos(organizacion_id: str | None = None) -> dict | None:
    org_id = organizacion_id or organizacion_actual()
    if not org_id or org_id == "*":
        return None
    config = ConfiguracionOrganizacion.objects.filter(organizacion_id=org_id).first()
    registros: list[dict] = []
    if config is not None:
        registros.append(
            {
                "clave": "organizacion:config",
                "datos": {"sigla": config.sigla},
                "activo": True,
            }
        )
    for seg in CatalogoSegmento.objects.filter(organizacion_id=org_id):
        registros.append(
            {
                "clave": f"{seg.tipo}:{seg.codigo}",
                "datos": {
                    "tipo": seg.tipo,
                    "codigo": seg.codigo,
                    "nombre": seg.nombre,
                    "codigo_shell": seg.codigo_shell,
                    "orden": seg.orden,
                },
                "activo": seg.activo,
            }
        )
    return publicar_catalogo_maestro(org_id, registros, completo=True)

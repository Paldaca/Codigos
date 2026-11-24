"""Publicación del maestro `codigos.catalogos` hacia Cereipo Shell (tarea 5.5)."""

from __future__ import annotations

from cereipo_sso.organizacion import con_organizacion, organizacion_actual

from catalogos.models import CatalogoSegmento, ConfiguracionOrganizacion
from integracion.services.maestros import publicar_catalogo_maestro


def construir_snapshot_catalogos(organizacion_id: str) -> list[dict]:
    """Construye la lista completa de registros maestros dentro de la transacción/RLS activa."""
    config = ConfiguracionOrganizacion.objects.filter(organizacion_id=organizacion_id).first()
    registros: list[dict] = []
    if config is not None:
        registros.append(
            {
                "clave": "organizacion:config",
                "datos": {"sigla": config.sigla},
                "activo": True,
            }
        )
    for seg in CatalogoSegmento.objects.filter(organizacion_id=organizacion_id):
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
    return registros


def publicar_snapshot_catalogos(organizacion_id: str, registros: list[dict]) -> dict | None:
    if not organizacion_id or organizacion_id == "*":
        return None
    return publicar_catalogo_maestro(organizacion_id, registros, completo=True)


def publicar_catalogos_activos(organizacion_id: str | None = None) -> dict | None:
    org_id = organizacion_id or organizacion_actual()
    if not org_id or org_id == "*":
        return None
    if organizacion_actual() == org_id:
        registros = construir_snapshot_catalogos(org_id)
    else:
        with con_organizacion(org_id):
            registros = construir_snapshot_catalogos(org_id)
    return publicar_catalogo_maestro(org_id, registros, completo=True)

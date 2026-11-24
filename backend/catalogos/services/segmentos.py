"""Gestión y validación de catálogos de segmentos por organización (tarea 5.2)."""

from __future__ import annotations

from django.db import transaction

from cereipo_sso.historial import calcular_cambios, capturar_estado, registrar_cambio
from cereipo_sso.organizacion import organizacion_actual
from core.exceptions import ErrorNegocio
from core.validators import normalizar_codigo_segmento, validar_anio

from catalogos.models import CatalogoSegmento
from .publicacion import publicar_catalogos_activos
from .semillas import (
    DEPARTAMENTOS_ESTANDAR,
    DISCIPLINAS_ESTANDAR,
    PROYECTOS_ESTANDAR,
    SUBPROYECTOS_ESTANDAR,
    TIPOS_DOCUMENTO_ESTANDAR,
)


def listar_segmentos(*, tipo: str | None = None, solo_activos: bool = True) -> list[CatalogoSegmento]:
    qs = CatalogoSegmento.objects.all()
    if tipo:
        qs = qs.filter(tipo=tipo)
    if solo_activos:
        qs = qs.filter(activo=True)
    return list(qs)


def catalogo_agrupado(*, solo_activos: bool = True) -> dict[str, list[dict]]:
    agrupado: dict[str, list[dict]] = {t: [] for t, _ in CatalogoSegmento.Tipo.choices}
    for seg in listar_segmentos(solo_activos=solo_activos):
        agrupado[seg.tipo].append(
            {
                "id": seg.pk,
                "tipo": seg.tipo,
                "codigo": seg.codigo,
                "nombre": seg.nombre,
                "codigo_shell": seg.codigo_shell,
                "orden": seg.orden,
                "activo": seg.activo,
            }
        )
    return agrupado


@transaction.atomic
def crear_o_actualizar_segmento(
    *,
    tipo: str,
    codigo: str,
    nombre: str,
    codigo_shell: str = "",
    orden: int = 0,
    activo: bool = True,
    actor_persona_id: str = "",
    actor_nombre: str = "",
    motivo: str = "",
) -> CatalogoSegmento:
    if tipo not in CatalogoSegmento.Tipo.values:
        raise ErrorNegocio(f"Tipo de segmento desconocido: {tipo!r}.", "tipo-segmento-invalido", 400)
    cod = normalizar_codigo_segmento(codigo, tipo)
    nom = (nombre or "").strip()
    if not nom:
        raise ErrorNegocio("El nombre del elemento de catálogo es obligatorio.", "datos-invalidos", 400)

    org_id = organizacion_actual()
    existente = CatalogoSegmento.objects.select_for_update().filter(tipo=tipo, codigo=cod).first()
    campos = ["nombre", "codigo_shell", "orden", "activo"]
    if existente is not None:
        antes = capturar_estado(existente, campos)
        existente.nombre = nom[:120]
        existente.codigo_shell = (codigo_shell or "").strip().upper()[:40]
        existente.orden = int(orden or 0)
        existente.activo = bool(activo)
        existente.save()
        seg = existente
        accion = "editado"
    else:
        antes = None
        seg = CatalogoSegmento.objects.create(
            tipo=tipo,
            codigo=cod,
            nombre=nom[:120],
            codigo_shell=(codigo_shell or "").strip().upper()[:40],
            orden=int(orden or 0),
            activo=bool(activo),
        )
        accion = "creado"

    despues = capturar_estado(seg, campos)
    registrar_cambio(
        objeto=seg,
        accion=accion,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
        cambios=calcular_cambios(antes or {}, despues),
        motivo=motivo,
    )
    transaction.on_commit(lambda: publicar_catalogos_activos(org_id))
    return seg


@transaction.atomic
def sembrar_catalogos_estandar(*, actor_persona_id: str = "", actor_nombre: str = "") -> dict[str, int]:
    """Siembra los catálogos estándar de la metodología en la organización activa sin pisar existentes."""
    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    existentes = set(CatalogoSegmento.objects.values_list("tipo", "codigo"))
    por_crear: list[CatalogoSegmento] = []

    def _agregar(tipo: str, items: list[tuple]):
        for idx, item in enumerate(items, start=1):
            cod = item[0]
            nom = item[1]
            shell = item[2] if len(item) > 2 else ""
            if (tipo, cod) not in existentes:
                por_crear.append(
                    CatalogoSegmento(
                        organizacion_id=org_id,
                        tipo=tipo,
                        codigo=cod,
                        nombre=nom,
                        codigo_shell=shell,
                        orden=idx,
                        activo=True,
                    )
                )
                existentes.add((tipo, cod))

    _agregar(CatalogoSegmento.Tipo.PROYECTO, PROYECTOS_ESTANDAR)
    _agregar(CatalogoSegmento.Tipo.SUBPROYECTO, SUBPROYECTOS_ESTANDAR)
    _agregar(CatalogoSegmento.Tipo.DEPARTAMENTO, DEPARTAMENTOS_ESTANDAR)
    _agregar(CatalogoSegmento.Tipo.DISCIPLINA, DISCIPLINAS_ESTANDAR)
    _agregar(CatalogoSegmento.Tipo.TIPO_DOCUMENTO, TIPOS_DOCUMENTO_ESTANDAR)

    if por_crear:
        CatalogoSegmento.objects.bulk_create(por_crear)
        transaction.on_commit(lambda: publicar_catalogos_activos(org_id))

    return {"creados": len(por_crear), "total": len(existentes)}


def asegurar_segmentos_migrados(organizacion_id: str, pares: list[tuple[str, str]]) -> None:
    """Crea segmentos históricos faltantes en la organización migrada."""
    existentes = set(CatalogoSegmento.objects.values_list("tipo", "codigo"))
    faltantes: list[CatalogoSegmento] = []
    for tipo, val in pares:
        if val and (tipo, val) not in existentes:
            faltantes.append(
                CatalogoSegmento(
                    organizacion_id=organizacion_id,
                    tipo=tipo,
                    codigo=val,
                    nombre=f"{val} (migrado)",
                    activo=True,
                )
            )
            existentes.add((tipo, val))
    if faltantes:
        CatalogoSegmento.objects.bulk_create(faltantes)


def validar_y_resolver_segmentos(
    *,
    anio: str | int,
    numero_proyecto: str,
    subproyecto: str,
    departamento: str,
    tipo_documento: str,
    disciplina: str = "",
    disciplina_shell: str = "",
) -> dict[str, str]:
    """Valida los 6 segmentos variables contra los catálogos activos de la organización."""
    anio_val = validar_anio(anio)
    num_proy = normalizar_codigo_segmento(numero_proyecto, "numero_proyecto")
    sub_proy = normalizar_codigo_segmento(subproyecto, "subproyecto")
    depto = normalizar_codigo_segmento(departamento, "departamento")
    tipo_doc = normalizar_codigo_segmento(tipo_documento, "tipo_documento")

    activos = CatalogoSegmento.objects.filter(activo=True)
    requeridos = [
        (CatalogoSegmento.Tipo.PROYECTO, num_proy, "numero_proyecto"),
        (CatalogoSegmento.Tipo.SUBPROYECTO, sub_proy, "subproyecto"),
        (CatalogoSegmento.Tipo.DEPARTAMENTO, depto, "departamento"),
        (CatalogoSegmento.Tipo.TIPO_DOCUMENTO, tipo_doc, "tipo_documento"),
    ]
    for tipo, cod, etiqueta in requeridos:
        if not activos.filter(tipo=tipo, codigo=cod).exists():
            raise ErrorNegocio(
                f"El valor «{cod}» no está activo en el catálogo de {etiqueta} de la organización.",
                "datos-invalidos",
                400,
            )

    disc_cod = (disciplina or "").strip().upper()
    disc_shell = (disciplina_shell or "").strip().upper()
    if disc_cod:
        seg_disc = activos.filter(tipo=CatalogoSegmento.Tipo.DISCIPLINA, codigo=disc_cod).first()
    elif disc_shell:
        seg_disc = activos.filter(tipo=CatalogoSegmento.Tipo.DISCIPLINA, codigo_shell__iexact=disc_shell).first()
    else:
        seg_disc = None

    if seg_disc is None:
        raise ErrorNegocio(
            "Disciplina inválida o inactiva en el catálogo de la organización.",
            "datos-invalidos",
            400,
        )

    return {
        "anio": anio_val,
        "numero_proyecto": num_proy,
        "subproyecto": sub_proy,
        "departamento": depto,
        "disciplina": seg_disc.codigo,
        "disciplina_shell": seg_disc.codigo_shell or disc_shell,
        "tipo_documento": tipo_doc,
    }

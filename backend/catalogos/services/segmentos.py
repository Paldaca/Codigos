"""Gestión, plantilla, personalización y reversión de catálogos de segmentos (tareas 5.2, 5.2b)."""

from __future__ import annotations

from django.db import IntegrityError, transaction

from cereipo_sso.historial import (
    calcular_cambios,
    capturar_estado,
    historial_de,
    registrar_cambio,
    serializar_historial,
)
from cereipo_sso.models import RegistroHistorial
from cereipo_sso.organizacion import organizacion_actual
from core.exceptions import ErrorNegocio
from core.validators import normalizar_codigo_segmento, validar_anio

from catalogos.models import CatalogoSegmento, InstantaneaCatalogo
from .publicacion import construir_snapshot_catalogos, publicar_snapshot_catalogos
from .semillas import (
    DEPARTAMENTOS_ESTANDAR,
    DISCIPLINAS_ESTANDAR,
    PROYECTOS_ESTANDAR,
    SUBPROYECTOS_ESTANDAR,
    TIPOS_DOCUMENTO_ESTANDAR,
)

ESTANDARES_POR_TIPO: dict[str, list[tuple]] = {
    CatalogoSegmento.Tipo.PROYECTO: PROYECTOS_ESTANDAR,
    CatalogoSegmento.Tipo.SUBPROYECTO: SUBPROYECTOS_ESTANDAR,
    CatalogoSegmento.Tipo.DEPARTAMENTO: DEPARTAMENTOS_ESTANDAR,
    CatalogoSegmento.Tipo.DISCIPLINA: DISCIPLINAS_ESTANDAR,
    CatalogoSegmento.Tipo.TIPO_DOCUMENTO: TIPOS_DOCUMENTO_ESTANDAR,
}

CAMPOS_SEGMENTO = ["nombre", "codigo_shell", "orden", "activo"]
ETIQUETAS_CAMPOS = {
    "nombre": "Nombre",
    "codigo_shell": "Código Shell",
    "orden": "Orden",
    "activo": "Activo",
}


def _publicar_al_confirmar(org_id: str) -> None:
    snapshot = construir_snapshot_catalogos(org_id)
    transaction.on_commit(lambda: publicar_snapshot_catalogos(org_id, snapshot))


def _crear_instantanea(
    *,
    org_id: str,
    descripcion: str,
    tipo_alcance: str = "",
    actor_persona_id: str = "",
    actor_nombre: str = "",
) -> InstantaneaCatalogo:
    qs = CatalogoSegmento.objects.all()
    if tipo_alcance:
        qs = qs.filter(tipo=tipo_alcance)
    datos = [
        {
            "tipo": s.tipo,
            "codigo": s.codigo,
            "nombre": s.nombre,
            "codigo_shell": s.codigo_shell,
            "orden": s.orden,
            "activo": s.activo,
        }
        for s in qs.order_by("tipo", "orden", "codigo")
    ]
    return InstantaneaCatalogo.objects.create(
        organizacion_id=org_id,
        descripcion=descripcion[:200],
        tipo_alcance=tipo_alcance[:20],
        datos=datos,
        actor_persona_id=str(actor_persona_id or "")[:64],
        actor_nombre=(actor_nombre or "")[:200],
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
    if existente is not None:
        antes = capturar_estado(existente, CAMPOS_SEGMENTO)
        existente.nombre = nom[:120]
        existente.codigo_shell = (codigo_shell or "").strip().upper()[:40]
        existente.orden = int(orden or 0)
        existente.activo = bool(activo)
        existente.save()
        seg = existente
        accion = "editado"
    else:
        antes = None
        try:
            with transaction.atomic():
                seg = CatalogoSegmento.objects.create(
                    tipo=tipo,
                    codigo=cod,
                    nombre=nom[:120],
                    codigo_shell=(codigo_shell or "").strip().upper()[:40],
                    orden=int(orden or 0),
                    activo=bool(activo),
                )
            accion = "creado"
        except IntegrityError:
            existente = CatalogoSegmento.objects.select_for_update().get(tipo=tipo, codigo=cod)
            antes = capturar_estado(existente, CAMPOS_SEGMENTO)
            existente.nombre = nom[:120]
            existente.codigo_shell = (codigo_shell or "").strip().upper()[:40]
            existente.orden = int(orden or 0)
            existente.activo = bool(activo)
            existente.save()
            seg = existente
            accion = "editado"

    despues = capturar_estado(seg, CAMPOS_SEGMENTO)
    cambios = calcular_cambios(antes or {}, despues, etiquetas=ETIQUETAS_CAMPOS)
    if accion == "creado" or cambios:
        registrar_cambio(
            objeto=seg,
            accion=accion,
            proyecto=seg.tipo,
            actor_persona_id=actor_persona_id,
            actor_nombre=actor_nombre,
            cambios=cambios,
            motivo=motivo,
        )
    _publicar_al_confirmar(org_id)
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

    for tipo, items in ESTANDARES_POR_TIPO.items():
        _agregar(tipo, items)

    if por_crear:
        CatalogoSegmento.objects.bulk_create(por_crear, ignore_conflicts=True)
        _publicar_al_confirmar(org_id)

    return {"creados": len(por_crear), "total": len(existentes)}


@transaction.atomic
def restablecer_plantilla_estandar(
    *,
    tipo: str = "",
    desactivar_personalizados: bool = True,
    actor_persona_id: str = "",
    actor_nombre: str = "",
    motivo: str = "",
) -> dict:
    """Restablece uno o todos los catálogos a la plantilla original guardando punto de restauración (5.2b)."""
    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    tipo_limpio = (tipo or "").strip()
    if tipo_limpio and tipo_limpio not in ESTANDARES_POR_TIPO:
        raise ErrorNegocio(f"Tipo de segmento desconocido: {tipo_limpio!r}.", "tipo-segmento-invalido", 400)

    tipos_objetivo = [tipo_limpio] if tipo_limpio else list(ESTANDARES_POR_TIPO.keys())
    snap = _crear_instantanea(
        org_id=org_id,
        descripcion=f"Respaldo previo a restablecer plantilla ({tipo_limpio or 'esquema completo'})",
        tipo_alcance=tipo_limpio,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
    )

    qs = CatalogoSegmento.objects.select_for_update().filter(tipo__in=tipos_objetivo)
    existentes: dict[tuple[str, str], CatalogoSegmento] = {(s.tipo, s.codigo): s for s in qs}

    creados = 0
    restaurados = 0
    desactivados = 0
    por_crear: list[CatalogoSegmento] = []
    por_actualizar: list[CatalogoSegmento] = []
    claves_estandar: set[tuple[str, str]] = set()

    for t in tipos_objetivo:
        for idx, item in enumerate(ESTANDARES_POR_TIPO[t], start=1):
            cod = item[0]
            nom = item[1]
            shell = item[2] if len(item) > 2 else ""
            clave = (t, cod)
            claves_estandar.add(clave)
            actual = existentes.get(clave)
            if actual is None:
                por_crear.append(
                    CatalogoSegmento(
                        organizacion_id=org_id,
                        tipo=t,
                        codigo=cod,
                        nombre=nom,
                        codigo_shell=shell,
                        orden=idx,
                        activo=True,
                    )
                )
                creados += 1
            else:
                cambio = (
                    actual.nombre != nom
                    or actual.codigo_shell != shell
                    or actual.orden != idx
                    or not actual.activo
                )
                if cambio:
                    actual.nombre = nom
                    actual.codigo_shell = shell
                    actual.orden = idx
                    actual.activo = True
                    por_actualizar.append(actual)
                    restaurados += 1

    if desactivar_personalizados:
        for clave, seg in existentes.items():
            if clave not in claves_estandar and seg.activo:
                seg.activo = False
                por_actualizar.append(seg)
                desactivados += 1

    if por_crear:
        CatalogoSegmento.objects.bulk_create(por_crear, ignore_conflicts=True)
    if por_actualizar:
        CatalogoSegmento.objects.bulk_update(por_actualizar, ["nombre", "codigo_shell", "orden", "activo"])

    registrar_cambio(
        objeto=snap,
        accion="restablecer_plantilla",
        resumen=f"Plantilla restablecida ({tipo_limpio or 'completo'}): {creados} nuevos, {restaurados} restaurados, {desactivados} desactivados",
        proyecto=tipo_limpio,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
        motivo=motivo or "Restablecimiento a la plantilla estándar",
    )
    _publicar_al_confirmar(org_id)

    total = CatalogoSegmento.objects.filter(tipo__in=tipos_objetivo, activo=True).count()
    return {
        "creados": creados,
        "restaurados": restaurados,
        "desactivados": desactivados,
        "total": total,
        "instantanea_id": snap.pk,
    }


@transaction.atomic
def actualizacion_masiva_segmentos(
    *,
    tipo: str,
    accion: str,
    actor_persona_id: str = "",
    actor_nombre: str = "",
    motivo: str = "",
) -> dict:
    """Aplica cambios masivos sobre un tipo de segmento con instantánea previa para poder revertir (5.2b)."""
    if tipo not in CatalogoSegmento.Tipo.values:
        raise ErrorNegocio(f"Tipo de segmento desconocido: {tipo!r}.", "tipo-segmento-invalido", 400)
    if accion not in ("activar_todos", "desactivar_todos", "solo_general"):
        raise ErrorNegocio(f"Acción masiva desconocida: {accion!r}.", "datos-invalidos", 400)
    if accion == "solo_general" and tipo not in (CatalogoSegmento.Tipo.PROYECTO, CatalogoSegmento.Tipo.SUBPROYECTO):
        raise ErrorNegocio("«Solo general» aplica únicamente a Proyecto y Subproyecto.", "datos-invalidos", 400)

    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    etiquetas = {
        "activar_todos": f"Antes de activar todos en {tipo}",
        "desactivar_todos": f"Antes de desactivar todos en {tipo}",
        "solo_general": f"Antes de dejar solo código general en {tipo}",
    }
    snap = _crear_instantanea(
        org_id=org_id,
        descripcion=etiquetas[accion],
        tipo_alcance=tipo,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
    )

    qs = list(CatalogoSegmento.objects.select_for_update().filter(tipo=tipo))
    por_actualizar: list[CatalogoSegmento] = []
    for seg in qs:
        if accion == "activar_todos":
            nuevo = True
        elif accion == "desactivar_todos":
            nuevo = False
        else:
            nuevo = set(seg.codigo) == {"0"}
        if seg.activo != nuevo:
            seg.activo = nuevo
            por_actualizar.append(seg)

    if por_actualizar:
        CatalogoSegmento.objects.bulk_update(por_actualizar, ["activo"])
        registrar_cambio(
            objeto=snap,
            accion="lote_segmentos",
            resumen=f"Actualización en lote ({accion}) sobre {tipo}: {len(por_actualizar)} elemento(s) modificados",
            proyecto=tipo,
            actor_persona_id=actor_persona_id,
            actor_nombre=actor_nombre,
            motivo=motivo,
        )
        _publicar_al_confirmar(org_id)

    return {"actualizados": len(por_actualizar), "instantanea_id": snap.pk}


@transaction.atomic
def revertir_cambio_segmento(
    historial_id: int,
    *,
    actor_persona_id: str = "",
    actor_nombre: str = "",
) -> dict:
    """Revierte un cambio puntual de `CatalogoSegmento` registrado en `RegistroHistorial` (5.2b)."""
    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    entrada = RegistroHistorial.objects.filter(
        pk=historial_id,
        objeto_tipo="catalogos.CatalogoSegmento",
    ).first()
    if entrada is None:
        raise ErrorNegocio("No se encontró el cambio de catálogo indicado.", "no-encontrado", 404)

    try:
        seg_id = int(entrada.objeto_id)
    except (TypeError, ValueError) as exc:
        raise ErrorNegocio("Identificador de segmento inválido en historial.", "datos-invalidos", 400) from exc

    seg = CatalogoSegmento.objects.select_for_update().filter(pk=seg_id).first()
    if seg is None:
        raise ErrorNegocio("El segmento ya no existe en el catálogo.", "no-encontrado", 404)

    antes = capturar_estado(seg, CAMPOS_SEGMENTO)

    if entrada.accion == "creado":
        seg.activo = False
    else:
        if not entrada.cambios:
            raise ErrorNegocio("Este registro no tiene valores anteriores para revertir.", "datos-invalidos", 400)
        for c in entrada.cambios:
            campo = c.get("campo")
            if campo == "nombre" and isinstance(c.get("antes"), str) and c["antes"].strip():
                seg.nombre = c["antes"].strip()[:120]
            elif campo == "codigo_shell" and c.get("antes") is not None:
                seg.codigo_shell = str(c["antes"]).strip().upper()[:40]
            elif campo == "orden" and c.get("antes") is not None:
                seg.orden = int(c["antes"])
            elif campo == "activo" and c.get("antes") is not None:
                seg.activo = bool(c["antes"])

    seg.save()
    despues = capturar_estado(seg, CAMPOS_SEGMENTO)
    cambios_rev = calcular_cambios(antes, despues, etiquetas=ETIQUETAS_CAMPOS)
    if cambios_rev:
        registrar_cambio(
            objeto=seg,
            accion="revertido",
            proyecto=seg.tipo,
            actor_persona_id=actor_persona_id,
            actor_nombre=actor_nombre,
            cambios=cambios_rev,
            motivo=f"Reversión del cambio #{entrada.pk}",
        )
        _publicar_al_confirmar(org_id)

    return {
        "segmento": {
            "id": seg.pk,
            "tipo": seg.tipo,
            "codigo": seg.codigo,
            "nombre": seg.nombre,
            "codigo_shell": seg.codigo_shell,
            "orden": seg.orden,
            "activo": seg.activo,
        },
        "revertido_de": entrada.pk,
    }


@transaction.atomic
def restaurar_instantanea(
    instantanea_id: int,
    *,
    actor_persona_id: str = "",
    actor_nombre: str = "",
    motivo: str = "",
) -> dict:
    """Restaura el catálogo de segmentos a una instantánea previa (5.2b)."""
    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    snap = InstantaneaCatalogo.objects.filter(pk=instantanea_id).first()
    if snap is None:
        raise ErrorNegocio("No se encontró el punto de restauración.", "no-encontrado", 404)

    respaldo_nuevo = _crear_instantanea(
        org_id=org_id,
        descripcion=f"Respaldo antes de restaurar «{snap.descripcion[:120]}»",
        tipo_alcance=snap.tipo_alcance,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
    )

    qs = CatalogoSegmento.objects.select_for_update()
    if snap.tipo_alcance:
        qs = qs.filter(tipo=snap.tipo_alcance)
    actuales: dict[tuple[str, str], CatalogoSegmento] = {(s.tipo, s.codigo): s for s in qs}

    claves_snap: set[tuple[str, str]] = set()
    por_crear: list[CatalogoSegmento] = []
    por_actualizar: list[CatalogoSegmento] = []
    restaurados = 0

    for item in snap.datos or []:
        t = item["tipo"]
        cod = item["codigo"]
        claves_snap.add((t, cod))
        seg = actuales.get((t, cod))
        if seg is None:
            por_crear.append(
                CatalogoSegmento(
                    organizacion_id=org_id,
                    tipo=t,
                    codigo=cod,
                    nombre=item["nombre"][:120],
                    codigo_shell=(item.get("codigo_shell") or "")[:40],
                    orden=int(item.get("orden") or 0),
                    activo=bool(item.get("activo", True)),
                )
            )
            restaurados += 1
        else:
            cambio = (
                seg.nombre != item["nombre"][:120]
                or seg.codigo_shell != (item.get("codigo_shell") or "")[:40]
                or seg.orden != int(item.get("orden") or 0)
                or seg.activo != bool(item.get("activo", True))
            )
            if cambio:
                seg.nombre = item["nombre"][:120]
                seg.codigo_shell = (item.get("codigo_shell") or "")[:40]
                seg.orden = int(item.get("orden") or 0)
                seg.activo = bool(item.get("activo", True))
                por_actualizar.append(seg)
                restaurados += 1

    # Segmentos creados después de la instantánea se desactivan (nunca se eliminan).
    for clave, seg in actuales.items():
        if clave not in claves_snap and seg.activo:
            seg.activo = False
            por_actualizar.append(seg)
            restaurados += 1

    if por_crear:
        CatalogoSegmento.objects.bulk_create(por_crear, ignore_conflicts=True)
    if por_actualizar:
        CatalogoSegmento.objects.bulk_update(por_actualizar, ["nombre", "codigo_shell", "orden", "activo"])

    registrar_cambio(
        objeto=respaldo_nuevo,
        accion="revertido",
        resumen=f"Catálogo restaurado al estado «{snap.descripcion}» ({restaurados} ajustes)",
        proyecto=snap.tipo_alcance,
        actor_persona_id=actor_persona_id,
        actor_nombre=actor_nombre,
        motivo=motivo or f"Restauración de instantánea #{snap.pk}",
    )
    _publicar_al_confirmar(org_id)
    return {"restaurados": restaurados, "respaldo_id": respaldo_nuevo.pk}


def listar_historial_segmentos(*, tipo: str = "", limite: int = 40) -> list[dict]:
    qs = RegistroHistorial.objects.filter(
        objeto_tipo__in=["catalogos.CatalogoSegmento", "catalogos.InstantaneaCatalogo"]
    )
    if tipo:
        qs = qs.filter(proyecto=tipo)
    if limite > 0:
        qs = qs[:limite]
    items = serializar_historial(qs)
    for item in items:
        if item["objeto_tipo"] == "catalogos.CatalogoSegmento":
            item["reversible"] = item["accion"] == "creado" or bool(item.get("cambios"))
            item["instantanea_id"] = None
        else:
            item["reversible"] = True
            try:
                item["instantanea_id"] = int(item["objeto_id"])
            except (TypeError, ValueError):
                item["instantanea_id"] = None
    return items


def listar_instantaneas(*, limite: int = 15) -> list[dict]:
    qs = InstantaneaCatalogo.objects.all()[:limite]
    return [
        {
            "id": s.pk,
            "descripcion": s.descripcion,
            "tipo_alcance": s.tipo_alcance,
            "total_segmentos": len(s.datos or []),
            "actor_nombre": s.actor_nombre or "Sistema",
            "creado_en": s.creado_en.isoformat(),
        }
        for s in qs
    ]


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

    if not isinstance(disciplina, str) or not isinstance(disciplina_shell, str):
        raise ErrorNegocio("La disciplina debe ser texto.", "datos-invalidos", 400)
    disc_cod = disciplina.strip().upper()
    disc_shell = disciplina_shell.strip().upper()
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

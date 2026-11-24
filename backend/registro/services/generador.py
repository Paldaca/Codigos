"""Motor atómico e idempotente de generación de códigos (manual y API, tarea 5.3)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.utils.timezone import now

from catalogos.services import (
    marcar_sigla_bloqueada,
    obtener_sigla_obligatoria,
    validar_y_resolver_segmentos,
)
from cereipo_sso.historial import calcular_cambios, capturar_estado, registrar_cambio
from cereipo_sso.organizacion import organizacion_actual
from core.exceptions import ErrorNegocio
from core.utils import formatear_codigo, texto_limpio

from registro.models import CodigoRegistro, ContadorSecuencia
from .correos import enviar_correo_nuevo_codigo

CAMPOS_HISTORIAL = ("estado", "origen", "codigo", "motivo", "motivo_anulacion")


@dataclass(frozen=True)
class _ItemNormalizado:
    indice: int
    clave_idempotencia: str
    referencia_externa: str
    proyecto_shell_codigo: str
    disciplina_shell_codigo: str
    motivo: str
    segmentos: dict[str, str]

    @property
    def llave_combinacion(self) -> tuple[str, str, str, str, str, str]:
        s = self.segmentos
        return (
            s["anio"],
            s["numero_proyecto"],
            s["subproyecto"],
            s["departamento"],
            s["disciplina"],
            s["tipo_documento"],
        )


def _bloquear_contador(llave: tuple[str, str, str, str, str, str]) -> ContadorSecuencia:
    filtros = {
        "anio": llave[0],
        "numero_proyecto": llave[1],
        "subproyecto": llave[2],
        "departamento": llave[3],
        "disciplina": llave[4],
        "tipo_documento": llave[5],
    }
    try:
        return ContadorSecuencia.objects.select_for_update().get(**filtros)
    except ContadorSecuencia.DoesNotExist:
        try:
            with transaction.atomic():
                ContadorSecuencia.objects.create(**filtros, ultimo_consecutivo=0)
        except IntegrityError:
            pass
        return ContadorSecuencia.objects.select_for_update().get(**filtros)


def _validar_items(items: list[dict], *, motivo_obligatorio: bool) -> list[_ItemNormalizado]:
    if not isinstance(items, list) or not items:
        raise ErrorNegocio("Debes enviar al menos un ítem para generar códigos.", "datos-invalidos", 400)
    if len(items) > 200:
        raise ErrorNegocio("El máximo por lote es de 200 códigos.", "datos-invalidos", 400)

    normalizados: list[_ItemNormalizado] = []
    claves_vistas: set[str] = set()
    for idx, crudo in enumerate(items):
        if not isinstance(crudo, dict):
            raise ErrorNegocio("Cada ítem debe ser un objeto.", "datos-invalidos", 400)
        if "empresa" in crudo or "sigla" in crudo:
            raise ErrorNegocio(
                "No se permite indicar empresa o sigla: la sigla se toma automáticamente de la organización.",
                "datos-invalidos",
                400,
            )
        motivo = texto_limpio(crudo.get("motivo"), 1000)
        if motivo_obligatorio and not motivo:
            raise ErrorNegocio(f"El motivo es obligatorio (ítem #{idx + 1}).", "datos-invalidos", 400)

        clave = texto_limpio(crudo.get("clave_idempotencia"), 128)
        if clave:
            if clave in claves_vistas:
                raise ErrorNegocio(f"Clave de idempotencia duplicada en el mismo lote: «{clave}».", "datos-invalidos", 400)
            claves_vistas.add(clave)

        seg = validar_y_resolver_segmentos(
            anio=crudo.get("anio", ""),
            numero_proyecto=crudo.get("numero_proyecto", ""),
            subproyecto=crudo.get("subproyecto", ""),
            departamento=crudo.get("departamento", ""),
            disciplina=crudo.get("disciplina", ""),
            disciplina_shell=crudo.get("disciplina_shell", ""),
            tipo_documento=crudo.get("tipo_documento", ""),
        )
        normalizados.append(
            _ItemNormalizado(
                indice=idx,
                clave_idempotencia=clave,
                referencia_externa=texto_limpio(crudo.get("referencia_externa"), 120),
                proyecto_shell_codigo=texto_limpio(crudo.get("proyecto_shell_codigo"), 40),
                disciplina_shell_codigo=seg["disciplina_shell"],
                motivo=motivo,
                segmentos=seg,
            )
        )
    return normalizados


def previsualizar_lote(items: list[dict]) -> dict:
    """Calcula vista previa sin adquirir bloqueos ni avanzar contadores."""
    sigla = obtener_sigla_obligatoria()
    normalizados = _validar_items(items, motivo_obligatorio=False)

    ultimos: dict[tuple[str, ...], int] = {}
    previews: list[dict] = []
    for item in normalizados:
        llave = item.llave_combinacion
        if llave not in ultimos:
            contador = ContadorSecuencia.objects.filter(
                anio=llave[0],
                numero_proyecto=llave[1],
                subproyecto=llave[2],
                departamento=llave[3],
                disciplina=llave[4],
                tipo_documento=llave[5],
            ).first()
            ultimos[llave] = contador.ultimo_consecutivo if contador else 0
        ultimos[llave] += 1
        consecutivo = ultimos[llave]
        s = item.segmentos
        codigo = formatear_codigo(
            sigla=sigla,
            anio=s["anio"],
            numero_proyecto=s["numero_proyecto"],
            subproyecto=s["subproyecto"],
            departamento=s["departamento"],
            disciplina=s["disciplina"],
            tipo_documento=s["tipo_documento"],
            consecutivo=consecutivo,
        )
        previews.append(
            {
                "codigo_tentativo": codigo,
                "consecutivo_tentativo": consecutivo,
                "sigla": sigla,
                **s,
            }
        )
    return {"sigla": sigla, "previsualizaciones": previews}


def _serializar_resultado(reg: CodigoRegistro, *, repetido: bool = False) -> dict:
    return {
        "id": str(reg.id),
        "clave_idempotencia": reg.clave_idempotencia,
        "referencia_externa": reg.referencia_externa,
        "codigo": reg.codigo,
        "sigla": reg.sigla,
        "anio": reg.anio,
        "numero_proyecto": reg.numero_proyecto,
        "subproyecto": reg.subproyecto,
        "departamento": reg.departamento,
        "disciplina": reg.disciplina,
        "tipo_documento": reg.tipo_documento,
        "consecutivo": reg.consecutivo,
        "estado": reg.estado,
        "origen": reg.origen,
        "repetido": repetido,
    }


@transaction.atomic
def reservar_o_generar_lote(
    *,
    items: list[dict],
    actor_persona_id: str = "",
    actor_nombre: str = "",
    origen: str = CodigoRegistro.Origen.MANUAL,
    app_origen: str = "",
    confirmar_inmediato: bool = True,
) -> dict:
    """Asigna consecutivos atómicamente con idempotencia estricta (manual y servicio D-16)."""
    org_id = organizacion_actual()
    if not org_id or org_id == "*":
        raise ErrorNegocio("No hay una organización activa.", "sin-organizacion", 400)

    sigla = obtener_sigla_obligatoria()
    normalizados = _validar_items(items, motivo_obligatorio=True)

    claves = [i.clave_idempotencia for i in normalizados if i.clave_idempotencia]
    previos_por_clave: dict[str, CodigoRegistro] = {}
    if claves:
        for reg in CodigoRegistro.objects.select_for_update().filter(
            origen=origen,
            clave_idempotencia__in=claves,
        ):
            previos_por_clave[reg.clave_idempotencia] = reg

    resultados: dict[int, dict] = {}
    grupos_nuevos: dict[tuple[str, ...], list[_ItemNormalizado]] = defaultdict(list)

    for item in normalizados:
        previo = previos_por_clave.get(item.clave_idempotencia) if item.clave_idempotencia else None
        if previo is not None:
            llave_previa = (
                previo.anio,
                previo.numero_proyecto,
                previo.subproyecto,
                previo.departamento,
                previo.disciplina,
                previo.tipo_documento,
            )
            if llave_previa != item.llave_combinacion:
                raise ErrorNegocio(
                    f"La clave de idempotencia «{item.clave_idempotencia}» ya fue usada con otros segmentos.",
                    "conflicto-idempotencia",
                    409,
                )
            resultados[item.indice] = _serializar_resultado(previo, repetido=True)
        else:
            grupos_nuevos[item.llave_combinacion].append(item)

    estado_inicial = CodigoRegistro.Estado.CONFIRMADO if confirmar_inmediato else CodigoRegistro.Estado.RESERVADO
    ahora = now()
    nuevos_para_correo: list[CodigoRegistro] = []

    # Orden determinista de llaves evita deadlocks entre transacciones concurrentes.
    for llave in sorted(grupos_nuevos.keys()):
        contador = _bloquear_contador(llave)
        items_grupo = grupos_nuevos[llave]
        for item in items_grupo:
            contador.ultimo_consecutivo += 1
            consecutivo = contador.ultimo_consecutivo
            s = item.segmentos
            codigo = formatear_codigo(
                sigla=sigla,
                anio=s["anio"],
                numero_proyecto=s["numero_proyecto"],
                subproyecto=s["subproyecto"],
                departamento=s["departamento"],
                disciplina=s["disciplina"],
                tipo_documento=s["tipo_documento"],
                consecutivo=consecutivo,
            )
            reg = CodigoRegistro.objects.create(
                sigla=sigla,
                anio=s["anio"],
                numero_proyecto=s["numero_proyecto"],
                subproyecto=s["subproyecto"],
                departamento=s["departamento"],
                disciplina=s["disciplina"],
                tipo_documento=s["tipo_documento"],
                consecutivo=consecutivo,
                codigo=codigo,
                estado=estado_inicial,
                origen=origen,
                app_origen=app_origen[:40],
                clave_idempotencia=item.clave_idempotencia,
                referencia_externa=item.referencia_externa,
                proyecto_shell_codigo=item.proyecto_shell_codigo,
                disciplina_shell_codigo=item.disciplina_shell_codigo,
                motivo=item.motivo,
                creado_por_persona_id=str(actor_persona_id or "")[:64],
                creado_por_nombre=texto_limpio(actor_nombre, 200),
                fecha_confirmacion=ahora if confirmar_inmediato else None,
            )
            registrar_cambio(
                objeto=reg,
                accion="creado",
                actor_persona_id=actor_persona_id,
                actor_nombre=actor_nombre,
                cambios=calcular_cambios({}, capturar_estado(reg, CAMPOS_HISTORIAL)),
                motivo=item.motivo,
            )
            resultados[item.indice] = _serializar_resultado(reg, repetido=False)
            nuevos_para_correo.append(reg)
        contador.save(update_fields=["ultimo_consecutivo"])

    if nuevos_para_correo:
        marcar_sigla_bloqueada()

    advertencia_correo = None
    if confirmar_inmediato and origen == CodigoRegistro.Origen.MANUAL and len(nuevos_para_correo) == 1:
        reg_correo = nuevos_para_correo[0]
        advertencia_correo = enviar_correo_nuevo_codigo(
            codigo=reg_correo.codigo,
            motivo=reg_correo.motivo,
            actor_nombre=actor_nombre,
        )

    lista_ordenada = [resultados[i] for i in range(len(normalizados))]
    return {
        "resultados": lista_ordenada,
        "advertencia_correo": advertencia_correo,
    }


@transaction.atomic
def confirmar_lote(
    *,
    codigos: list[str] | None = None,
    claves_idempotencia: list[str] | None = None,
    actor_persona_id: str = "",
    actor_nombre: str = "",
) -> list[dict]:
    cods = [str(c).strip() for c in (codigos or []) if str(c).strip()]
    claves = [str(k).strip() for k in (claves_idempotencia or []) if str(k).strip()]
    if not cods and not claves:
        raise ErrorNegocio("Indica códigos o claves de idempotencia a confirmar.", "datos-invalidos", 400)

    qs = CodigoRegistro.objects.select_for_update()
    if cods:
        qs = qs.filter(codigo__in=cods)
    else:
        qs = qs.filter(clave_idempotencia__in=claves)

    encontrados = list(qs)
    esperados = set(cods or claves)
    hallados = {r.codigo if cods else r.clave_idempotencia for r in encontrados}
    faltantes = sorted(esperados - hallados)
    if faltantes:
        raise ErrorNegocio(f"Códigos no encontrados: {', '.join(faltantes)}", "no-encontrado", 404)

    ahora = now()
    salida: list[dict] = []
    for reg in encontrados:
        if reg.estado == CodigoRegistro.Estado.ANULADO:
            raise ErrorNegocio(
                f"El código {reg.codigo} ya está anulado y no puede confirmarse.",
                "estado-invalido",
                409,
            )
        repetido = reg.estado == CodigoRegistro.Estado.CONFIRMADO
        if not repetido:
            antes = capturar_estado(reg, CAMPOS_HISTORIAL)
            reg.estado = CodigoRegistro.Estado.CONFIRMADO
            reg.fecha_confirmacion = ahora
            reg.save(update_fields=["estado", "fecha_confirmacion"])
            registrar_cambio(
                objeto=reg,
                accion="confirmado",
                actor_persona_id=actor_persona_id,
                actor_nombre=actor_nombre,
                cambios=calcular_cambios(antes, capturar_estado(reg, CAMPOS_HISTORIAL)),
            )
        salida.append(_serializar_resultado(reg, repetido=repetido))
    return salida

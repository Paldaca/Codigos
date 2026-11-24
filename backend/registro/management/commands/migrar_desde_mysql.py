"""Migración verificada de historial desde MySQL de PALDACA (tarea 5.7).

Cada `Empresa` de `codigos_empresa` se migra a su propia `Organizacion` de
Cereipo Shell (aislada por `organizacion_id` + RLS), preservando códigos,
consecutivos, anulaciones y solicitudes, e inicializando `ContadorSecuencia`
en `MAX(consecutivo)` para evitar colisiones futuras.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlsplit

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count, Max
from django.utils.timezone import is_naive, make_aware

from catalogos.services import (
    asegurar_segmentos_migrados,
    configurar_migracion_organizacion,
    sembrar_catalogos_estandar,
)
from cereipo_sso.organizacion import con_organizacion
from registro.models import CodigoRegistro, ContadorSecuencia, SolicitudAnulacion


def _fecha_con_tz(valor):
    if valor is None:
        return None
    if isinstance(valor, str):
        from django.utils.dateparse import parse_datetime

        valor = parse_datetime(valor)
        if valor is None:
            return None
    return make_aware(valor) if is_naive(valor) else valor


def _leer_desde_mysql(mysql_url: str) -> dict:
    import pymysql

    partes = urlsplit(mysql_url)
    conn = pymysql.connect(
        host=partes.hostname or "127.0.0.1",
        port=partes.port or 3306,
        user=unquote(partes.username or ""),
        password=unquote(partes.password or ""),
        database=(partes.path or "").lstrip("/"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, sigla, nombre, correo_notificacion FROM codigos_empresa")
            empresas = list(cur.fetchall())
            cur.execute(
                """
                SELECT id, empresa_id, `año` AS anio, numero_proyecto, subproyecto,
                       departamento, disciplina, tipo_documento, consecutivo, codigo,
                       motivo, fecha_creacion, usuario_id, anulado, usuario_anulacion_id,
                       fecha_anulacion
                FROM codigos_codigo_generado
                ORDER BY id ASC
                """
            )
            codigos = list(cur.fetchall())
            cur.execute(
                """
                SELECT id, codigo_id, solicitante_id, motivo, fecha_solicitud, procesada
                FROM codigos_solicitud_anulacion
                ORDER BY id ASC
                """
            )
            solicitudes = list(cur.fetchall())
        return {"empresas": empresas, "codigos": codigos, "solicitudes": solicitudes}
    finally:
        conn.close()


def migrar_datos_por_empresa(
    *,
    datos: dict,
    mapa_empresas_org: dict[str, str],
    mapa_usuarios: dict[str, dict] | None = None,
    dry_run: bool = False,
) -> dict[str, dict[str, int]]:
    mapa_usuarios = mapa_usuarios or {}
    empresas_por_id = {e["id"]: e for e in datos.get("empresas", [])}
    codigos_por_empresa: dict[int, list[dict]] = defaultdict(list)
    solicitudes_por_codigo: dict[int, list[dict]] = defaultdict(list)

    for c in datos.get("codigos", []):
        codigos_por_empresa[c["empresa_id"]].append(c)
    for s in datos.get("solicitudes", []):
        solicitudes_por_codigo[s["codigo_id"]].append(s)

    resumen: dict[str, dict[str, int]] = {}

    for emp_id, emp in empresas_por_id.items():
        sigla = str(emp["sigla"]).strip().upper()
        if sigla not in mapa_empresas_org:
            continue
        org_id = str(mapa_empresas_org[sigla]).strip()
        cods_emp = codigos_por_empresa.get(emp_id, [])

        def _usuario_info(uid) -> tuple[str, str]:
            if uid is None:
                return "", ""
            info = mapa_usuarios.get(str(uid)) or {}
            return str(info.get("persona_id") or f"legacy:{uid}"), str(info.get("nombre") or f"Usuario legado #{uid}")

        with con_organizacion(org_id):
            sembrar_catalogos_estandar()
            configurar_migracion_organizacion(
                organizacion_id=org_id,
                sigla=sigla,
                correo_notificacion=emp.get("correo_notificacion") or "",
                bloquear_sigla=len(cods_emp) > 0,
            )

            mapa_codigo_obj: dict[int, CodigoRegistro] = {}
            maximos: dict[tuple[str, str, str, str, str, str], int] = defaultdict(int)
            pares_historicos: list[tuple[str, str]] = []
            for c in cods_emp:
                pares_historicos.extend([
                    ("proyecto", str(c["numero_proyecto"]).strip().upper()),
                    ("subproyecto", str(c["subproyecto"]).strip().upper()),
                    ("departamento", str(c["departamento"]).strip().upper()),
                    ("disciplina", str(c["disciplina"]).strip().upper()),
                    ("tipo_documento", str(c["tipo_documento"]).strip().upper()),
                ])
            asegurar_segmentos_migrados(org_id, pares_historicos)

            codigos_existentes = set(CodigoRegistro.objects.values_list("codigo", flat=True))
            nuevos_codigos = 0
            for c in cods_emp:
                cod_str = str(c["codigo"]).strip()
                if cod_str in codigos_existentes:
                    reg = CodigoRegistro.objects.get(codigo=cod_str)
                else:
                    creador_id, creador_nom = _usuario_info(c.get("usuario_id"))
                    anul_id, anul_nom = _usuario_info(c.get("usuario_anulacion_id"))
                    anulado = bool(c.get("anulado"))
                    fecha_crea = _fecha_con_tz(c.get("fecha_creacion"))
                    fecha_anul = _fecha_con_tz(c.get("fecha_anulacion"))
                    reg = CodigoRegistro.objects.create(
                        sigla=sigla,
                        anio=str(c["anio"]).strip(),
                        numero_proyecto=str(c["numero_proyecto"]).strip().upper(),
                        subproyecto=str(c["subproyecto"]).strip().upper(),
                        departamento=str(c["departamento"]).strip().upper(),
                        disciplina=str(c["disciplina"]).strip().upper(),
                        tipo_documento=str(c["tipo_documento"]).strip().upper(),
                        consecutivo=int(c["consecutivo"]),
                        codigo=cod_str,
                        estado=CodigoRegistro.Estado.ANULADO if anulado else CodigoRegistro.Estado.CONFIRMADO,
                        origen=CodigoRegistro.Origen.MANUAL,
                        motivo=c.get("motivo") or "Migrado desde PALDACA",
                        creado_por_persona_id=creador_id,
                        creado_por_nombre=creador_nom,
                        anulado_por_persona_id=anul_id if anulado else "",
                        anulado_por_nombre=anul_nom if anulado else "",
                        fecha_creacion=fecha_crea,
                        fecha_confirmacion=fecha_crea,
                        fecha_anulacion=fecha_anul if anulado else None,
                    )
                    codigos_existentes.add(cod_str)
                    nuevos_codigos += 1
                mapa_codigo_obj[c["id"]] = reg
                llave = (
                    reg.anio,
                    reg.numero_proyecto,
                    reg.subproyecto,
                    reg.departamento,
                    reg.disciplina,
                    reg.tipo_documento,
                )
                if reg.consecutivo > maximos[llave]:
                    maximos[llave] = reg.consecutivo

            sols_migradas = 0
            for legacy_id, reg in mapa_codigo_obj.items():
                for s in solicitudes_por_codigo.get(legacy_id, []):
                    sol_id, sol_nom = _usuario_info(s.get("solicitante_id"))
                    procesada = bool(s.get("procesada"))
                    estado_sol = (
                        SolicitudAnulacion.Estado.APROBADA
                        if procesada and reg.estado == CodigoRegistro.Estado.ANULADO
                        else (SolicitudAnulacion.Estado.RECHAZADA if procesada else SolicitudAnulacion.Estado.PENDIENTE)
                    )
                    SolicitudAnulacion.objects.create(
                        codigo_registro=reg,
                        solicitante_persona_id=sol_id or "legacy:0",
                        solicitante_nombre=sol_nom or "Usuario legado",
                        motivo=s.get("motivo") or "Migrada desde PALDACA",
                        estado=estado_sol,
                        fecha_solicitud=_fecha_con_tz(s.get("fecha_solicitud")),
                    )
                    sols_migradas += 1

            for llave, max_cons in maximos.items():
                contador, _ = ContadorSecuencia.objects.get_or_create(
                    anio=llave[0],
                    numero_proyecto=llave[1],
                    subproyecto=llave[2],
                    departamento=llave[3],
                    disciplina=llave[4],
                    tipo_documento=llave[5],
                    defaults={"ultimo_consecutivo": max_cons},
                )
                if contador.ultimo_consecutivo < max_cons:
                    contador.ultimo_consecutivo = max_cons
                    contador.save(update_fields=["ultimo_consecutivo"])

            # Verificación obligatoria (tarea 5.7): conteos y cero duplicados.
            total_destino = CodigoRegistro.objects.count()
            duplicados = list(CodigoRegistro.objects.values("codigo").annotate(n=Count("id")).filter(n__gt=1))
            if duplicados:
                raise CommandError(f"Se detectaron códigos duplicados tras migrar {sigla}: {duplicados}")
            if total_destino < len(cods_emp):
                raise CommandError(f"Faltaron códigos al migrar {sigla}: origen={len(cods_emp)}, destino={total_destino}")

            max_real = CodigoRegistro.objects.aggregate(m=Max("consecutivo"))["m"] or 0
            if max_real and not ContadorSecuencia.objects.exists():
                raise CommandError(f"No se inicializaron los contadores para {sigla}.")

            resumen[sigla] = {
                "organizacion_id": org_id,
                "origen_codigos": len(cods_emp),
                "nuevos_codigos": nuevos_codigos,
                "total_destino": total_destino,
                "solicitudes_migradas": sols_migradas,
            }
            if dry_run:
                transaction.set_rollback(True)
    return resumen


class Command(BaseCommand):
    help = "Migra empresas, códigos, solicitudes y contadores desde MySQL de PALDACA (tarea 5.7)."

    def add_arguments(self, parser):
        parser.add_argument("--mysql-url", help="mysql://usuario:clave@host:puerto/base")
        parser.add_argument("--desde-json", help="Archivo JSON alternativo para pruebas sin MySQL")
        parser.add_argument("--empresa-sigla", help="Sigla de la empresa en MySQL a migrar (ej. PAL)")
        parser.add_argument("--organizacion-id", help="UUID/ID de la organización destino en Cereipo Shell")
        parser.add_argument("--mapa-empresas-org", help="Archivo JSON con mapa {sigla: organizacion_id}")
        parser.add_argument("--mapa-usuarios", help="Archivo JSON opcional {mysql_user_id: {persona_id, nombre}}")
        parser.add_argument("--dry-run", action="store_true", help="Ejecuta todo, verifica y revierte al final")

    def handle(self, *args, **opts):
        if opts.get("desde_json"):
            datos = json.loads(Path(opts["desde_json"]).read_text(encoding="utf-8"))
        elif opts.get("mysql_url"):
            datos = _leer_desde_mysql(opts["mysql_url"])
        else:
            raise CommandError("Debes indicar --mysql-url o --desde-json.")

        mapa_empresas: dict[str, str] = {}
        if opts.get("mapa_empresas_org"):
            raw = json.loads(Path(opts["mapa_empresas_org"]).read_text(encoding="utf-8"))
            mapa_empresas = {str(k).strip().upper(): str(v).strip() for k, v in raw.items()}
        elif opts.get("empresa_sigla") and opts.get("organizacion_id"):
            mapa_empresas = {opts["empresa_sigla"].strip().upper(): opts["organizacion_id"].strip()}
        else:
            raise CommandError("Indica --mapa-empresas-org o el par --empresa-sigla + --organizacion-id.")

        mapa_usuarios = {}
        if opts.get("mapa_usuarios"):
            mapa_usuarios = json.loads(Path(opts["mapa_usuarios"]).read_text(encoding="utf-8"))

        resumen = migrar_datos_por_empresa(
            datos=datos,
            mapa_empresas_org=mapa_empresas,
            mapa_usuarios=mapa_usuarios,
            dry_run=bool(opts.get("dry_run")),
        )
        self.stdout.write(self.style.SUCCESS(json.dumps(resumen, ensure_ascii=False, indent=2)))

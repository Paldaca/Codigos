"""Pruebas del motor de generación, concurrencia, anulaciones y migración MySQL."""

from __future__ import annotations

import json
import threading
from unittest import mock

from django.core.cache import cache
from django.db import connections
from django.test import TestCase, TransactionTestCase, override_settings

from catalogos.services import guardar_configuracion, sembrar_catalogos_estandar
from cereipo_sso.historial import historial_de
from cereipo_sso.organizacion import con_organizacion
from cereipo_sso.pruebas import payload_de_ejemplo, shell_simulado
from core.exceptions import ErrorNegocio
from registro.management.commands.migrar_desde_mysql import migrar_datos_por_empresa
from registro.models import CodigoRegistro, ContadorSecuencia
from registro.services import (
    anular_codigo_directo,
    confirmar_lote,
    crear_solicitud_anulacion,
    previsualizar_lote,
    reservar_o_generar_lote,
    resolver_solicitud_anulacion,
)

MEMORIA = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
COOKIE = "cereipo_shell_sesion"


def _item_base(**extra):
    base = {
        "anio": "2026",
        "numero_proyecto": "14",
        "subproyecto": "A",
        "departamento": "IN",
        "disciplina": "C",
        "tipo_documento": "PLA",
        "motivo": "Plano de cimentación",
    }
    base.update(extra)
    return base


def _payload(org_id: str, permisos: list[str], persona_id: str = "10"):
    return payload_de_ejemplo(
        persona={"id": persona_id, "nombres": "Ana", "apellidos": "Soto", "area": None, "cargo": None, "disciplinas": ["CIV"]},
        organizacion={"id": org_id, "codigo": f"org-{org_id}", "nombre": f"Org {org_id}", "zona_horaria": "UTC"},
        aplicacion={
            "codigo": "codigos",
            "rol": "administrador",
            "permisos": permisos,
            "disciplinas": "*",
            "areas": [],
            "roles": {"administrador": {"permisos": permisos, "alcance_disciplina": "todas"}},
        },
        proyectos=[],
    )


@override_settings(CEREIPO_SSO_ACTIVO=True, CACHES=MEMORIA)
class GeneradorYAnulacionesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.patch_sync = mock.patch("integracion.services.maestros.sincronizar_maestro", return_value={"creados": 1})
        self.patch_sync.start()
        self.addCleanup(self.patch_sync.stop)

        with con_organizacion("100"):
            guardar_configuracion(sigla="PAL", actor_persona_id="10", actor_nombre="Ana")
            sembrar_catalogos_estandar()
        with con_organizacion("200"):
            guardar_configuracion(sigla="ORI", actor_persona_id="20", actor_nombre="Luis")
            sembrar_catalogos_estandar()

    def test_preview_no_avanza_contador_y_sigla_viene_de_org(self):
        with con_organizacion("100"):
            prev = previsualizar_lote([_item_base(), _item_base()])
            self.assertEqual(prev["sigla"], "PAL")
            self.assertEqual(
                [p["codigo_tentativo"] for p in prev["previsualizaciones"]],
                ["PAL-26-14-A-IN-C-PLA-001", "PAL-26-14-A-IN-C-PLA-002"],
            )
            self.assertEqual(ContadorSecuencia.objects.count(), 0)

            res = reservar_o_generar_lote(
                items=[_item_base(clave_idempotencia="k1")],
                actor_persona_id="10",
                actor_nombre="Ana",
            )
            self.assertEqual(res["resultados"][0]["codigo"], "PAL-26-14-A-IN-C-PLA-001")

        # Org 200 genera con su propia sigla ORI y su propio contador desde 001.
        with con_organizacion("200"):
            res2 = reservar_o_generar_lote(
                items=[_item_base(clave_idempotencia="k1")],
                actor_persona_id="20",
                actor_nombre="Luis",
            )
            self.assertEqual(res2["resultados"][0]["codigo"], "ORI-26-14-A-IN-C-PLA-001")

    def test_rechaza_empresa_o_sigla_en_payload(self):
        with con_organizacion("100"):
            with self.assertRaises(ErrorNegocio) as exc:
                reservar_o_generar_lote(items=[_item_base(sigla="AJENA")], actor_persona_id="10")
            self.assertEqual(exc.exception.estado_http, 400)

    def test_idempotencia_y_conflicto_409(self):
        with con_organizacion("100"):
            r1 = reservar_o_generar_lote(
                items=[_item_base(clave_idempotencia="req-1")],
                actor_persona_id="10",
                origen="api",
                confirmar_inmediato=False,
            )
            self.assertFalse(r1["resultados"][0]["repetido"])
            self.assertEqual(r1["resultados"][0]["estado"], "reservado")

            r2 = reservar_o_generar_lote(
                items=[_item_base(clave_idempotencia="req-1")],
                actor_persona_id="10",
                origen="api",
                confirmar_inmediato=False,
            )
            self.assertTrue(r2["resultados"][0]["repetido"])
            self.assertEqual(r2["resultados"][0]["codigo"], r1["resultados"][0]["codigo"])

            with self.assertRaises(ErrorNegocio) as exc:
                reservar_o_generar_lote(
                    items=[_item_base(clave_idempotencia="req-1", tipo_documento="DOC")],
                    actor_persona_id="10",
                    origen="api",
                    confirmar_inmediato=False,
                )
            self.assertEqual(exc.exception.estado_http, 409)

            # Confirmar código reservado y verificar historial.
            conf = confirmar_lote(codigos=[r1["resultados"][0]["codigo"]], actor_persona_id="10", actor_nombre="Ana")
            self.assertEqual(conf[0]["estado"], "confirmado")
            reg = CodigoRegistro.objects.get(codigo=conf[0]["codigo"])
            self.assertEqual(historial_de(objeto=reg).count(), 2)

    def test_anulacion_no_reutiliza_consecutivo_y_flujo_solicitud(self):
        with con_organizacion("100"):
            r = reservar_o_generar_lote(items=[_item_base()], actor_persona_id="10", actor_nombre="Ana")
            cod_id = r["resultados"][0]["id"]
            sol = crear_solicitud_anulacion(
                codigo_id=cod_id,
                motivo="Duplicado en plano",
                solicitante_persona_id="99",
                solicitante_nombre="Carlos",
            )
            with self.assertRaises(ErrorNegocio):
                crear_solicitud_anulacion(
                    codigo_id=cod_id,
                    motivo="Otra",
                    solicitante_persona_id="99",
                    solicitante_nombre="Carlos",
                )
            resolver_solicitud_anulacion(
                solicitud_id=sol.pk,
                accion="aprobar",
                actor_persona_id="10",
                actor_nombre="Ana",
            )
            # Siguiente código debe ser 002 (001 anulado jamás se reutiliza).
            r2 = reservar_o_generar_lote(items=[_item_base()], actor_persona_id="10", actor_nombre="Ana")
            self.assertEqual(r2["resultados"][0]["codigo"], "PAL-26-14-A-IN-C-PLA-002")

            # Anulación directa por el creador.
            anular_codigo_directo(
                codigo_id=r2["resultados"][0]["id"],
                motivo="Cancelado por cambio de alcance",
                actor_persona_id="10",
                actor_nombre="Ana",
                es_aprobador=False,
            )
            self.assertEqual(CodigoRegistro.objects.get(pk=r2["resultados"][0]["id"]).estado, "anulado")

    def test_endpoints_manuales_http(self):
        permisos = ["codigos:inicio:ver", "codigos:registro:ver", "codigos:codigos:generar", "codigos:codigos:anular"]
        with shell_simulado(_payload("100", permisos)):
            self.client.cookies[COOKIE] = "s100"
            r_prev = self.client.post(
                "/api/registro/previsualizar/",
                data=json.dumps(_item_base()),
                content_type="application/json",
            )
            self.assertEqual(r_prev.status_code, 200)
            self.assertEqual(r_prev.json()["previsualizaciones"][0]["codigo_tentativo"], "PAL-26-14-A-IN-C-PLA-001")

            r_gen = self.client.post(
                "/api/registro/generar/",
                data=json.dumps(_item_base()),
                content_type="application/json",
            )
            self.assertEqual(r_gen.status_code, 201)
            self.assertEqual(r_gen.json()["resultados"][0]["codigo"], "PAL-26-14-A-IN-C-PLA-001")

            r_list = self.client.get("/api/registro/codigos/")
            self.assertEqual(r_list.status_code, 200)
            self.assertEqual(r_list.json()["total"], 1)

    def test_migracion_mysql_por_empresa_y_continuidad_contador(self):
        datos = {
            "empresas": [
                {"id": 1, "sigla": "PAL", "nombre": "Paldaca", "correo_notificacion": "a@pal.test"},
                {"id": 2, "sigla": "SSAPI", "nombre": "SSAPI", "correo_notificacion": ""},
            ],
            "codigos": [
                {
                    "id": 10, "empresa_id": 1, "anio": "2025", "numero_proyecto": "14",
                    "subproyecto": "A", "departamento": "IN", "disciplina": "C",
                    "tipo_documento": "PLA", "consecutivo": 1, "codigo": "PAL-25-14-A-IN-C-PLA-001",
                    "motivo": "Histórico 1", "fecha_creacion": "2025-05-01T10:00:00",
                    "usuario_id": 5, "anulado": 0, "usuario_anulacion_id": None, "fecha_anulacion": None,
                },
                {
                    "id": 11, "empresa_id": 1, "anio": "2025", "numero_proyecto": "14",
                    "subproyecto": "A", "departamento": "IN", "disciplina": "C",
                    "tipo_documento": "PLA", "consecutivo": 2, "codigo": "PAL-25-14-A-IN-C-PLA-002",
                    "motivo": "Histórico 2", "fecha_creacion": "2025-05-02T10:00:00",
                    "usuario_id": 5, "anulado": 1, "usuario_anulacion_id": 5, "fecha_anulacion": "2025-05-03T10:00:00",
                },
                {
                    "id": 12, "empresa_id": 2, "anio": "2025", "numero_proyecto": "01",
                    "subproyecto": "0", "departamento": "GG", "disciplina": "G",
                    "tipo_documento": "INF", "consecutivo": 1, "codigo": "SSAPI-25-01-0-GG-G-INF-001",
                    "motivo": "Histórico SSAPI", "fecha_creacion": "2025-05-04T10:00:00",
                    "usuario_id": 9, "anulado": 0, "usuario_anulacion_id": None, "fecha_anulacion": None,
                },
            ],
            "solicitudes": [
                {"id": 1, "codigo_id": 11, "solicitante_id": 5, "motivo": "Error", "fecha_solicitud": "2025-05-03T09:00:00", "procesada": 1},
            ],
        }
        resumen = migrar_datos_por_empresa(
            datos=datos,
            mapa_empresas_org={"PAL": "org-pal-1", "SSAPI": "org-ssapi-2"},
            mapa_usuarios={"5": {"persona_id": "p-5", "nombre": "Ana"}},
        )
        self.assertEqual(resumen["PAL"]["origen_codigos"], 2)
        self.assertEqual(resumen["SSAPI"]["origen_codigos"], 1)

        with con_organizacion("org-pal-1"):
            sig = reservar_o_generar_lote(
                items=[_item_base(anio="2025")],
                actor_persona_id="p-5",
                actor_nombre="Ana",
            )
            self.assertEqual(sig["resultados"][0]["codigo"], "PAL-25-14-A-IN-C-PLA-003")


class ConcurrenciaContadorTests(TransactionTestCase):
    def setUp(self):
        with mock.patch("integracion.services.maestros.sincronizar_maestro", return_value={"creados": 1}):
            with con_organizacion("300"):
                guardar_configuracion(sigla="CONC", actor_persona_id="1", actor_nombre="Test")
                sembrar_catalogos_estandar()

    def test_reservas_concurrentes_en_postgresql_sin_duplicados(self):
        errores: list[Exception] = []
        asignados: list[str] = []
        candado = threading.Lock()

        def trabajador(idx: int):
            try:
                with con_organizacion("300"):
                    res = reservar_o_generar_lote(
                        items=[_item_base(motivo=f"Hilo {idx}")],
                        actor_persona_id=str(idx),
                        actor_nombre=f"User {idx}",
                    )
                    with candado:
                        asignados.append(res["resultados"][0]["codigo"])
            except Exception as exc:
                with candado:
                    errores.append(exc)
            finally:
                connections.close_all()

        hilos = [threading.Thread(target=trabajador, args=(i,)) for i in range(6)]
        for h in hilos:
            h.start()
        for h in hilos:
            h.join()

        self.assertEqual(errores, [])
        self.assertEqual(len(asignados), 6)
        self.assertEqual(len(set(asignados)), 6)
        self.assertEqual(
            sorted(asignados),
            [f"CONC-26-14-A-IN-C-PLA-{n:03d}" for n in range(1, 7)],
        )

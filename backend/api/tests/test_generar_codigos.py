"""Pruebas del contrato v1 y seguridad del servicio declarado `generar-codigos` (D-16)."""

from __future__ import annotations

import json
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings

from catalogos.services import guardar_configuracion, sembrar_catalogos_estandar
from cereipo_sso.firma import cabeceras_servicio
from cereipo_sso.organizacion import con_organizacion
from cereipo_sso.pruebas import servicio_simulado

MEMORIA = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
SECRETO_SERVICIO = "secreto-doc-codigos-prueba"


@override_settings(
    CEREIPO_APP_CODIGO="codigos",
    CEREIPO_APP_SECRETO="secreto-codigos",
    CEREIPO_SHELL_API_URL="http://shell.prueba",
    CACHES=MEMORIA,
)
class ApiServicioGenerarCodigosTests(TestCase):
    def setUp(self):
        cache.clear()
        self.patch_sync = mock.patch("integracion.services.maestros.sincronizar_maestro", return_value={"creados": 1})
        self.patch_sync.start()
        self.addCleanup(self.patch_sync.stop)

        with con_organizacion("100"):
            guardar_configuracion(sigla="PAL", actor_persona_id="10", actor_nombre="Ana")
            sembrar_catalogos_estandar()

        self.auths = {
            "servicios": {
                "generar-codigos": {
                    "documentos": {
                        "secretos": [SECRETO_SERVICIO],
                        "organizaciones": ["100"],
                    }
                }
            }
        }

    def _post_firmado(self, ruta: str, payload: dict, org_id: str = "100", secreto: str = SECRETO_SERVICIO):
        cuerpo = json.dumps(payload).encode()
        headers = cabeceras_servicio("documentos", "generar-codigos", secreto, "POST", ruta, org_id, cuerpo)
        return self.client.post(
            ruta,
            data=cuerpo,
            content_type="application/json",
            **{f"HTTP_{k.upper().replace('-', '_')}": v for k, v in headers.items()},
        )

    def _get_firmado(self, ruta: str, org_id: str = "100", secreto: str = SECRETO_SERVICIO):
        headers = cabeceras_servicio("documentos", "generar-codigos", secreto, "GET", ruta, org_id)
        return self.client.get(
            ruta,
            **{f"HTTP_{k.upper().replace('-', '_')}": v for k, v in headers.items()},
        )

    def test_flujo_completo_reservar_confirmar_consultar_anular(self):
        with servicio_simulado(self.auths):
            r_cat = self._get_firmado("/api/servicios/generar-codigos/catalogos/")
            self.assertEqual(r_cat.status_code, 200)
            self.assertEqual(r_cat.json()["sigla"], "PAL")

            r_res = self._post_firmado(
                "/api/servicios/generar-codigos/reservar/",
                {
                    "v": 1,
                    "actor_persona_id": "10",
                    "actor_nombre": "Ana",
                    "items": [
                        {
                            "clave_idempotencia": "lm-1",
                            "referencia_externa": "prod-1",
                            "anio": "2026",
                            "numero_proyecto": "14",
                            "subproyecto": "A",
                            "departamento": "IN",
                            "disciplina_shell": "CIV",
                            "tipo_documento": "PLA",
                            "motivo": "Alta lista maestra",
                        }
                    ],
                },
            )
            self.assertEqual(r_res.status_code, 201)
            codigo = r_res.json()["resultados"][0]["codigo"]
            self.assertEqual(codigo, "PAL-26-14-A-IN-C-PLA-001")

            # Repetición idempotente responde 200 con repetido=True.
            r_rep = self._post_firmado(
                "/api/servicios/generar-codigos/reservar/",
                {
                    "v": 1,
                    "actor_persona_id": "10",
                    "items": [
                        {
                            "clave_idempotencia": "lm-1",
                            "referencia_externa": "prod-1",
                            "anio": "2026",
                            "numero_proyecto": "14",
                            "subproyecto": "A",
                            "departamento": "IN",
                            "disciplina": "C",
                            "tipo_documento": "PLA",
                            "motivo": "Alta lista maestra",
                        }
                    ],
                },
            )
            self.assertEqual(r_rep.status_code, 200)
            self.assertTrue(r_rep.json()["resultados"][0]["repetido"])

            r_conf = self._post_firmado(
                "/api/servicios/generar-codigos/confirmar/",
                {"actor_persona_id": "10", "codigos": [codigo]},
            )
            self.assertEqual(r_conf.status_code, 200)
            self.assertEqual(r_conf.json()["resultados"][0]["estado"], "confirmado")

            r_cons = self._post_firmado(
                "/api/servicios/generar-codigos/consultar/",
                {"codigos": [codigo]},
            )
            self.assertEqual(r_cons.status_code, 200)
            self.assertEqual(r_cons.json()["resultados"][0]["estado"], "confirmado")

            r_anul = self._post_firmado(
                "/api/servicios/generar-codigos/anular/",
                {"actor_persona_id": "10", "motivo": "Retirado", "codigos": [codigo]},
            )
            self.assertEqual(r_anul.status_code, 200)
            self.assertEqual(r_anul.json()["resultados"][0]["estado"], "anulado")

    def test_rechaza_empresa_o_sigla_y_organizacion_no_habilitada(self):
        with servicio_simulado(self.auths):
            r_sigla = self._post_firmado(
                "/api/servicios/generar-codigos/generar/",
                {
                    "items": [
                        {
                            "sigla": "HACK",
                            "anio": "2026",
                            "numero_proyecto": "14",
                            "subproyecto": "A",
                            "departamento": "IN",
                            "disciplina": "C",
                            "tipo_documento": "DOC",
                            "motivo": "Intento",
                        }
                    ]
                },
            )
            self.assertEqual(r_sigla.status_code, 400)

            r_org = self._get_firmado("/api/servicios/generar-codigos/catalogos/", org_id="999")
            self.assertEqual(r_org.status_code, 403)
            self.assertEqual(r_org.json()["error"], "organizacion-no-habilitada")

            r_bad = self._get_firmado("/api/servicios/generar-codigos/catalogos/", secreto="mal-secreto")
            self.assertEqual(r_bad.status_code, 403)
            self.assertEqual(r_bad.json()["error"], "credencial-invalida")

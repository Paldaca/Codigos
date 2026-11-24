import json
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings

from cereipo_sso.organizacion import con_organizacion
from cereipo_sso.pruebas import payload_de_ejemplo, shell_simulado

from catalogos.services import (
    guardar_configuracion,
    marcar_sigla_bloqueada,
    sembrar_catalogos_estandar,
    validar_y_resolver_segmentos,
)

MEMORIA = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
COOKIE = "cereipo_shell_sesion"


def _payload(org_id: str, permisos: list[str]):
    return payload_de_ejemplo(
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
class CatalogosTests(TestCase):
    def setUp(self):
        cache.clear()
        self.patch_sync = mock.patch("integracion.services.maestros.sincronizar_maestro", return_value={"creados": 1})
        self.patch_sync.start()
        self.addCleanup(self.patch_sync.stop)

    def test_sigla_fija_por_org_y_bloqueada_tras_uso(self):
        with con_organizacion("100"):
            cfg = guardar_configuracion(sigla="pal", actor_persona_id="10", actor_nombre="Ana")
            self.assertEqual(cfg.sigla, "PAL")
            marcar_sigla_bloqueada()

        with shell_simulado(_payload("100", ["codigos:catalogos:administrar", "codigos:registro:ver"])):
            self.client.cookies[COOKIE] = "s1"
            r = self.client.put(
                "/api/catalogos/organizacion/",
                data=json.dumps({"sigla": "OTRA"}),
                content_type="application/json",
            )
            self.assertEqual(r.status_code, 409)
            self.assertEqual(r.json()["error"], "sigla-bloqueada")

    def test_sembrar_y_resolver_disciplina_shell(self):
        with con_organizacion("100"):
            res = sembrar_catalogos_estandar()
            self.assertGreater(res["creados"], 100)
            seg = validar_y_resolver_segmentos(
                anio="2026",
                numero_proyecto="14",
                subproyecto="A",
                departamento="IN",
                disciplina_shell="CIV",
                tipo_documento="PLA",
            )
            self.assertEqual(seg["disciplina"], "C")
            self.assertEqual(seg["disciplina_shell"], "CIV")

    def test_on_commit_publica_snapshot_no_vacio_con_rls(self):
        with mock.patch("integracion.services.maestros.sincronizar_maestro", return_value={"creados": 1}) as m_sync:
            with self.captureOnCommitCallbacks(execute=True):
                with con_organizacion("100"):
                    guardar_configuracion(sigla="PAL", actor_persona_id="10", actor_nombre="Ana")
            m_sync.assert_called_once()
            _, kwargs = m_sync.call_args
            registros = kwargs["registros"]
            self.assertTrue(any(r["clave"] == "organizacion:config" and r["datos"]["sigla"] == "PAL" for r in registros))

    def test_aislamiento_rls_modelos_catalogos(self):
        from django.db import connection
        from catalogos.models import CatalogoSegmento, ConfiguracionOrganizacion

        with con_organizacion("100"):
            ConfiguracionOrganizacion.objects.create(sigla="PAL")
            CatalogoSegmento.objects.create(tipo="disciplina", codigo="C", nombre="Civil")

        with con_organizacion("200"):
            for modelo in (ConfiguracionOrganizacion, CatalogoSegmento):
                with connection.cursor() as cursor:
                    cursor.execute(f'SELECT count(*) FROM "{modelo._meta.db_table}"')
                    self.assertEqual(cursor.fetchone()[0], 0)
            with self.assertRaises(Exception):
                ConfiguracionOrganizacion.objects.create(organizacion_id="100", sigla="HACK")

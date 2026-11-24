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

    def test_personalizar_restablecer_plantilla_y_revertir(self):
        from django.db import connection
        from catalogos.models import CatalogoSegmento, InstantaneaCatalogo

        with con_organizacion("100"):
            sembrar_catalogos_estandar()

        with shell_simulado(_payload("100", ["codigos:catalogos:administrar", "codigos:registro:ver"])):
            self.client.cookies[COOKIE] = "s1"

            # 1. Agregar un segmento personalizado y editar uno estándar
            r_add = self.client.post(
                "/api/catalogos/segmentos/",
                data=json.dumps({"tipo": "disciplina", "codigo": "S", "nombre": "Seguridad Industrial"}),
                content_type="application/json",
            )
            self.assertEqual(r_add.status_code, 201)
            with con_organizacion("100"):
                seg_m = CatalogoSegmento.objects.get(tipo="disciplina", codigo="M")
            r_edit = self.client.patch(
                f"/api/catalogos/segmentos/{seg_m.pk}/",
                data=json.dumps({"nombre": "Mecánica Pesada", "activo": False}),
                content_type="application/json",
            )
            self.assertEqual(r_edit.status_code, 200)

            # 2. Consultar historial y revertir la edición de Mecánica
            r_hist = self.client.get("/api/catalogos/segmentos/historial/?tipo=disciplina")
            self.assertEqual(r_hist.status_code, 200)
            eventos = r_hist.json()["resultados"]
            ev_edit = next(e for e in eventos if e["accion"] == "editado" and str(seg_m.pk) == e["objeto_id"])
            r_rev = self.client.post(f"/api/catalogos/segmentos/revertir/{ev_edit['id']}/")
            self.assertEqual(r_rev.status_code, 200)
            self.assertEqual(r_rev.json()["segmento"]["nombre"], "Mecánica")
            self.assertTrue(r_rev.json()["segmento"]["activo"])

            # 3. Editar de nuevo y restablecer la plantilla estándar de disciplinas
            self.client.patch(
                f"/api/catalogos/segmentos/{seg_m.pk}/",
                data=json.dumps({"nombre": "Mecánica Editada"}),
                content_type="application/json",
            )
            r_reset = self.client.post(
                "/api/catalogos/restablecer-plantilla/",
                data=json.dumps({"tipo": "disciplina", "desactivar_personalizados": True}),
                content_type="application/json",
            )
            self.assertEqual(r_reset.status_code, 200)
            datos_reset = r_reset.json()
            self.assertEqual(datos_reset["restaurados"], 1)
            self.assertEqual(datos_reset["desactivados"], 1)

            with con_organizacion("100"):
                seg_custom = CatalogoSegmento.objects.get(tipo="disciplina", codigo="S")
                self.assertFalse(seg_custom.activo)

            # 4. Revertir el restablecimiento restaurando la instantánea previa
            snap_id = datos_reset["instantanea_id"]
            r_snap = self.client.post(f"/api/catalogos/instantaneas/{snap_id}/restaurar/")
            self.assertEqual(r_snap.status_code, 200)
            with con_organizacion("100"):
                seg_custom.refresh_from_db()
                seg_m.refresh_from_db()
                self.assertTrue(seg_custom.activo)
                self.assertEqual(seg_m.nombre, "Mecánica Editada")

        # 5. Verificar RLS en InstantaneaCatalogo
        with con_organizacion("200"):
            with connection.cursor() as cursor:
                cursor.execute(f'SELECT count(*) FROM "{InstantaneaCatalogo._meta.db_table}"')
                self.assertEqual(cursor.fetchone()[0], 0)

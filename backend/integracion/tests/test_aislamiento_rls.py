"""Prueba obligatoria de aislamiento multi-organización y RLS (tarea 2.7, D-27)."""

from django.core.cache import cache
from django.db import connection, transaction
from django.test import TestCase, override_settings

from cereipo_sso.organizacion import TODAS, con_organizacion
from cereipo_sso.pruebas import payload_de_ejemplo, shell_simulado
from integracion.models import AmbitoPropio

MEMORIA = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
COOKIE_SHELL = "cereipo_shell_sesion"


def payload_de(organizacion: str):
    return payload_de_ejemplo(
        organizacion={"id": organizacion, "codigo": f"org-{organizacion}", "nombre": f"Org {organizacion}", "zona_horaria": "UTC"},
        aplicacion={
            "codigo": "codigos",
            "rol": "administrador",
            "permisos": ["codigos:inicio:ver", "codigos:administracion:gestionar"],
            "disciplinas": "*",
            "areas": [],
            "roles": {
                "administrador": {"permisos": ["codigos:inicio:ver", "codigos:administracion:gestionar"], "alcance_disciplina": "todas"}
            },
        },
        proyectos=[],
    )


def sembrar():
    with con_organizacion("100"):
        AmbitoPropio.objects.create(codigo="G1", nombre="Grupo Org 100")
    with con_organizacion("200"):
        AmbitoPropio.objects.create(codigo="G2", nombre="Grupo Org 200")


@override_settings(CEREIPO_SSO_ACTIVO=True, CACHES=MEMORIA)
class AislamientoHttpTests(TestCase):
    def setUp(self):
        cache.clear()
        sembrar()

    def test_misma_cuenta_en_dos_organizaciones_ve_solo_la_activa(self):
        with shell_simulado(payload_de("100")):
            self.client.cookies[COOKIE_SHELL] = "sesion-100"
            r1 = self.client.get("/api/administracion/ambitos/")
            self.assertEqual(r1.status_code, 200)
            self.assertEqual([a["codigo"] for a in r1.json()["ambitos"]], ["G1"])
        with shell_simulado(payload_de("200")):
            self.client.cookies[COOKIE_SHELL] = "sesion-200"
            r2 = self.client.get("/api/administracion/ambitos/")
            self.assertEqual(r2.status_code, 200)
            self.assertEqual([a["codigo"] for a in r2.json()["ambitos"]], ["G2"])


class AislamientoBaseTests(TestCase):
    def setUp(self):
        sembrar()

    def contar_crudo(self) -> int:
        with connection.cursor() as cursor:
            cursor.execute(f'SELECT count(*) FROM "{AmbitoPropio._meta.db_table}"')
            return cursor.fetchone()[0]

    def test_postgresql_con_rol_que_respeta_rls(self):
        self.assertEqual(connection.vendor, "postgresql")
        with connection.cursor() as cursor:
            cursor.execute("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
            self.assertEqual(cursor.fetchone(), (False, False))

    def test_sql_crudo_respetado_por_rls(self):
        self.assertEqual(self.contar_crudo(), 0)
        with con_organizacion("100"):
            self.assertEqual(self.contar_crudo(), 1)
        with con_organizacion(TODAS):
            self.assertEqual(self.contar_crudo(), 2)

    def test_escritura_en_otra_organizacion_rechazada(self):
        with con_organizacion("100"):
            with self.assertRaises(Exception):
                AmbitoPropio.objects.create(organizacion_id="200", codigo="AJENO", nombre="Intruso")
            with self.assertRaises(Exception):
                with transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.execute(
                            f'INSERT INTO "{AmbitoPropio._meta.db_table}" (organizacion_id, proyecto, codigo, nombre, activo) '
                            "VALUES ('200', '', 'SQL', 'Intruso', true)"
                        )


class AislamientoTablasNegocioRLSTests(TestCase):
    """Verifica aislamiento RLS en las tablas de integración (D-27)."""

    def test_todas_las_tablas_integracion_aisladas_por_organizacion(self):
        from integracion.models import AsignacionAmbito, MaestroShellCache

        with con_organizacion("100"):
            ambito = AmbitoPropio.objects.create(codigo="A100", nombre="Ambito 100")
            AsignacionAmbito.objects.create(persona_id="p1", ambito=ambito)
            MaestroShellCache.objects.create(entidad="shell.disciplinas", clave="CIV", datos={"nombre": "Civil"})

        modelos = [AmbitoPropio, AsignacionAmbito, MaestroShellCache]
        for modelo in modelos:
            with connection.cursor() as cursor:
                cursor.execute(f'SELECT count(*) FROM "{modelo._meta.db_table}"')
                self.assertEqual(cursor.fetchone()[0], 0, f"Fuga sin org en {modelo.__name__}")

        with con_organizacion("200"):
            for modelo in modelos:
                with connection.cursor() as cursor:
                    cursor.execute(f'SELECT count(*) FROM "{modelo._meta.db_table}"')
                    self.assertEqual(cursor.fetchone()[0], 0, f"Fuga en org 200 para {modelo.__name__}")
            with self.assertRaises(Exception):
                MaestroShellCache.objects.create(
                    organizacion_id="100", entidad="shell.disciplinas", clave="HACK", datos={},
                )

        with con_organizacion("100"):
            for modelo in modelos:
                self.assertEqual(modelo.objects.count(), 1)

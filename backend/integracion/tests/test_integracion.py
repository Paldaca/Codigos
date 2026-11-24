from unittest import mock

from django.test import TestCase

from integracion.manifiesto import manifiesto


class IntegracionTests(TestCase):
    def test_salud_responde_200_con_base_y_redis(self):
        r = self.client.get("/salud/")
        self.assertEqual(r.status_code, 200)
        datos = r.json()
        self.assertEqual(datos["estado"], "ok")
        self.assertEqual(datos["contrato"], 1)
        self.assertEqual(datos["componentes"], {"base": "ok", "redis": "ok"})

    def test_salud_503_si_falla_redis(self):
        with mock.patch("integracion.views.revisar_redis", return_value="error"):
            r = self.client.get("/salud/")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["estado"], "error")

    def test_manifiesto_valido(self):
        r = self.client.get("/.well-known/cereipo-app.json")
        self.assertEqual(r.status_code, 200)
        m = r.json()
        self.assertEqual(m["codigo"], "codigos")
        self.assertFalse(m["requiere_proyecto"])
        self.assertIn("codigos:administracion:gestionar", [p["slug"] for p in m["permisos"]])
        self.assertIn("generar-codigos", [s["codigo"] for s in m["servicios"]])
        self.assertEqual(m["maestros_propios"], ["codigos.catalogos"])
        self.assertEqual(manifiesto()["codigo"], "codigos")

    def test_yo_siembra_cookie_csrf_para_spa(self):
        from django.core.cache import cache
        from django.test import override_settings
        from cereipo_sso.pruebas import payload_de_ejemplo, shell_simulado

        payload = payload_de_ejemplo(
            organizacion={"id": "100", "codigo": "pal", "nombre": "Paldaca", "zona_horaria": "UTC"},
            aplicacion={
                "codigo": "codigos",
                "rol": "administrador",
                "permisos": ["codigos:inicio:ver"],
                "disciplinas": "*",
                "areas": [],
                "roles": {"administrador": {"permisos": ["codigos:inicio:ver"], "alcance_disciplina": "todas"}},
            },
            proyectos=[],
        )
        memoria = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
        with override_settings(CEREIPO_SSO_ACTIVO=True, CACHES=memoria):
            cache.clear()
            with shell_simulado(payload):
                self.client.cookies["cereipo_shell_sesion"] = "s100"
                r = self.client.get("/api/yo/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("cereipo_codigos_csrf", r.cookies)
        self.assertTrue(r.cookies["cereipo_codigos_csrf"].value)

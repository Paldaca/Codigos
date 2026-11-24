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

import urllib.error
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase, override_settings
from django.urls import reverse

from core.models import Modulo, UsuarioModulo

from . import notificaciones_portal
from .avisos import CODIGO_SOLICITUD_ANULACION, aprobadores_por_permiso_ids
from .models import CodigoGenerado, Empresa, SolicitudAnulacion

User = get_user_model()


class FirmaTests(TestCase):
    @override_settings(SECRET_KEY="clave-de-prueba-paldaca")
    def test_vector_compartido_con_el_portal(self):
        # Mismo vector que backend/notificaciones/tests.py del Portal.
        self.assertEqual(
            notificaciones_portal.firmar(b'{"codigo": "x"}', "hdt", "1700000000"),
            "3a9d0e031e7a715ce0336a9820b5f5afa39307eea7e5e78850b35b9b8f7b8a0d",
        )

    @override_settings(SECRET_KEY="clave-de-prueba-paldaca", PALDACA_NOTIF_SECRET="s" * 40)
    def test_vector_del_secreto_propio_compartido_con_el_portal(self):
        # Mismo vector que backend/notificaciones/tests.py del Portal
        # (FirmaPorModuloTests): el esquema con secreto propio debe coincidir byte a byte.
        self.assertEqual(
            notificaciones_portal.firmar(b'{"codigo": "x"}', "hdt", "1700000000"),
            "f0304a6ca434986600f828fa81963d787b98d2a377a5848695dd13d250ee2c53",
        )

    @override_settings(SECRET_KEY="clave-de-prueba-paldaca", PALDACA_NOTIF_SECRET="corto")
    def test_un_secreto_propio_demasiado_corto_se_ignora(self):
        # El Portal tambien lo ignora: lo unico que valida es el esquema legado.
        self.assertEqual(
            notificaciones_portal.firmar(b'{"codigo": "x"}', "hdt", "1700000000"),
            "3a9d0e031e7a715ce0336a9820b5f5afa39307eea7e5e78850b35b9b8f7b8a0d",
        )


class SolicitudAnulacionAvisoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.modulo, _ = Modulo.objects.get_or_create(
            codigo="codigos", defaults={"nombre": "Codigos"}
        )
        permiso = Permission.objects.get(
            codename="puede_anular_codigo", content_type__app_label="documentos"
        )
        cls.solicitante = User.objects.create_user(
            username="solicitante", password="x", first_name="Ana", last_name="Pérez"
        )
        cls.con_permiso = User.objects.create_user(username="con_permiso", password="x")
        cls.con_permiso.user_permissions.add(permiso)
        cls.por_grupo = User.objects.create_user(username="por_grupo", password="x")
        grupo = Group.objects.create(name="Aprobadores de códigos")
        grupo.permissions.add(permiso)
        cls.por_grupo.groups.add(grupo)
        cls.permiso_sin_modulo = User.objects.create_user(username="sin_modulo", password="x")
        cls.permiso_sin_modulo.user_permissions.add(permiso)
        cls.usuario_normal = User.objects.create_user(username="normal", password="x")
        for usuario in (cls.solicitante, cls.con_permiso, cls.por_grupo, cls.usuario_normal):
            UsuarioModulo.objects.create(usuario=usuario, modulo=cls.modulo)

        empresa = Empresa.objects.create(
            sigla="PAL", nombre="Paldaca", correo_notificacion="docs@paldaca.test"
        )
        cls.codigo = CodigoGenerado.objects.create(
            empresa=empresa,
            año="26",
            numero_proyecto="01",
            subproyecto="1",
            departamento="IN",
            disciplina="EL",
            tipo_documento="PLN",
            consecutivo=1,
            codigo="PAL-26-01-1-IN-EL-PLN-001",
            motivo="Plano",
            usuario=cls.solicitante,
        )

    def test_aprobadores_por_permiso_directo_o_grupo_con_acceso(self):
        self.assertEqual(
            set(aprobadores_por_permiso_ids()), {self.con_permiso.pk, self.por_grupo.pk}
        )

    def test_solicitar_anulacion_emite_al_confirmar(self):
        self.client.force_login(self.solicitante)
        with mock.patch.object(notificaciones_portal, "emitir_evento") as emitir:
            with self.captureOnCommitCallbacks(execute=True):
                respuesta = self.client.post(
                    reverse("solicitar_anulacion", args=[self.codigo.pk]),
                    {"motivo": "Número de plano repetido"},
                )
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.json()["success"])
        kwargs = emitir.call_args.kwargs
        self.assertEqual(kwargs["codigo"], CODIGO_SOLICITUD_ANULACION)
        self.assertEqual(kwargs["emisor"], self.solicitante)
        self.assertIn("Ana Pérez", kwargs["cuerpo"])
        self.assertEqual(
            set(kwargs["payload"]["usuario_ids"]), {self.con_permiso.pk, self.por_grupo.pk}
        )
        solicitud = SolicitudAnulacion.objects.get(codigo=self.codigo)
        self.assertEqual(kwargs["payload"]["solicitud_id"], solicitud.pk)
        self.assertTrue(kwargs["payload"]["url"].endswith("/codigos/solicitudes_anulacion/"))

    @override_settings(
        PALDACA_NOTIFICACIONES_ACTIVAS=True,
        PALDACA_PORTAL_API_URL="http://portal.test/api",
    )
    def test_portal_caido_no_rompe_la_solicitud(self):
        self.client.force_login(self.solicitante)
        with mock.patch.object(
            notificaciones_portal.urllib.request,
            "urlopen",
            side_effect=urllib.error.URLError("caido"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                respuesta = self.client.post(
                    reverse("solicitar_anulacion", args=[self.codigo.pk]),
                    {"motivo": "Duplicado"},
                )
        self.assertTrue(respuesta.json()["success"])
        self.assertTrue(SolicitudAnulacion.objects.filter(codigo=self.codigo).exists())

    def test_solicitud_invalida_no_emite(self):
        self.client.force_login(self.solicitante)
        with mock.patch.object(notificaciones_portal, "emitir_evento") as emitir:
            with self.captureOnCommitCallbacks(execute=True):
                self.client.post(
                    reverse("solicitar_anulacion", args=[self.codigo.pk]), {"motivo": ""}
                )
        emitir.assert_not_called()

from django.test import SimpleTestCase

from core.exceptions import ErrorNegocio
from core.utils import formatear_codigo
from core.validators import validar_anio, validar_sigla_organizacion


class CoreTests(SimpleTestCase):
    def test_formatear_codigo_ocho_segmentos(self):
        codigo = formatear_codigo(
            sigla="PAL",
            anio="2026",
            numero_proyecto="14",
            subproyecto="A",
            departamento="IN",
            disciplina="C",
            tipo_documento="PLA",
            consecutivo=7,
        )
        self.assertEqual(codigo, "PAL-26-14-A-IN-C-PLA-007")

    def test_validadores(self):
        self.assertEqual(validar_sigla_organizacion(" pal "), "PAL")
        self.assertEqual(validar_anio(2026), "2026")
        with self.assertRaises(ErrorNegocio):
            validar_sigla_organizacion("a")
        with self.assertRaises(ErrorNegocio):
            validar_anio("26")

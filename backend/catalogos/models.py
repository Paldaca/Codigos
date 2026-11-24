"""Modelos de configuración de sigla por organización y catálogos de segmentos (tarea 5.2)."""

from __future__ import annotations

from django.db import models

from cereipo_sso.aislamiento import ModeloDeOrganizacion


class ConfiguracionOrganizacion(ModeloDeOrganizacion):
    """Configuración única por organización: fija el primer segmento `{SIGLA_ORG}`."""

    sigla = models.CharField("sigla de organización", max_length=10)
    correo_notificacion = models.EmailField("correo de notificación", blank=True)
    notificar_por_correo = models.BooleanField("notificar por correo", default=False)
    bloqueada_por_codigos = models.BooleanField("sigla bloqueada por códigos emitidos", default=False)
    creado_en = models.DateTimeField("creado en", auto_now_add=True)
    actualizado_en = models.DateTimeField("actualizado en", auto_now=True)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "configuración de organización"
        verbose_name_plural = "configuraciones de organización"
        constraints = [
            models.UniqueConstraint(fields=["organizacion_id"], name="codigos_config_organizacion_unica"),
        ]

    def __str__(self) -> str:
        return f"{self.sigla} (org={self.organizacion_id})"


class CatalogoSegmento(ModeloDeOrganizacion):
    """Catálogo configurable en datos para los segmentos del código (tarea 5.2)."""

    class Tipo(models.TextChoices):
        PROYECTO = "proyecto", "Número de proyecto (NN)"
        SUBPROYECTO = "subproyecto", "Subproyecto (S)"
        DEPARTAMENTO = "departamento", "Departamento (DEPT)"
        DISCIPLINA = "disciplina", "Disciplina (DISC)"
        TIPO_DOCUMENTO = "tipo_documento", "Tipo de documento / plano (TIPO)"

    tipo = models.CharField("tipo de segmento", max_length=20, choices=Tipo.choices)
    codigo = models.CharField("código", max_length=10)
    nombre = models.CharField("nombre", max_length=120)
    codigo_shell = models.CharField(
        "código equivalente en el Shell",
        max_length=40,
        blank=True,
        help_text="Opcional (D-39): ej. CIV en el Shell equivale a C en Códigos.",
    )
    orden = models.PositiveSmallIntegerField("orden", default=0)
    activo = models.BooleanField("activo", default=True)
    creado_en = models.DateTimeField("creado en", auto_now_add=True)
    actualizado_en = models.DateTimeField("actualizado en", auto_now=True)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "elemento de catálogo"
        verbose_name_plural = "elementos de catálogo"
        ordering = ["tipo", "orden", "codigo"]
        constraints = [
            models.UniqueConstraint(
                fields=["organizacion_id", "tipo", "codigo"],
                name="codigos_segmento_unico_por_org",
            ),
        ]
        indexes = [
            models.Index(fields=["organizacion_id", "tipo", "activo"], name="codigos_seg_lookup_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.tipo}: {self.codigo} · {self.nombre}"

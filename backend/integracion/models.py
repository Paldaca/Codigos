"""Modelos de integración con Cereipo Shell (D-42 y copias locales de datos maestros)."""

from __future__ import annotations

from django.db import models

from cereipo_sso.aislamiento import ModeloDeOrganizacion


class AmbitoPropio(ModeloDeOrganizacion):
    """Ámbito propio genérico del panel de administración obligatorio (D-42)."""

    proyecto = models.CharField("proyecto", max_length=40, blank=True)
    codigo = models.CharField("código", max_length=40)
    nombre = models.CharField("nombre", max_length=120)
    activo = models.BooleanField("activo", default=True)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "ámbito propio"
        verbose_name_plural = "ámbitos propios"
        ordering = ["proyecto", "codigo"]
        constraints = [
            models.UniqueConstraint(
                fields=["organizacion_id", "proyecto", "codigo"],
                name="codigos_ambito_unico",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.proyecto} · {self.nombre}" if self.proyecto else self.nombre


class AsignacionAmbito(ModeloDeOrganizacion):
    ambito = models.ForeignKey(AmbitoPropio, on_delete=models.CASCADE, related_name="asignaciones")
    persona_id = models.CharField("persona", max_length=64)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "asignación de ámbito"
        verbose_name_plural = "asignaciones de ámbito"
        constraints = [
            models.UniqueConstraint(
                fields=["ambito", "persona_id"],
                name="codigos_asignacion_unica_por_ambito",
            ),
        ]


class MaestroShellCache(ModeloDeOrganizacion):
    """Copia local de solo lectura de clientes, proyectos y disciplinas del Shell (D-22, D-24)."""

    class Entidad(models.TextChoices):
        CLIENTES = "shell.clientes", "Clientes"
        PROYECTOS = "shell.proyectos", "Proyectos"
        DISCIPLINAS = "shell.disciplinas", "Disciplinas"

    entidad = models.CharField("entidad", max_length=40, choices=Entidad.choices)
    clave = models.CharField("clave", max_length=80)
    datos = models.JSONField("datos", default=dict)
    activo = models.BooleanField("activo", default=True)
    actualizado_en = models.DateTimeField("actualizado en", auto_now=True)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "dato maestro del Shell"
        verbose_name_plural = "datos maestros del Shell"
        ordering = ["entidad", "clave"]
        constraints = [
            models.UniqueConstraint(
                fields=["organizacion_id", "entidad", "clave"],
                name="codigos_maestro_shell_unico",
            ),
        ]


class CursorMaestro(models.Model):
    """Cursor incremental por entidad consumida desde el Shell."""

    entidad = models.CharField("entidad", max_length=60, unique=True)
    marca = models.CharField("marca", max_length=120, blank=True)
    actualizado_en = models.DateTimeField("actualizado en", auto_now=True)

    class Meta:
        verbose_name = "cursor de maestro"
        verbose_name_plural = "cursores de maestros"

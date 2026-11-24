"""Modelos de generación, registro y anulación de códigos (tareas 5.3, 5.6)."""

from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone

from cereipo_sso.aislamiento import ModeloDeOrganizacion


class ContadorSecuencia(ModeloDeOrganizacion):
    """Contador atómico por combinación de segmentos dentro de la organización (tarea 5.3)."""

    anio = models.CharField("año", max_length=4)
    numero_proyecto = models.CharField("número de proyecto", max_length=10)
    subproyecto = models.CharField("subproyecto", max_length=10)
    departamento = models.CharField("departamento", max_length=10)
    disciplina = models.CharField("disciplina", max_length=10)
    tipo_documento = models.CharField("tipo de documento", max_length=10)
    ultimo_consecutivo = models.PositiveIntegerField("último consecutivo", default=0)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "contador de secuencia"
        verbose_name_plural = "contadores de secuencia"
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organizacion_id",
                    "anio",
                    "numero_proyecto",
                    "subproyecto",
                    "departamento",
                    "disciplina",
                    "tipo_documento",
                ],
                name="codigos_contador_combinacion_unica",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.anio}-{self.numero_proyecto}-{self.subproyecto}-{self.departamento}-{self.disciplina}-{self.tipo_documento}: {self.ultimo_consecutivo}"


class CodigoRegistro(ModeloDeOrganizacion):
    """Código documental o de plano asignado (manual o por API)."""

    class Estado(models.TextChoices):
        RESERVADO = "reservado", "Reservado"
        CONFIRMADO = "confirmado", "Confirmado"
        ANULADO = "anulado", "Anulado"

    class Origen(models.TextChoices):
        MANUAL = "manual", "Manual (programa)"
        API = "api", "Automático (API)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sigla = models.CharField("sigla de organización", max_length=10)
    anio = models.CharField("año", max_length=4)
    numero_proyecto = models.CharField("número de proyecto", max_length=10)
    subproyecto = models.CharField("subproyecto", max_length=10)
    departamento = models.CharField("departamento", max_length=10)
    disciplina = models.CharField("disciplina", max_length=10)
    tipo_documento = models.CharField("tipo de documento", max_length=10)
    consecutivo = models.PositiveIntegerField("consecutivo")
    codigo = models.CharField("código", max_length=80)

    estado = models.CharField("estado", max_length=20, choices=Estado.choices, default=Estado.CONFIRMADO)
    origen = models.CharField("origen", max_length=20, choices=Origen.choices, default=Origen.MANUAL)
    app_origen = models.CharField("aplicación origen", max_length=40, blank=True)
    clave_idempotencia = models.CharField("clave de idempotencia", max_length=128, blank=True)
    referencia_externa = models.CharField("referencia externa", max_length=120, blank=True)
    proyecto_shell_codigo = models.CharField("código de proyecto en Shell", max_length=40, blank=True)
    disciplina_shell_codigo = models.CharField("código de disciplina en Shell", max_length=20, blank=True)

    motivo = models.TextField("motivo / asunto")
    motivo_anulacion = models.TextField("motivo de anulación", blank=True)

    creado_por_persona_id = models.CharField("creado por (persona_id)", max_length=64, blank=True)
    creado_por_nombre = models.CharField("creado por (nombre)", max_length=200, blank=True)
    anulado_por_persona_id = models.CharField("anulado por (persona_id)", max_length=64, blank=True)
    anulado_por_nombre = models.CharField("anulado por (nombre)", max_length=200, blank=True)

    fecha_creacion = models.DateTimeField("fecha de creación", default=timezone.now, db_index=True)
    fecha_confirmacion = models.DateTimeField("fecha de confirmación", null=True, blank=True)
    fecha_anulacion = models.DateTimeField("fecha de anulación", null=True, blank=True)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "código registrado"
        verbose_name_plural = "códigos registrados"
        ordering = ["-fecha_creacion", "-consecutivo"]
        constraints = [
            models.UniqueConstraint(fields=["organizacion_id", "codigo"], name="codigos_registro_codigo_unico"),
            models.UniqueConstraint(
                fields=["organizacion_id", "origen", "clave_idempotencia"],
                condition=~Q(clave_idempotencia=""),
                name="codigos_idempotencia_unica",
            ),
        ]
        indexes = [
            models.Index(fields=["organizacion_id", "-fecha_creacion"], name="cod_org_fecha_idx"),
            models.Index(fields=["organizacion_id", "estado", "-fecha_anulacion"], name="cod_org_estado_anul_idx"),
            models.Index(fields=["organizacion_id", "referencia_externa"], name="cod_org_ref_ext_idx"),
        ]

    def __str__(self) -> str:
        return self.codigo


class SolicitudAnulacion(ModeloDeOrganizacion):
    """Solicitud de anulación que requiere aprobación de un aprobador."""

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"

    codigo_registro = models.ForeignKey(
        CodigoRegistro,
        on_delete=models.PROTECT,
        related_name="solicitudes_anulacion",
    )
    solicitante_persona_id = models.CharField("solicitante (persona_id)", max_length=64)
    solicitante_nombre = models.CharField("solicitante (nombre)", max_length=200, blank=True)
    motivo = models.TextField("motivo")
    estado = models.CharField("estado", max_length=20, choices=Estado.choices, default=Estado.PENDIENTE)
    resuelto_por_persona_id = models.CharField("resuelto por (persona_id)", max_length=64, blank=True)
    resuelto_por_nombre = models.CharField("resuelto por (nombre)", max_length=200, blank=True)
    motivo_resolucion = models.TextField("motivo de resolución", blank=True)
    fecha_solicitud = models.DateTimeField("fecha de solicitud", default=timezone.now)
    fecha_resolucion = models.DateTimeField("fecha de resolución", null=True, blank=True)

    class Meta(ModeloDeOrganizacion.Meta):
        verbose_name = "solicitud de anulación"
        verbose_name_plural = "solicitudes de anulación"
        ordering = ["-fecha_solicitud"]
        constraints = [
            models.UniqueConstraint(
                fields=["organizacion_id", "codigo_registro", "solicitante_persona_id"],
                condition=Q(estado="pendiente"),
                name="codigos_solicitud_pendiente_unica",
            ),
        ]
        indexes = [
            models.Index(fields=["organizacion_id", "estado", "-fecha_solicitud"], name="cod_sol_estado_idx"),
        ]

    def __str__(self) -> str:
        return f"Solicitud {self.codigo_registro.codigo} ({self.estado})"

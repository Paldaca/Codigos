"""Contratos v1 del servicio declarado `codigos/generar-codigos` (D-16)."""

from rest_framework import serializers


class ItemServicioSerializer(serializers.Serializer):
    anio = serializers.CharField(max_length=4)
    numero_proyecto = serializers.CharField(max_length=10)
    subproyecto = serializers.CharField(max_length=10)
    departamento = serializers.CharField(max_length=10)
    disciplina = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    disciplina_shell = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    tipo_documento = serializers.CharField(max_length=10)
    proyecto_shell_codigo = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    motivo = serializers.CharField(max_length=1000)
    clave_idempotencia = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    referencia_externa = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")

    def to_internal_value(self, data):
        if isinstance(data, dict):
            for prohibido in ("empresa", "sigla", "organizacion", "organizacion_id"):
                if prohibido in data:
                    raise serializers.ValidationError(
                        f"No se permite indicar «{prohibido}»: la sigla es fija para tu organización."
                    )
        return super().to_internal_value(data)


class LoteCodigosServicioSerializer(serializers.Serializer):
    v = serializers.ChoiceField(choices=[1], default=1, required=False)
    actor_persona_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    actor_nombre = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    items = serializers.ListField(child=ItemServicioSerializer(), min_length=1, max_length=200)


class ConfirmarServicioSerializer(serializers.Serializer):
    v = serializers.ChoiceField(choices=[1], default=1, required=False)
    actor_persona_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    actor_nombre = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    codigos = serializers.ListField(child=serializers.CharField(max_length=80), max_length=200, required=False, default=list)
    claves_idempotencia = serializers.ListField(child=serializers.CharField(max_length=128), max_length=200, required=False, default=list)


class AnularServicioSerializer(serializers.Serializer):
    v = serializers.ChoiceField(choices=[1], default=1, required=False)
    actor_persona_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    actor_nombre = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    motivo = serializers.CharField(max_length=1000)
    codigos = serializers.ListField(child=serializers.CharField(max_length=80), max_length=200, required=False, default=list)
    referencias_externas = serializers.ListField(child=serializers.CharField(max_length=120), max_length=200, required=False, default=list)


class ConsultarServicioSerializer(serializers.Serializer):
    v = serializers.ChoiceField(choices=[1], default=1, required=False)
    codigos = serializers.ListField(child=serializers.CharField(max_length=80), max_length=200, required=False, default=list)
    referencias_externas = serializers.ListField(child=serializers.CharField(max_length=120), max_length=200, required=False, default=list)

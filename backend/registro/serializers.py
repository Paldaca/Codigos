from rest_framework import serializers


class ItemManualSerializer(serializers.Serializer):
    anio = serializers.CharField(max_length=4)
    numero_proyecto = serializers.CharField(max_length=10)
    subproyecto = serializers.CharField(max_length=10)
    departamento = serializers.CharField(max_length=10)
    disciplina = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    disciplina_shell = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    tipo_documento = serializers.CharField(max_length=10)
    proyecto_shell_codigo = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    motivo = serializers.CharField(required=False, allow_blank=True, default="")
    clave_idempotencia = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")

    def to_internal_value(self, data):
        if isinstance(data, dict):
            for prohibido in ("empresa", "sigla", "organizacion", "organizacion_id"):
                if prohibido in data:
                    raise serializers.ValidationError(
                        f"No se permite indicar «{prohibido}»: la sigla es fija para tu organización."
                    )
        return super().to_internal_value(data)


class MotivoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=1000)


class ResolverSolicitudSerializer(serializers.Serializer):
    accion = serializers.ChoiceField(choices=["aprobar", "rechazar"])
    motivo_resolucion = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")

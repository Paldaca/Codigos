from rest_framework import serializers


class ConfiguracionOrganizacionSerializer(serializers.Serializer):
    sigla = serializers.CharField(max_length=10)
    correo_notificacion = serializers.EmailField(required=False, allow_blank=True, default="")
    notificar_por_correo = serializers.BooleanField(required=False, default=False)
    motivo = serializers.CharField(required=False, allow_blank=True, default="")


class SegmentoCrearSerializer(serializers.Serializer):
    tipo = serializers.CharField(max_length=20)
    codigo = serializers.CharField(max_length=10)
    nombre = serializers.CharField(max_length=120)
    codigo_shell = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    orden = serializers.IntegerField(min_value=0, max_value=32000, required=False, default=0)
    activo = serializers.BooleanField(required=False, default=True)
    motivo = serializers.CharField(required=False, allow_blank=True, default="")


class SegmentoActualizarSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=120, required=False)
    codigo_shell = serializers.CharField(max_length=40, required=False, allow_blank=True)
    orden = serializers.IntegerField(min_value=0, max_value=32000, required=False)
    activo = serializers.BooleanField(required=False)
    motivo = serializers.CharField(required=False, allow_blank=True, default="")

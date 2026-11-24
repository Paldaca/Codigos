"""Contratos v1 del servicio declarado `codigos/generar-codigos` (D-16)."""

from rest_framework import serializers


class LoteCodigosServicioSerializer(serializers.Serializer):
    v = serializers.IntegerField(default=1, required=False)
    actor_persona_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    actor_nombre = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    items = serializers.ListField(child=serializers.DictField(), min_length=1, max_length=200)


class ConfirmarServicioSerializer(serializers.Serializer):
    v = serializers.IntegerField(default=1, required=False)
    actor_persona_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    actor_nombre = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    codigos = serializers.ListField(child=serializers.CharField(max_length=80), required=False, default=list)
    claves_idempotencia = serializers.ListField(child=serializers.CharField(max_length=128), required=False, default=list)


class AnularServicioSerializer(serializers.Serializer):
    v = serializers.IntegerField(default=1, required=False)
    actor_persona_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    actor_nombre = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    motivo = serializers.CharField(max_length=1000)
    codigos = serializers.ListField(child=serializers.CharField(max_length=80), required=False, default=list)
    referencias_externas = serializers.ListField(child=serializers.CharField(max_length=120), required=False, default=list)


class ConsultarServicioSerializer(serializers.Serializer):
    v = serializers.IntegerField(default=1, required=False)
    codigos = serializers.ListField(child=serializers.CharField(max_length=80), required=False, default=list)
    referencias_externas = serializers.ListField(child=serializers.CharField(max_length=120), required=False, default=list)

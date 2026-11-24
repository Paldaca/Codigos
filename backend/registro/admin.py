from django.contrib import admin

from .models import CodigoRegistro, ContadorSecuencia, SolicitudAnulacion


@admin.register(ContadorSecuencia)
class ContadorSecuenciaAdmin(admin.ModelAdmin):
    list_display = [
        "organizacion_id",
        "anio",
        "numero_proyecto",
        "subproyecto",
        "departamento",
        "disciplina",
        "tipo_documento",
        "ultimo_consecutivo",
    ]


@admin.register(CodigoRegistro)
class CodigoRegistroAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "codigo", "estado", "origen", "creado_por_nombre", "fecha_creacion"]
    list_filter = ["estado", "origen", "anio"]
    search_fields = ["codigo", "motivo", "referencia_externa"]


@admin.register(SolicitudAnulacion)
class SolicitudAnulacionAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "codigo_registro", "solicitante_nombre", "estado", "fecha_solicitud"]
    list_filter = ["estado"]

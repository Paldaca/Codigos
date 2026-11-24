from django.contrib import admin

from .models import CatalogoSegmento, ConfiguracionOrganizacion


@admin.register(ConfiguracionOrganizacion)
class ConfiguracionOrganizacionAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "sigla", "notificar_por_correo", "bloqueada_por_codigos"]


@admin.register(CatalogoSegmento)
class CatalogoSegmentoAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "tipo", "codigo", "nombre", "codigo_shell", "activo"]
    list_filter = ["tipo", "activo"]

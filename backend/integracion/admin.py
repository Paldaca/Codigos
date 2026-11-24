from django.contrib import admin

from .models import AmbitoPropio, AsignacionAmbito, CursorMaestro, MaestroShellCache


@admin.register(AmbitoPropio)
class AmbitoPropioAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "proyecto", "codigo", "nombre", "activo"]


@admin.register(AsignacionAmbito)
class AsignacionAmbitoAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "ambito", "persona_id"]


@admin.register(MaestroShellCache)
class MaestroShellCacheAdmin(admin.ModelAdmin):
    list_display = ["organizacion_id", "entidad", "clave", "activo", "actualizado_en"]


@admin.register(CursorMaestro)
class CursorMaestroAdmin(admin.ModelAdmin):
    list_display = ["entidad", "marca", "actualizado_en"]

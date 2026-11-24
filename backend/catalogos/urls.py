from django.urls import path

from . import views

urlpatterns = [
    path("organizacion/", views.configuracion_organizacion, name="catalogos-organizacion"),
    path("organizacion/historial/", views.historial_configuracion, name="catalogos-organizacion-historial"),
    path("segmentos/", views.segmentos, name="catalogos-segmentos"),
    path("segmentos/historial/", views.historial_segmentos, name="catalogos-segmentos-historial"),
    path("segmentos/lote/", views.lote_segmentos, name="catalogos-segmentos-lote"),
    path("segmentos/revertir/<int:historial_id>/", views.revertir_segmento, name="catalogos-segmentos-revertir"),
    path("segmentos/<int:segmento_id>/", views.segmento_detalle, name="catalogos-segmento-detalle"),
    path("sembrar-estandar/", views.sembrar_estandar, name="catalogos-sembrar"),
    path("restablecer-plantilla/", views.restablecer_plantilla, name="catalogos-restablecer-plantilla"),
    path("instantaneas/", views.instantaneas, name="catalogos-instantaneas"),
    path("instantaneas/<int:instantanea_id>/restaurar/", views.restaurar_instantanea_vista, name="catalogos-instantanea-restaurar"),
]

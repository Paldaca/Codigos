from django.urls import path

from . import views

urlpatterns = [
    path("organizacion/", views.configuracion_organizacion, name="catalogos-organizacion"),
    path("organizacion/historial/", views.historial_configuracion, name="catalogos-organizacion-historial"),
    path("segmentos/", views.segmentos, name="catalogos-segmentos"),
    path("segmentos/<int:segmento_id>/", views.segmento_detalle, name="catalogos-segmento-detalle"),
    path("sembrar-estandar/", views.sembrar_estandar, name="catalogos-sembrar"),
]

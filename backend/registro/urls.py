from django.urls import path

from . import views

urlpatterns = [
    path("resumen/", views.resumen, name="registro-resumen"),
    path("previsualizar/", views.previsualizar, name="registro-previsualizar"),
    path("generar/", views.generar, name="registro-generar"),
    path("codigos/", views.lista_codigos, name="registro-lista"),
    path("codigos/<uuid:codigo_id>/", views.detalle_codigo, name="registro-detalle"),
    path("codigos/<uuid:codigo_id>/anular/", views.anular, name="registro-anular"),
    path("codigos/<uuid:codigo_id>/solicitar-anulacion/", views.solicitar_anulacion, name="registro-solicitar-anulacion"),
    path("solicitudes-anulacion/", views.solicitudes_anulacion, name="registro-solicitudes"),
    path("solicitudes-anulacion/<int:solicitud_id>/resolver/", views.resolver_solicitud, name="registro-resolver-solicitud"),
]

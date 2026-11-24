from django.urls import path

from . import views

urlpatterns = [
    path("catalogos/", views.CatalogosServicioView.as_view(), name="api-servicio-catalogos"),
    path("reservar/", views.ReservarServicioView.as_view(), name="api-servicio-reservar"),
    path("confirmar/", views.ConfirmarServicioView.as_view(), name="api-servicio-confirmar"),
    path("generar/", views.GenerarServicioView.as_view(), name="api-servicio-generar"),
    path("anular/", views.AnularServicioView.as_view(), name="api-servicio-anular"),
    path("consultar/", views.ConsultarServicioView.as_view(), name="api-servicio-consultar"),
]

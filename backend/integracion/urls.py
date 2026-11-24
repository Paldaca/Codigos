from django.urls import path

from . import manifiesto, views

urlpatterns = [
    path("salud/", views.salud, name="salud"),
    path(".well-known/cereipo-app.json", manifiesto.vista, name="manifiesto"),
    path("api/yo/", views.yo, name="yo"),
    path("api/administracion/ambitos/", views.ambitos, name="ambitos"),
    path("api/integracion/maestros-shell/", views.maestros_shell, name="maestros-shell"),
]

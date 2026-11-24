from django.contrib import admin
from django.urls import include, path, re_path

from .spa import RUTAS_DEL_BACKEND, spa

_EXCLUIDAS = "|".join(r.replace(".", r"\.") for r in RUTAS_DEL_BACKEND)

urlpatterns = [
    path("", include("integracion.urls")),
    path("api/catalogos/", include("catalogos.urls")),
    path("api/registro/", include("registro.urls")),
    path("api/servicios/generar-codigos/", include("api.urls")),
    path("admin/", admin.site.urls),
    re_path(rf"^(?!{_EXCLUIDAS}).*$", spa, name="spa"),
]

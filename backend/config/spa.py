"""Entrega la SPA compilada (D-36)."""

from __future__ import annotations

from django.conf import settings
from django.http import Http404, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

RUTAS_DEL_BACKEND = ("api/", "admin/", "salud/", "static/", "assets/", ".well-known/")


@ensure_csrf_cookie
@require_GET
def spa(request, ruta: str = ""):
    indice = settings.SPA_DIR / "index.html"
    if not indice.is_file():
        raise Http404("La SPA no está compilada (npm run build en frontend/).")
    respuesta = HttpResponse(indice.read_bytes(), content_type="text/html; charset=utf-8")
    respuesta["Cache-Control"] = "no-cache"
    return respuesta

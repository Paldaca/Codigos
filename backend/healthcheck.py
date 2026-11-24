"""Chequeo de salud del contenedor (HEALTHCHECK del Dockerfile, puerto 8053)."""

import os
import sys
import urllib.error
import urllib.request

hosts = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]
host = (hosts[0] if hosts else "localhost").lstrip(".")
peticion = urllib.request.Request(
    f"http://127.0.0.1:{os.getenv('PORT', '8053')}/salud/",
    headers={"Host": host, "X-Forwarded-Proto": "https"},
)
try:
    with urllib.request.urlopen(peticion, timeout=4) as respuesta:
        sys.exit(0 if respuesta.status == 200 else 1)
except (urllib.error.URLError, OSError):
    sys.exit(1)

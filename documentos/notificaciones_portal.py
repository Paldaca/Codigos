"""Emite eventos al bus de notificaciones de Portal-Paldaca.

Llamada server-to-server firmada con un HMAC derivado de DJANGO_SECRET_KEY
(misma funcion que backend/notificaciones/firma.py del Portal). No necesita la
sesion de ningun usuario, asi que sirve igual desde una vista que desde un cron.

Nunca lanza: si el Portal no responde se registra y el guardado local sigue.
"""

import hashlib
import hmac
import json
import logging
import time
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)

TIMEOUT_SEGUNDOS = 4
_SAL = b"paldaca.notificaciones.v1:"


def firmar(cuerpo: bytes, cliente: str, timestamp: str) -> str:
    clave = hashlib.sha256(_SAL + settings.SECRET_KEY.encode()).digest()
    mensaje = f"{timestamp}.{cliente}.".encode() + cuerpo
    return hmac.new(clave, mensaje, hashlib.sha256).hexdigest()


def url_en_portal(ruta: str) -> str:
    """Deep link a una pantalla de este modulo dentro del shell del Portal."""
    return f"{settings.PALDACA_PORTAL_URL}{settings.PALDACA_SHELL_PATH}{ruta}"


def emitir_evento(*, codigo, titulo, cuerpo, payload=None, emisor=None) -> bool:
    if not settings.PALDACA_NOTIFICACIONES_ACTIVAS:
        return False
    cliente = settings.PALDACA_MODULO_CODIGO
    datos = {
        "codigo": codigo,
        "titulo": titulo[:200],
        "cuerpo": cuerpo,
        "payload": payload or {},
    }
    if getattr(emisor, "pk", None) is not None:
        datos["emisor_id"] = emisor.pk
    cuerpo_json = json.dumps(datos).encode()
    timestamp = str(int(time.time()))
    peticion = urllib.request.Request(
        f"{settings.PALDACA_PORTAL_API_URL}/notificaciones/eventos/",
        data=cuerpo_json,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Paldaca-Client": cliente,
            "X-Paldaca-Timestamp": timestamp,
            "X-Paldaca-Signature": firmar(cuerpo_json, cliente, timestamp),
        },
    )
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS):
            pass
    except urllib.error.HTTPError as exc:
        logger.warning(
            "NOTIFICACION_RECHAZADA | codigo=%s status=%s detalle=%s",
            codigo,
            exc.code,
            exc.read()[:300],
        )
        return False
    except Exception as exc:
        logger.warning("NOTIFICACION_NO_ENVIADA | codigo=%s error=%s", codigo, exc)
        return False
    logger.info("NOTIFICACION_EMITIDA | codigo=%s", codigo)
    return True


def emitir_al_confirmar(**kwargs) -> None:
    """Emite cuando la transaccion confirma: un rollback no deja avisos fantasma."""
    transaction.on_commit(lambda: emitir_evento(**kwargs))

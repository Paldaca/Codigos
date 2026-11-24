# INTEGRATION.md — Integración de Códigos con Cereipo

---

## 1. Posición en la suite

| Aspecto | Valor |
|---|---|
| Código de aplicación (`APP_CODIGO`) | `codigos` |
| Contrato de plataforma soportado | `CONTRATO_VERSION = 1` |
| `requiere_proyecto` | `False` (opera a nivel de organización) |
| Manifiesto | `GET /.well-known/cereipo-app.json` (`integracion/manifiesto.py`) |
| Salud | `GET /salud/` (verifica PostgreSQL y Redis, HTTP 200 o 503) |
| Puertos locales (`iniciar.ps1`) | API `:8102` · Web `:5192` · Redis DB `2` |
| Puerto contenedor (D-36) | `:8053` |

---

## 2. Identidad de usuario y embebido en el Shell

1. El Shell entrega la sesión/identidad mediante las cabeceras y cookies gestionadas por `cereipo_sso.middleware.IdentidadCereipoMiddleware`.
2. `EmbebidoMiddleware` inyecta `<meta name="cereipo-shell-url">` para que `frontend/` valide mensajes `postMessage` con `@cereipo/embed` (`ruta`, `alIrA`, `sesion_vencida`, `sin_acceso`).
3. En desarrollo standalone sin iframe (`window.self === window.top`), la SPA muestra una barra de navegación local para recorrer Inicio, Generar, Registro, Anulaciones, Catálogos y Administración.
4. `GET /api/yo/` (`integracion/views.py`) entrega `organizacion`, `persona`, `permisos` y `rol`; el middleware activa automáticamente el contexto PostgreSQL RLS de la organización.

---

## 3. Servicio declarado D-16 (`codigos/generar-codigos`)

Declarado en el manifiesto bajo `servicios`:

- **Código**: `generar-codigos` (versión `1`)
- **Ruta base**: `/api/servicios/generar-codigos/`
- **Autenticación**: `integracion.permissions.ServicioAPIMixin` (`cereipo_sso.drf.ServicioAPIMixin`), que verifica:
  - Firma HMAC-SHA256 de la app consumidora (`X-Cereipo-App-Origen`, `X-Cereipo-Servicio`, `X-Cereipo-Timestamp`, `X-Cereipo-Body-Sha256`, `X-Cereipo-Firma`).
  - Autorización activa en `Cereipo Shell` (`/api/servicios/autorizaciones/`) para `(consumidor, codigos, generar-codigos, organizacion_id)`.
  - Fija el contexto RLS en PostgreSQL al `organizacion_id` de `X-Cereipo-Organizacion`.
- **Operaciones expuestas (`backend/api/urls.py`)**:
  - `GET catalogos/` -> sigla fija de la organización y segmentos activos agrupados.
  - `POST reservar/` -> reserva un lote en estado `reservado` (con idempotencia).
  - `POST confirmar/` -> confirma códigos reservados existentes.
  - `POST generar/` -> genera un lote directamente en estado `confirmado` (con idempotencia).
  - `POST anular/` -> anula códigos por lote.
  - `POST consultar/` -> consulta exacta por lista de códigos o referencias externas.
- **Bitácora**: `api/services/bitacora.py` reporta de forma no bloqueante cada operación al endpoint de bitácora del Shell (`reportar_bitacora_servicio`).

---

## 4. Datos maestros y avisos

- **Maestro propio publicado (D-17)**: `codigos.catalogos`
  - Publicado por `catalogos.services.publicacion.sincronizar_maestro_catalogos()` cada vez que cambian la sigla o segmentos de la organización, y bajo demanda vía `python manage.py sincronizar_maestros`.
- **Maestros consumidos del Shell (lectura auxiliar)**:
  - `GET /api/integracion/maestros-shell/` consulta opcionalmente `proyectos` y `disciplinas` del Shell (`integracion/services/maestros.py`) para sugerir valores o llenar `codigo_shell` en catálogos.
- **Avisos emitidos al Shell**:
  - `codigos.solicitud_anulacion`: cuando un generador solicita anular un código.
  - `codigos.codigo_anulado`: cuando un código queda anulado (directo, aprobado o vía API).

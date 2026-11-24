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

1. El Shell entrega la sesión/identidad mediante las cabeceras y cookies gestionadas por `cereipo_sso.middleware.IdentidadMiddleware`.
2. `EmbebidoMiddleware` inyecta `<meta name="cereipo-shell-url">` para que `frontend/` valide mensajes `postMessage` con `@cereipo/embed` (`ruta`, `capacidades: ['navegar']`, `alIrA`, `sesion_vencida`, `sin_acceso`).
3. En desarrollo standalone sin iframe (`!embebida`), la SPA muestra una barra de navegación local para recorrer Inicio, Generar, Registro, Anulaciones, Catálogos y Administración.
4. `GET /api/yo/` (`integracion/views.py`) siembra `cereipo_codigos_csrf` (`@ensure_csrf_cookie`) y entrega `organizacion`, `persona`, `permisos` y `rol`; el middleware activa automáticamente el contexto PostgreSQL RLS de la organización.

---

## 3. Servicio declarado D-16 (`codigos/generar-codigos`)

Declarado en el manifiesto bajo `servicios`:

- **Código**: `generar-codigos` (versión `1`)
- **Ruta base**: `/api/servicios/generar-codigos/`
- **Autenticación**: `api.views.ServicioBaseView` (`cereipo_sso.drf.ServicioAPIMixin`), que verifica:
  - Firma HMAC-SHA256 de la app consumidora (`X-Cereipo-App`, `X-Cereipo-Servicio`, `X-Cereipo-Organizacion`, `X-Cereipo-Firma` y `X-Cereipo-Nonce` anti-replay).
  - Autorización activa en `Cereipo Shell` (`/api/servicios/autorizaciones/`) para `(consumidor, codigos, generar-codigos, organizacion_id)`.
  - Fija el contexto RLS en PostgreSQL al `organizacion_id` de `X-Cereipo-Organizacion`.
- **Operaciones expuestas (`backend/api/urls.py`)**:
  - `GET catalogos/` -> sigla fija de la organización y `segmentos` activos agrupados.
  - `POST reservar/` -> reserva un lote en estado `reservado` (con idempotencia).
  - `POST confirmar/` -> confirma códigos reservados por `codigos` o `claves_idempotencia`.
  - `POST generar/` -> genera un lote directamente en estado `confirmado` (con idempotencia).
  - `POST anular/` -> anula códigos por lote (`codigos` o `referencias_externas`).
  - `POST consultar/` -> consulta exacta por `codigos` y/o `referencias_externas`.
- **Bitácora**: `api/services/bitacora.py` (`registrar_llamada()`) reporta en `transaction.on_commit` cada operación mediante `cereipo_sso.servicios.reportar_uso_servicio()` de forma no bloqueante.

---

## 4. Datos maestros y avisos

- **Maestro propio publicado (D-17)**: `codigos.catalogos`
  - Publicado por `catalogos.services.publicacion.construir_snapshot_catalogos()` + `publicar_snapshot_catalogos()` cada vez que cambian la sigla o segmentos de la organización (no bloqueante si el Shell no está disponible).
- **Maestros consumidos del Shell (lectura auxiliar)**:
  - `GET /api/integracion/maestros-shell/` consulta `MaestroShellCache` (`shell.clientes`, `shell.proyectos`, `shell.disciplinas`), actualizado incrementalmente con `manage.py sincronizar_maestros` (`integracion.services.maestros.refrescar_maestros_shell()`).
- **Avisos emitidos al Shell**:
  - `codigos.solicitud_anulacion`: cuando un generador solicita anular un código.
  - `codigos.codigo_anulado`: cuando un código queda anulado (directo, aprobado o vía API).
